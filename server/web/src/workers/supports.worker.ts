/**
 * Web Worker: compute negative-space supports using manifold-3d WASM.
 *
 * Two pipelines:
 * - STL/OBJ (mesh mode): Full-shell negative space (cli.py:464-525)
 * - STEP (B-Rep mode): Per-face overhang detection + column extraction (cli.py:346-461)
 */

import Module from 'manifold-3d';
// @ts-ignore — Vite ?url import for WASM file
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { parseSTL, exportSTL, type ParsedMesh } from '../lib/stl';
import { parseOBJ } from '../lib/obj';
import { parseSTEP, type STEPFaceInfo } from '../lib/step';
import { computeBBox, translateZ, inflateMesh, repairMesh } from '../lib/mesh-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasm: any;

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

// -- Helpers --

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function meshToManifold(parsed: ParsedMesh): any {
  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: parsed.vertices,
    triVerts: parsed.faces,
  });
  // Try merge() to repair simple non-manifold issues (open edges)
  try { mesh.merge(); } catch (_) { /* best-effort */ }
  const m = wasm.Manifold.ofMesh(mesh);
  mesh.delete?.();
  return m;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function manifoldToMesh(m: any): ParsedMesh {
  const mesh = m.getMesh();
  const vp = mesh.vertProperties;
  const numProp = mesh.numProp;

  let vertices: Float32Array;
  if (numProp === 3) {
    vertices = new Float32Array(vp);
  } else {
    const numVerts = vp.length / numProp;
    vertices = new Float32Array(numVerts * 3);
    for (let i = 0; i < numVerts; i++) {
      vertices[i * 3] = vp[i * numProp];
      vertices[i * 3 + 1] = vp[i * numProp + 1];
      vertices[i * 3 + 2] = vp[i * numProp + 2];
    }
  }

  const faces = new Uint32Array(mesh.triVerts);
  mesh.delete?.();
  return { vertices, faces };
}

// -- Mesh pipeline (mirrors Python compute_supports_mesh) --

function generateSupports(parsed: ParsedMesh, margin: number, minVolume: number): OutMessage {
  // Translate to z=0
  const bbox = computeBBox(parsed.vertices);
  const zMin = bbox.min[2];
  if (Math.abs(zMin) > 1e-6) {
    translateZ(parsed.vertices, -zMin);
  }
  const bb = computeBBox(parsed.vertices);

  // Step 1: Inflate (vertex-normal offset — approximates Minkowski sum with sphere)
  progress('Inflate', 'Offsetting vertices...');
  const inflatedParsed = inflateMesh(parsed, margin);
  const inflated = meshToManifold(inflatedParsed);
  progress('Inflate', `${(inflatedParsed.faces.length / 3).toLocaleString()} faces`);

  // Step 2: Negative space (outer box - inflated, clipped to model bbox)
  progress('Negative space', 'Boolean difference...');

  const pad = margin + 1.0;
  const ex = bb.max[0] - bb.min[0] + 2 * pad;
  const ey = bb.max[1] - bb.min[1] + 2 * pad;
  const ez = bb.max[2] + pad;
  const cx = (bb.min[0] + bb.max[0]) / 2;
  const cy = (bb.min[1] + bb.max[1]) / 2;

  const outerBox = wasm.Manifold.cube([ex, ey, ez]).translate([cx - ex / 2, cy - ey / 2, 0]);
  const negative = outerBox.subtract(inflated);
  outerBox.delete();
  inflated.delete();

  // Clip to model bounding box
  const mx = bb.max[0] - bb.min[0];
  const my = bb.max[1] - bb.min[1];
  const mz = bb.max[2];
  const modelBox = wasm.Manifold.cube([mx, my, mz]).translate([bb.min[0], bb.min[1], 0]);
  const clipped = negative.intersect(modelBox);
  negative.delete();
  modelBox.delete();

  const negVol = clipped.volume();
  progress('Negative space', `${negVol.toLocaleString(undefined, { maximumFractionDigits: 0 })} mm³`);

  if (negVol < 0.01) {
    clipped.delete();
    return { type: 'error', message: 'No negative space found — model may be non-manifold.' };
  }

  // Step 3: Decompose & filter
  progress('Split & filter', 'Decomposing...');
  const components = clipped.decompose();
  clipped.delete();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kept: any[] = [];
  for (const comp of components) {
    const vol = Math.abs(comp.volume());
    if (vol >= minVolume) {
      kept.push(comp);
    } else {
      comp.delete();
    }
  }

  if (kept.length === 0) {
    return { type: 'error', message: 'No support pieces found above minimum volume threshold.' };
  }
  progress('Split & filter', `${kept.length} pieces`);

  // Step 4: Merge
  progress('Merge', `Merging ${kept.length} pieces...`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let merged: any;
  if (kept.length === 1) {
    merged = kept[0];
  } else {
    merged = wasm.Manifold.union(kept);
    for (const k of kept) k.delete();
  }

  const totalVol = Math.abs(merged.volume());
  const outMesh = manifoldToMesh(merged);
  const faceCount = outMesh.faces.length / 3;
  merged.delete();

  progress('Merge', `${faceCount.toLocaleString()} faces`);

  // Translate back to original z
  if (Math.abs(zMin) > 1e-6) {
    translateZ(outMesh.vertices, zMin);
  }

  // Step 5: Export STL
  progress('Export', 'Writing STL...');
  const stlBuffer = exportSTL(outMesh);

  return {
    type: 'result',
    stlBuffer,
    stats: {
      pieces: kept.length,
      faces: faceCount,
      volume: totalVol,
    },
  };
}

// -- STEP pipeline (mirrors Python compute_supports with overhang detection) --

function generateSupportsSTEP(
  parsed: ParsedMesh,
  faceInfos: STEPFaceInfo[],
  margin: number,
  angle: number,
  minVolume: number,
): OutMessage {
  const nzThreshold = -Math.cos((angle * Math.PI) / 180);

  // Translate to z=0
  const bbox = computeBBox(parsed.vertices);
  const zMin = bbox.min[2];
  if (Math.abs(zMin) > 1e-6) {
    translateZ(parsed.vertices, -zMin);
    // Adjust face bounding boxes too
    for (const fi of faceInfos) {
      fi.minZ -= zMin;
      fi.maxZ -= zMin;
    }
  }
  const bb = computeBBox(parsed.vertices);

  // Step 1: Inflate
  progress('Inflate', 'Offsetting vertices...');
  const inflatedParsed = inflateMesh(parsed, margin);
  const inflated = meshToManifold(inflatedParsed);
  progress('Inflate', `${(inflatedParsed.faces.length / 3).toLocaleString()} faces`);

  // Step 2: Negative space (outer box - inflated, clipped to model bbox)
  progress('Negative space', 'Boolean difference...');

  const pad = margin + 1.0;
  const ex = bb.max[0] - bb.min[0] + 2 * pad;
  const ey = bb.max[1] - bb.min[1] + 2 * pad;
  const ez = bb.max[2] + pad;
  const cx = (bb.min[0] + bb.max[0]) / 2;
  const cy = (bb.min[1] + bb.max[1]) / 2;

  const outerBox = wasm.Manifold.cube([ex, ey, ez]).translate([cx - ex / 2, cy - ey / 2, 0]);
  const negativeSpace = outerBox.subtract(inflated);
  outerBox.delete();
  inflated.delete();

  // Clip to model bounding box
  const mx = bb.max[0] - bb.min[0];
  const my = bb.max[1] - bb.min[1];
  const mz = bb.max[2];
  const modelBox = wasm.Manifold.cube([mx, my, mz]).translate([bb.min[0], bb.min[1], 0]);
  const clippedNeg = negativeSpace.intersect(modelBox);
  negativeSpace.delete();
  modelBox.delete();

  const negVol = clippedNeg.volume();
  progress('Negative space', `${negVol.toLocaleString(undefined, { maximumFractionDigits: 0 })} mm³`);

  if (negVol < 0.01) {
    clippedNeg.delete();
    return { type: 'error', message: 'No negative space found — model may be non-manifold.' };
  }

  // Step 3: Detect overhang faces
  progress('Overhang detection', 'Analyzing face normals...');

  const overhangFaces: STEPFaceInfo[] = [];
  for (const fi of faceInfos) {
    if (fi.minNormalZ < nzThreshold) {
      // Skip faces on the build plate (z ≈ 0)
      if (fi.maxZ < 0.5) continue;
      overhangFaces.push(fi);
    }
  }

  if (overhangFaces.length === 0) {
    clippedNeg.delete();
    return { type: 'error', message: 'No overhang faces detected — model may not need supports at this angle.' };
  }
  progress('Overhang detection', `${overhangFaces.length} overhang face(s) of ${faceInfos.length} total`);

  // Step 4: Per-face column extraction
  progress('Column extraction', `Processing ${overhangFaces.length} faces...`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPieces: any[] = [];

  for (let fi = 0; fi < overhangFaces.length; fi++) {
    const face = overhangFaces[fi];

    const fMinX = face.minX;
    const fMinY = face.minY;
    const fMaxX = face.maxX;
    const fMaxY = face.maxY;
    const fMaxZ = face.maxZ;

    // Column extends from z=0 to above the face
    const colW = fMaxX - fMinX;
    const colD = fMaxY - fMinY;
    const colH = fMaxZ + 1.0; // extend above face

    // Skip degenerate columns (face is essentially a line/point in XY)
    if (colW < 0.01 || colD < 0.01) continue;

    const colCx = (fMinX + fMaxX) / 2;
    const colCy = (fMinY + fMaxY) / 2;

    const column = wasm.Manifold.cube([colW, colD, colH]).translate([
      colCx - colW / 2,
      colCy - colD / 2,
      0,
    ]);

    // Intersect column with negative space
    const piece = clippedNeg.intersect(column);
    column.delete();

    const pieceVol = Math.abs(piece.volume());
    if (pieceVol < minVolume) {
      piece.delete();
      continue;
    }

    // Split into components and filter stray pieces above the face
    const components = piece.decompose();
    piece.delete();

    for (const comp of components) {
      const vol = Math.abs(comp.volume());
      if (vol < minVolume) {
        comp.delete();
        continue;
      }

      // Check if component is below/touching the face (not floating above)
      const compMesh = comp.getMesh();
      const compVp = compMesh.vertProperties;
      const compNumProp = compMesh.numProp;
      let compZMin = Infinity;
      for (let vi = 0; vi < compVp.length / compNumProp; vi++) {
        const z = compVp[vi * compNumProp + 2];
        if (z < compZMin) compZMin = z;
      }
      compMesh.delete?.();

      // Discard pieces floating above the face
      if (compZMin > fMaxZ + margin) {
        comp.delete();
        continue;
      }

      allPieces.push(comp);
    }

    if ((fi + 1) % 5 === 0 || fi === overhangFaces.length - 1) {
      progress('Column extraction', `${fi + 1}/${overhangFaces.length} faces → ${allPieces.length} pieces`);
    }
  }

  clippedNeg.delete();

  if (allPieces.length === 0) {
    return { type: 'error', message: 'No support pieces found for overhang faces.' };
  }

  // Step 5: Merge
  progress('Merge', `Merging ${allPieces.length} pieces...`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let merged: any;
  if (allPieces.length === 1) {
    merged = allPieces[0];
  } else {
    merged = wasm.Manifold.union(allPieces);
    for (const k of allPieces) k.delete();
  }

  const totalVol = Math.abs(merged.volume());
  const outMesh = manifoldToMesh(merged);
  const faceCount = outMesh.faces.length / 3;
  merged.delete();

  progress('Merge', `${faceCount.toLocaleString()} faces`);

  // Translate back to original z
  if (Math.abs(zMin) > 1e-6) {
    translateZ(outMesh.vertices, zMin);
  }

  // Step 6: Export STL
  progress('Export', 'Writing STL...');
  const stlBuffer = exportSTL(outMesh);

  return {
    type: 'result',
    stlBuffer,
    stats: {
      pieces: allPieces.length,
      faces: faceCount,
      volume: totalVol,
    },
  };
}

// -- Worker entry --

self.onmessage = async (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  if (msg.type !== 'generate') return;

  try {
    // Initialize WASM if needed
    if (!wasm) {
      progress('Initialize', 'Loading WASM engine...');
      // @ts-ignore — locateFile type in manifold-3d .d.ts is incorrect
      wasm = await Module({ locateFile: (p: string) => p.endsWith('.wasm') ? wasmUrl : p });
      wasm.setup();
      progress('Initialize', 'Ready');
    }

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

    // Repair mesh (remove degenerate/duplicate faces, fix non-manifold edges)
    progress('Repair', 'Checking mesh...');
    const repaired = repairMesh(parsed);
    if (repaired !== parsed) {
      const removedFaces = triCount - repaired.faces.length / 3;
      progress('Repair', `Fixed: removed ${removedFaces} bad faces`);
      parsed = repaired;
    } else {
      progress('Repair', 'Mesh OK');
    }

    // Run the appropriate pipeline
    let result: OutMessage;
    if (stepFaces) {
      // STEP mode: overhang detection + per-face column extraction
      result = generateSupportsSTEP(parsed, stepFaces, msg.margin, msg.angle, msg.minVolume);
    } else {
      // Mesh mode: full-shell negative space
      result = generateSupports(parsed, msg.margin, msg.minVolume);
    }

    if (result.type === 'result') {
      self.postMessage(result, { transfer: [result.stlBuffer] });
    } else {
      self.postMessage(result);
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies ErrorMessage);
  }
};
