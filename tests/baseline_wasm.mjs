#!/usr/bin/env node
/**
 * Baseline test: compare WASM vertex-normal offset pipeline against
 * Python Minkowski sum baseline (tests/baseline_mesh.json).
 *
 * Runs the exact same algorithm as supports.worker.ts using manifold-3d
 * in Node.js (no browser needed).
 *
 * Usage:
 *   cd server/web && node ../../tests/baseline_wasm.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// ---- STL Parser (mirrors lib/stl.ts) ----

function parseSTL(buffer) {
  const dv = new DataView(buffer);
  // Check for ASCII
  const header = new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength));
  const headerStr = new TextDecoder().decode(header);
  if (headerStr.trimStart().startsWith('solid') && buffer.byteLength > 84) {
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    if (text.includes('facet normal')) return parseASCII(text);
  }
  return parseBinary(dv, buffer);
}

function parseBinary(dv, buffer) {
  const numTri = dv.getUint32(80, true);
  const vertMap = new Map();
  const vertices = [];
  const faces = new Uint32Array(numTri * 3);

  function addVertex(x, y, z) {
    const key = `${x},${y},${z}`;
    let idx = vertMap.get(key);
    if (idx === undefined) {
      idx = vertices.length / 3;
      vertices.push(x, y, z);
      vertMap.set(key, idx);
    }
    return idx;
  }

  let offset = 84;
  for (let i = 0; i < numTri; i++) {
    offset += 12; // skip normal
    const x0 = dv.getFloat32(offset, true); offset += 4;
    const y0 = dv.getFloat32(offset, true); offset += 4;
    const z0 = dv.getFloat32(offset, true); offset += 4;
    const x1 = dv.getFloat32(offset, true); offset += 4;
    const y1 = dv.getFloat32(offset, true); offset += 4;
    const z1 = dv.getFloat32(offset, true); offset += 4;
    const x2 = dv.getFloat32(offset, true); offset += 4;
    const y2 = dv.getFloat32(offset, true); offset += 4;
    const z2 = dv.getFloat32(offset, true); offset += 4;
    offset += 2; // attribute byte count

    faces[i * 3] = addVertex(x0, y0, z0);
    faces[i * 3 + 1] = addVertex(x1, y1, z1);
    faces[i * 3 + 2] = addVertex(x2, y2, z2);
  }

  return { vertices: new Float32Array(vertices), faces };
}

function parseASCII(text) {
  const vertMap = new Map();
  const vertices = [];
  const faceIndices = [];

  function addVertex(x, y, z) {
    const key = `${x},${y},${z}`;
    let idx = vertMap.get(key);
    if (idx === undefined) {
      idx = vertices.length / 3;
      vertices.push(x, y, z);
      vertMap.set(key, idx);
    }
    return idx;
  }

  const vertexRe = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g;
  let match;
  const triVerts = [];
  while ((match = vertexRe.exec(text)) !== null) {
    triVerts.push(addVertex(
      parseFloat(match[1]),
      parseFloat(match[2]),
      parseFloat(match[3])
    ));
    if (triVerts.length % 3 === 0) {
      faceIndices.push(triVerts[triVerts.length - 3], triVerts[triVerts.length - 2], triVerts[triVerts.length - 1]);
    }
  }

  return { vertices: new Float32Array(vertices), faces: new Uint32Array(faceIndices) };
}

// ---- Mesh utilities (mirrors lib/mesh-utils.ts) ----

function computeBBox(vertices) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertices.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const v = vertices[i + j];
      if (v < min[j]) min[j] = v;
      if (v > max[j]) max[j] = v;
    }
  }
  return { min, max };
}

function translateZ(vertices, dz) {
  for (let i = 2; i < vertices.length; i += 3) {
    vertices[i] += dz;
  }
}

function inflateMesh(mesh, margin) {
  const v = mesh.vertices;
  const f = mesh.faces;
  const numVerts = v.length / 3;
  const normals = new Float32Array(v.length);

  for (let i = 0; i < f.length; i += 3) {
    const ai = f[i] * 3, bi = f[i + 1] * 3, ci = f[i + 2] * 3;
    const e1x = v[bi] - v[ai], e1y = v[bi + 1] - v[ai + 1], e1z = v[bi + 2] - v[ai + 2];
    const e2x = v[ci] - v[ai], e2y = v[ci + 1] - v[ai + 1], e2z = v[ci + 2] - v[ai + 2];
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const vi of [ai, bi, ci]) {
      normals[vi] += nx;
      normals[vi + 1] += ny;
      normals[vi + 2] += nz;
    }
  }

  const out = new Float32Array(v.length);
  for (let i = 0; i < numVerts; i++) {
    const ni = i * 3;
    const nx = normals[ni], ny = normals[ni + 1], nz = normals[ni + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    out[ni] = v[ni] + (nx / len) * margin;
    out[ni + 1] = v[ni + 1] + (ny / len) * margin;
    out[ni + 2] = v[ni + 2] + (nz / len) * margin;
  }

  return { vertices: out, faces: new Uint32Array(f) };
}

// ---- Manifold helpers ----

function meshToManifold(wasm, parsed) {
  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: parsed.vertices,
    triVerts: parsed.faces,
  });
  const m = wasm.Manifold.ofMesh(mesh);
  mesh.delete?.();
  return m;
}

function manifoldToMesh(m) {
  const mesh = m.getMesh();
  const vp = mesh.vertProperties;
  const numProp = mesh.numProp;
  let vertices;
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

// ---- Main pipeline (mirrors supports.worker.ts generateSupports) ----

function generateSupports(wasm, parsed, margin, minVolume) {
  const bbox = computeBBox(parsed.vertices);
  const zMin = bbox.min[2];
  if (Math.abs(zMin) > 1e-6) {
    translateZ(parsed.vertices, -zMin);
  }
  const bb = computeBBox(parsed.vertices);

  // Step 1: Inflate
  console.log('  Inflate...');
  const inflatedParsed = inflateMesh(parsed, margin);
  const inflated = meshToManifold(wasm, inflatedParsed);
  console.log(`    ${(inflatedParsed.faces.length / 3).toLocaleString()} faces`);

  // Step 2: Negative space
  console.log('  Negative space...');
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

  const mx = bb.max[0] - bb.min[0];
  const my = bb.max[1] - bb.min[1];
  const mz = bb.max[2];
  const modelBox = wasm.Manifold.cube([mx, my, mz]).translate([bb.min[0], bb.min[1], 0]);
  const clipped = negative.intersect(modelBox);
  negative.delete();
  modelBox.delete();

  const negVol = clipped.volume();
  console.log(`    ${negVol.toLocaleString(undefined, { maximumFractionDigits: 0 })} mm³`);

  // Step 3: Decompose & filter
  console.log('  Split & filter...');
  const components = clipped.decompose();
  clipped.delete();

  const kept = [];
  for (const comp of components) {
    const vol = Math.abs(comp.volume());
    if (vol >= minVolume) {
      kept.push(comp);
    } else {
      comp.delete();
    }
  }
  console.log(`    ${kept.length} pieces`);

  // Step 4: Merge
  console.log('  Merge...');
  let merged;
  if (kept.length === 1) {
    merged = kept[0];
  } else if (kept.length > 1) {
    merged = wasm.Manifold.union(kept);
    for (const k of kept) k.delete();
  } else {
    return null;
  }

  const totalVol = Math.abs(merged.volume());
  const outMesh = manifoldToMesh(merged);
  const faceCount = outMesh.faces.length / 3;
  merged.delete();
  console.log(`    ${faceCount.toLocaleString()} faces, ${totalVol.toLocaleString(undefined, { maximumFractionDigits: 1 })} mm³`);

  // Also decompose the result to get per-piece stats
  const finalManifold = meshToManifold(wasm, outMesh);
  const finalComponents = finalManifold.decompose();
  const pieces = [];
  for (const comp of finalComponents) {
    pieces.push({ volume: Math.abs(comp.volume()), faces: manifoldToMesh(comp).faces.length / 3 });
    comp.delete();
  }
  finalManifold.delete();
  pieces.sort((a, b) => b.volume - a.volume);

  return {
    total_pieces: kept.length,
    total_volume: totalVol,
    total_faces: faceCount,
    pieces,
  };
}

// ---- Run ----

async function main() {
  // Load manifold-3d from server/web/node_modules
  const manifoldPath = resolve(rootDir, 'server', 'web', 'node_modules', 'manifold-3d', 'manifold.js');
  const { default: Module } = await import(manifoldPath);
  const wasm = await Module();
  wasm.setup();

  // Load test model
  const stlPath = resolve(rootDir, 'models', 'test_model.stl');
  const stlBuffer = readFileSync(stlPath);
  const parsed = parseSTL(stlBuffer.buffer.slice(stlBuffer.byteOffset, stlBuffer.byteOffset + stlBuffer.byteLength));
  console.log(`Model: ${parsed.vertices.length / 3} verts, ${parsed.faces.length / 3} faces\n`);

  // Run pipeline
  console.log('Running WASM pipeline (vertex-normal offset, margin=0.2)...');
  const result = generateSupports(wasm, parsed, 0.2, 1.0);
  if (!result) {
    console.error('No supports generated');
    process.exit(1);
  }

  // Load Python baseline
  const baselinePath = resolve(__dirname, 'baseline_mesh.json');
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));

  // Compare
  console.log('\n' + '='.repeat(70));
  console.log('Comparison: WASM vertex-normal offset vs Python Minkowski sum');
  console.log('='.repeat(70));

  const metrics = [
    ['Pieces', 'total_pieces', false],
    ['Volume (mm³)', 'total_volume', true],
    ['Faces', 'total_faces', true],
  ];

  let passed = true;
  console.log(`\n${'Metric'.padEnd(20)} ${'Python'.padStart(12)} ${'WASM'.padStart(12)} ${'Delta%'.padStart(10)} ${'Status'.padStart(8)}`);
  console.log('-'.repeat(65));

  for (const [label, key, allowDelta] of metrics) {
    const b = baseline[key];
    const c = result[key];
    const pct = b ? ((c - b) / b * 100) : 0;

    // Volume: allow 15% tolerance (vertex-normal offset is an approximation)
    // Pieces: allow ±1 difference
    // Faces: allow 50% (mesh topology can vary significantly)
    let ok;
    if (key === 'total_pieces') {
      ok = Math.abs(c - b) <= 1;
    } else if (key === 'total_volume') {
      ok = Math.abs(pct) < 15;
    } else {
      ok = true; // faces can vary a lot
    }

    const status = ok ? '✓' : '✗ FAIL';
    if (!ok) passed = false;

    const bStr = typeof b === 'number' && b % 1 !== 0 ? b.toFixed(1) : String(b);
    const cStr = typeof c === 'number' && c % 1 !== 0 ? c.toFixed(1) : String(c);
    console.log(`  ${label.padEnd(18)} ${bStr.padStart(12)} ${cStr.padStart(12)} ${(pct.toFixed(1) + '%').padStart(10)} ${status.padStart(8)}`);
  }

  // Per-piece comparison
  if (result.pieces.length > 0 && baseline.pieces.length > 0) {
    console.log(`\n${'Piece'.padEnd(8)} ${'Python Vol'.padStart(12)} ${'WASM Vol'.padStart(12)} ${'Delta%'.padStart(10)}`);
    console.log('-'.repeat(45));
    const maxP = Math.max(result.pieces.length, baseline.pieces.length);
    for (let i = 0; i < maxP; i++) {
      const bp = baseline.pieces[i];
      const cp = result.pieces[i];
      if (bp && cp) {
        const pct = bp.volume ? ((cp.volume - bp.volume) / bp.volume * 100) : 0;
        console.log(`  ${String(i).padEnd(6)} ${bp.volume.toFixed(1).padStart(12)} ${cp.volume.toFixed(1).padStart(12)} ${(pct.toFixed(1) + '%').padStart(10)}`);
      } else if (bp) {
        console.log(`  ${String(i).padEnd(6)} ${bp.volume.toFixed(1).padStart(12)} ${'MISSING'.padStart(12)}`);
      } else {
        console.log(`  ${String(i).padEnd(6)} ${'NEW'.padStart(12)} ${cp.volume.toFixed(1).padStart(12)}`);
      }
    }
  }

  console.log();
  if (passed) {
    console.log('✓ WASM vertex-normal offset is within tolerance of Python Minkowski sum');
  } else {
    console.log('✗ WASM output differs significantly from Python baseline');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
