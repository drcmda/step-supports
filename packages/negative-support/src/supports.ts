/**
 * Core support generation algorithms using manifold-3d.
 *
 * Two pipelines:
 * - Mesh mode: full-shell negative space (STL/OBJ)
 * - STEP mode: per-face overhang detection + column extraction
 */

import type { ParsedMesh, STEPFaceInfo, OnProgress } from './types';
import { computeBBox, translateZ, inflateMesh, repairMesh } from './mesh-utils';
import { exportSTL } from './stl';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasm: any = null;

/** Initialize manifold-3d WASM (cached after first call). */
export async function getManifold() {
  if (wasm) return wasm;
  const Module = (await import('manifold-3d')).default;
  // @ts-ignore — locateFile type mismatch
  wasm = await Module();
  wasm.setup();
  return wasm;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function meshToManifold(parsed: ParsedMesh): any {
  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: parsed.vertices,
    triVerts: parsed.faces,
  });
  try { mesh.merge(); } catch (_) { /* best-effort */ }
  const m = wasm.Manifold.ofMesh(mesh);
  mesh.delete?.();
  return m;
}

function manifoldToMesh(m: { getMesh: () => { vertProperties: Float32Array; numProp: number; triVerts: Uint32Array; delete?: () => void } }): ParsedMesh {
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

interface SupportStats {
  pieces: number;
  faces: number;
  volume: number;
}

const noop: OnProgress = () => {};

/** Full-shell negative space supports (for STL/OBJ). */
export function generateSupportsMesh(
  parsed: ParsedMesh,
  margin: number,
  minVolume: number,
  onProgress: OnProgress = noop,
): { stl: ArrayBuffer; stats: SupportStats } {
  // Translate to z=0
  const bbox = computeBBox(parsed.vertices);
  const zMin = bbox.min[2];
  if (Math.abs(zMin) > 1e-6) translateZ(parsed.vertices, -zMin);
  const bb = computeBBox(parsed.vertices);

  // Inflate
  onProgress('Inflate', `margin=${margin}mm`);
  const inflatedParsed = inflateMesh(parsed, margin);
  const inflated = meshToManifold(inflatedParsed);

  // Negative space
  const pad = margin + 1.0;
  const ex = bb.max[0] - bb.min[0] + 2 * pad;
  const ey = bb.max[1] - bb.min[1] + 2 * pad;
  const ez = bb.max[2] + pad;
  const cx = (bb.min[0] + bb.max[0]) / 2;
  const cy = (bb.min[1] + bb.max[1]) / 2;

  onProgress('Negative space');
  const outerBox = wasm.Manifold.cube([ex, ey, ez]).translate([cx - ex / 2, cy - ey / 2, 0]);
  const negative = outerBox.subtract(inflated);
  outerBox.delete();
  inflated.delete();

  const mx = bb.max[0] - bb.min[0];
  const my = bb.max[1] - bb.min[1];
  const mz = bb.max[2];
  const modelBox = wasm.Manifold.cube([mx, my, mz]).translate([bb.min[0], bb.min[1], 0]);
  const clipped = negative.intersect(modelBox);
  negative.delete();
  modelBox.delete();

  const negVol = clipped.volume();
  if (negVol < 0.01) {
    clipped.delete();
    throw new Error('No negative space found — model may be non-manifold.');
  }

  // Decompose & filter
  onProgress('Split & filter');
  const components = clipped.decompose();
  clipped.delete();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kept: any[] = [];
  for (const comp of components) {
    if (Math.abs(comp.volume()) >= minVolume) kept.push(comp);
    else comp.delete();
  }

  if (kept.length === 0) throw new Error('No support pieces found above minimum volume threshold.');

  // Merge
  onProgress('Merge', `${kept.length} pieces`);
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

  if (Math.abs(zMin) > 1e-6) translateZ(outMesh.vertices, zMin);

  onProgress('Export');
  return {
    stl: exportSTL(outMesh),
    stats: { pieces: kept.length, faces: faceCount, volume: totalVol },
  };
}

/** STEP-specific supports with overhang detection + column extraction. */
export function generateSupportsSTEP(
  parsed: ParsedMesh,
  faceInfos: STEPFaceInfo[],
  margin: number,
  angle: number,
  minVolume: number,
  onProgress: OnProgress = noop,
): { stl: ArrayBuffer; stats: SupportStats } {
  const nzThreshold = -Math.cos((angle * Math.PI) / 180);

  // Translate to z=0
  const bbox = computeBBox(parsed.vertices);
  const zMin = bbox.min[2];
  if (Math.abs(zMin) > 1e-6) {
    translateZ(parsed.vertices, -zMin);
    for (const fi of faceInfos) {
      fi.minZ -= zMin;
      fi.maxZ -= zMin;
    }
  }
  const bb = computeBBox(parsed.vertices);

  // Inflate
  onProgress('Inflate', `margin=${margin}mm`);
  const inflatedParsed = inflateMesh(parsed, margin);
  const inflated = meshToManifold(inflatedParsed);

  // Negative space
  onProgress('Negative space');
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

  const mx = bb.max[0] - bb.min[0];
  const my = bb.max[1] - bb.min[1];
  const mz = bb.max[2];
  const modelBox = wasm.Manifold.cube([mx, my, mz]).translate([bb.min[0], bb.min[1], 0]);
  const clippedNeg = negativeSpace.intersect(modelBox);
  negativeSpace.delete();
  modelBox.delete();

  const negVol = clippedNeg.volume();
  if (negVol < 0.01) {
    clippedNeg.delete();
    throw new Error('No negative space found — model may be non-manifold.');
  }

  // Detect overhang faces
  onProgress('Overhang detection', `${faceInfos.length} faces`);
  const overhangFaces = faceInfos.filter(fi => fi.minNormalZ < nzThreshold && fi.maxZ >= 0.5);

  if (overhangFaces.length === 0) {
    clippedNeg.delete();
    throw new Error('No overhang faces detected — model may not need supports at this angle.');
  }

  // Per-face column extraction
  onProgress('Column extraction', `${overhangFaces.length} overhang faces`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPieces: any[] = [];

  for (const face of overhangFaces) {
    const colW = face.maxX - face.minX;
    const colD = face.maxY - face.minY;
    const colH = face.maxZ + 1.0;
    if (colW < 0.01 || colD < 0.01) continue;

    const colCx = (face.minX + face.maxX) / 2;
    const colCy = (face.minY + face.maxY) / 2;
    const column = wasm.Manifold.cube([colW, colD, colH]).translate([colCx - colW / 2, colCy - colD / 2, 0]);
    const piece = clippedNeg.intersect(column);
    column.delete();

    const pieceVol = Math.abs(piece.volume());
    if (pieceVol < minVolume) { piece.delete(); continue; }

    const components = piece.decompose();
    piece.delete();
    for (const comp of components) {
      const vol = Math.abs(comp.volume());
      if (vol < minVolume) { comp.delete(); continue; }

      // Filter stray pieces above face
      const compMesh = comp.getMesh();
      const compVp = compMesh.vertProperties;
      const compNumProp = compMesh.numProp;
      let compZMin = Infinity;
      for (let vi = 0; vi < compVp.length / compNumProp; vi++) {
        if (compVp[vi * compNumProp + 2] < compZMin) compZMin = compVp[vi * compNumProp + 2];
      }
      compMesh.delete?.();
      if (compZMin > face.maxZ + margin) { comp.delete(); continue; }

      allPieces.push(comp);
    }
  }

  clippedNeg.delete();

  if (allPieces.length === 0) throw new Error('No support pieces found for overhang faces.');

  // Merge
  onProgress('Merge', `${allPieces.length} pieces`);
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

  if (Math.abs(zMin) > 1e-6) translateZ(outMesh.vertices, zMin);

  onProgress('Export');
  return {
    stl: exportSTL(outMesh),
    stats: { pieces: allPieces.length, faces: faceCount, volume: totalVol },
  };
}

/** Repair and prepare a mesh for support generation. */
export function prepareMesh(parsed: ParsedMesh): ParsedMesh {
  return repairMesh(parsed);
}
