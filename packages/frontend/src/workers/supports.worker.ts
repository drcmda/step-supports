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
import { repairMesh } from '@core/mesh-utils';
import { export3MF } from '@core/threemf';
import { getManifold, generateSupportsMesh, generateSupportsSTEP } from '@core/supports';

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
  stats: { pieces: number; faces: number; volume: number };
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
    const result = stepFaces
      ? generateSupportsSTEP(parsed, stepFaces, msg.margin, msg.angle, msg.minVolume, progress)
      : generateSupportsMesh(parsed, msg.margin, msg.minVolume, progress);

    // Export 3MF (model + supports)
    progress('Export', 'Writing 3MF...');
    const threemfBuffer = export3MF(modelMesh, result.supportMesh);

    const out: ResultMessage = {
      type: 'result',
      stlBuffer: result.stl,
      threemfBuffer,
      stats: result.stats,
    };
    self.postMessage(out, { transfer: [result.stl, threemfBuffer] });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies ErrorMessage);
  }
};
