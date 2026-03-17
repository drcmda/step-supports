/**
 * Web Worker: compute negative-space supports.
 *
 * All algorithm logic lives in @core — this worker is just the browser glue:
 * - Browser-compatible WASM initialization (manifold-3d, occt-import-js)
 * - File parsing dispatch
 * - 3MF packaging (needs both model + support mesh)
 */

// @ts-ignore — Vite ?url import for WASM file
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import type { ParsedMesh, STEPFaceInfo } from '@core/types';
import { parseSTL, exportSTL } from '@core/stl';
import { parseOBJ } from '@core/obj';
import { parseSTEP } from '../lib/step';
import { repairMesh, computeMeshOverhangs } from '@core/mesh-utils';
import { export3MF } from '@core/threemf';
import { getManifold, generateSupportsMesh, generateSupportsMeshOverhang, generateSupportsSTEP } from '@core/supports';

// -- Message types --

interface GenerateMessage {
  type: 'generate';
  fileBuffer: ArrayBuffer;
  fileName: string;
  margin: number;
  angle: number;
  minVolume: number;
}

type InMessage = GenerateMessage;

interface ProgressMessage {
  type: 'progress';
  step: string;
  detail?: string;
}

interface ResultMessage {
  type: 'result';
  stlBuffer: ArrayBuffer;
  threemfBuffer: ArrayBuffer;
  stats: {
    pieces: number; faces: number; volume: number;
    modelVertices: number; modelFaces: number;
    supportVertices: number; supportFaces: number;
    margin: number; format: string;
  };
  modelVertices: Float32Array;
  modelFaces: Uint32Array;
  supportVertices: Float32Array;
  supportFaces: Uint32Array;
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type OutMessage = ProgressMessage | ResultMessage | ErrorMessage;

function progress(step: string, detail?: string) {
  self.postMessage({ type: 'progress', step, detail } satisfies ProgressMessage);
}

// -- Worker entry --

self.onmessage = async (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  if (msg.type !== 'generate') return;

  try {
    // Initialize manifold-3d WASM with browser-compatible locateFile
    progress('Initialize', 'Loading WASM engine...');
    await getManifold(wasmUrl);
    progress('Initialize', 'Ready');

    // Parse input file
    const ext = msg.fileName.toLowerCase().split('.').pop() || '';
    progress('Parse', `Loading ${msg.fileName}...`);

    let parsed: ParsedMesh;
    let stepFaces: STEPFaceInfo[] | null = null;

    if (ext === 'stl') {
      parsed = parseSTL(msg.fileBuffer);
    } else if (ext === 'obj') {
      parsed = parseOBJ(msg.fileBuffer);
    } else if (ext === 'step' || ext === 'stp') {
      progress('Parse', 'Loading OpenCascade WASM (first time may take a moment)...');
      const stepResult = await parseSTEP(msg.fileBuffer);
      parsed = stepResult.mesh;
      stepFaces = stepResult.faces;
    } else {
      self.postMessage({
        type: 'error',
        message: `Unsupported format: .${ext}. Use STL, OBJ, or STEP.`,
      } satisfies ErrorMessage);
      return;
    }

    const vertCount = parsed.vertices.length / 3;
    const triCount = parsed.faces.length / 3;
    progress('Parse', `${vertCount.toLocaleString()} vertices, ${triCount.toLocaleString()} triangles`);

    // Repair mesh
    progress('Repair', 'Checking mesh...');
    const repaired = repairMesh(parsed);
    if (repaired !== parsed) {
      const removedFaces = triCount - repaired.faces.length / 3;
      progress('Repair', `Fixed: removed ${removedFaces} bad faces`);
      parsed = repaired;
    } else {
      progress('Repair', 'Mesh OK');
    }

    // Save model mesh copy for 3MF (pipeline modifies vertices in-place)
    const modelMesh: ParsedMesh = {
      vertices: new Float32Array(parsed.vertices),
      faces: new Uint32Array(parsed.faces),
    };

    // Run the appropriate pipeline from core
    let result;
    if (stepFaces) {
      result = generateSupportsSTEP(parsed, stepFaces, msg.margin, msg.angle, msg.minVolume, progress);
    } else {
      // Try overhang detection for mesh files (STL/OBJ)
      progress('Overhang', 'Detecting overhangs...');
      const overhangClusters = computeMeshOverhangs(parsed, msg.angle);
      if (overhangClusters.length > 0) {
        progress('Overhang', `${overhangClusters.length} regions detected`);
        result = generateSupportsMeshOverhang(parsed, overhangClusters, msg.margin, msg.angle, msg.minVolume, progress);
      } else {
        progress('Overhang', 'No overhangs — full shell');
        result = generateSupportsMesh(parsed, msg.margin, msg.minVolume, progress);
      }
    }

    // Export 3MF (model + supports)
    progress('Export', 'Writing 3MF...');
    const threemfBuffer = export3MF(modelMesh, result.supportPieces);

    // Copy model mesh for viewer (modelMesh buffers are consumed by transfer)
    const viewerModelVerts = new Float32Array(modelMesh.vertices);
    const viewerModelFaces = new Uint32Array(modelMesh.faces);

    const out: ResultMessage = {
      type: 'result',
      stlBuffer: result.stl,
      threemfBuffer,
      stats: {
        ...result.stats,
        modelVertices: modelMesh.vertices.length / 3,
        modelFaces: modelMesh.faces.length / 3,
        supportVertices: result.supportMesh.vertices.length / 3,
        supportFaces: result.supportMesh.faces.length / 3,
        margin: msg.margin,
        format: ext.toUpperCase(),
      },
      modelVertices: viewerModelVerts,
      modelFaces: viewerModelFaces,
      supportVertices: result.supportMesh.vertices,
      supportFaces: result.supportMesh.faces,
    };
    self.postMessage(out, {
      transfer: [
        result.stl,
        threemfBuffer,
        viewerModelVerts.buffer,
        viewerModelFaces.buffer,
        result.supportMesh.vertices.buffer,
        result.supportMesh.faces.buffer,
      ],
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies ErrorMessage);
  }
};
