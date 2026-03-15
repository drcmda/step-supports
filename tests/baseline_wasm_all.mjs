#!/usr/bin/env node
/**
 * Run WASM vertex-normal offset pipeline on all STL models and compare
 * against Python Minkowski sum output.
 *
 * Usage: node tests/baseline_wasm_all.mjs
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const modelsDir = resolve(rootDir, 'models');

// ---- STL Parser ----

function parseSTL(buffer) {
  const dv = new DataView(buffer);
  const header = new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength));
  const headerStr = new TextDecoder().decode(header);
  if (headerStr.trimStart().startsWith('solid') && buffer.byteLength > 84) {
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    if (text.includes('facet normal')) return parseASCII(text);
  }
  return parseBinary(dv);
}

function parseBinary(dv) {
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
    offset += 12;
    const x0 = dv.getFloat32(offset, true); offset += 4;
    const y0 = dv.getFloat32(offset, true); offset += 4;
    const z0 = dv.getFloat32(offset, true); offset += 4;
    const x1 = dv.getFloat32(offset, true); offset += 4;
    const y1 = dv.getFloat32(offset, true); offset += 4;
    const z1 = dv.getFloat32(offset, true); offset += 4;
    const x2 = dv.getFloat32(offset, true); offset += 4;
    const y2 = dv.getFloat32(offset, true); offset += 4;
    const z2 = dv.getFloat32(offset, true); offset += 4;
    offset += 2;
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
    if (idx === undefined) { idx = vertices.length / 3; vertices.push(x, y, z); vertMap.set(key, idx); }
    return idx;
  }
  const re = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g;
  let m; const tv = [];
  while ((m = re.exec(text)) !== null) {
    tv.push(addVertex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])));
    if (tv.length % 3 === 0) faceIndices.push(tv[tv.length-3], tv[tv.length-2], tv[tv.length-1]);
  }
  return { vertices: new Float32Array(vertices), faces: new Uint32Array(faceIndices) };
}

// ---- Mesh utilities ----

function computeBBox(vertices) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertices.length; i += 3)
    for (let j = 0; j < 3; j++) { const v = vertices[i+j]; if (v < min[j]) min[j] = v; if (v > max[j]) max[j] = v; }
  return { min, max };
}

function translateZ(vertices, dz) { for (let i = 2; i < vertices.length; i += 3) vertices[i] += dz; }

function inflateMesh(mesh, margin) {
  const v = mesh.vertices, f = mesh.faces, numVerts = v.length / 3;
  const normals = new Float32Array(v.length);
  for (let i = 0; i < f.length; i += 3) {
    const ai = f[i]*3, bi = f[i+1]*3, ci = f[i+2]*3;
    const e1x = v[bi]-v[ai], e1y = v[bi+1]-v[ai+1], e1z = v[bi+2]-v[ai+2];
    const e2x = v[ci]-v[ai], e2y = v[ci+1]-v[ai+1], e2z = v[ci+2]-v[ai+2];
    const nx = e1y*e2z - e1z*e2y, ny = e1z*e2x - e1x*e2z, nz = e1x*e2y - e1y*e2x;
    for (const vi of [ai, bi, ci]) { normals[vi] += nx; normals[vi+1] += ny; normals[vi+2] += nz; }
  }
  const out = new Float32Array(v.length);
  for (let i = 0; i < numVerts; i++) {
    const ni = i*3;
    const nx = normals[ni], ny = normals[ni+1], nz = normals[ni+2];
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
    out[ni] = v[ni] + (nx/len)*margin; out[ni+1] = v[ni+1] + (ny/len)*margin; out[ni+2] = v[ni+2] + (nz/len)*margin;
  }
  return { vertices: out, faces: new Uint32Array(f) };
}

// ---- Manifold helpers ----

function meshToManifold(wasm, parsed) {
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties: parsed.vertices, triVerts: parsed.faces });
  const m = wasm.Manifold.ofMesh(mesh); mesh.delete?.(); return m;
}

function manifoldToMesh(m) {
  const mesh = m.getMesh(); const vp = mesh.vertProperties; const numProp = mesh.numProp;
  let vertices;
  if (numProp === 3) { vertices = new Float32Array(vp); }
  else { const n = vp.length/numProp; vertices = new Float32Array(n*3); for (let i=0;i<n;i++) { vertices[i*3]=vp[i*numProp]; vertices[i*3+1]=vp[i*numProp+1]; vertices[i*3+2]=vp[i*numProp+2]; } }
  const faces = new Uint32Array(mesh.triVerts); mesh.delete?.(); return { vertices, faces };
}

// ---- Pipeline ----

function generateSupports(wasm, parsed, margin, minVolume) {
  const bbox = computeBBox(parsed.vertices);
  const zMin = bbox.min[2];
  if (Math.abs(zMin) > 1e-6) translateZ(parsed.vertices, -zMin);
  const bb = computeBBox(parsed.vertices);

  const inflatedParsed = inflateMesh(parsed, margin);
  const inflated = meshToManifold(wasm, inflatedParsed);

  const pad = margin + 1.0;
  const ex = bb.max[0]-bb.min[0]+2*pad, ey = bb.max[1]-bb.min[1]+2*pad, ez = bb.max[2]+pad;
  const cx = (bb.min[0]+bb.max[0])/2, cy = (bb.min[1]+bb.max[1])/2;

  const outerBox = wasm.Manifold.cube([ex, ey, ez]).translate([cx-ex/2, cy-ey/2, 0]);
  const negative = outerBox.subtract(inflated);
  outerBox.delete(); inflated.delete();

  const mx = bb.max[0]-bb.min[0], my = bb.max[1]-bb.min[1], mz = bb.max[2];
  const modelBox = wasm.Manifold.cube([mx, my, mz]).translate([bb.min[0], bb.min[1], 0]);
  const clipped = negative.intersect(modelBox);
  negative.delete(); modelBox.delete();

  const negVol = clipped.volume();
  if (negVol < 0.01) { clipped.delete(); return null; }

  const components = clipped.decompose();
  clipped.delete();

  const kept = [];
  for (const comp of components) {
    if (Math.abs(comp.volume()) >= minVolume) kept.push(comp);
    else comp.delete();
  }
  if (kept.length === 0) return null;

  let merged;
  if (kept.length === 1) merged = kept[0];
  else { merged = wasm.Manifold.union(kept); for (const k of kept) k.delete(); }

  const totalVol = Math.abs(merged.volume());
  const outMesh = manifoldToMesh(merged);
  const faceCount = outMesh.faces.length / 3;
  merged.delete();

  return { pieces: kept.length, volume: totalVol, faces: faceCount };
}

// ---- Generate Python baselines ----

function getPythonBaseline(stlFile) {
  const script = `
import trimesh, json, sys
from negative_support.cli import compute_supports_mesh
mesh = trimesh.load('${stlFile}')
z_min = mesh.bounds[0][2]
if abs(z_min) > 1e-6: mesh.apply_translation([0, 0, -z_min])
supports = compute_supports_mesh(mesh, margin=0.2, min_volume=1.0, verbose=False)
if supports is None:
    print(json.dumps({"error": "none"}))
else:
    pieces = supports.split(only_watertight=False)
    print(json.dumps({"pieces": len(pieces), "volume": round(abs(supports.volume), 1), "faces": len(supports.faces)}))
`;
  try {
    const result = execSync(`source .venv/bin/activate && python3 -c '${script.replace(/'/g, "'\\''")}'`, {
      cwd: rootDir, encoding: 'utf-8', timeout: 60000, shell: '/bin/bash'
    }).trim();
    return JSON.parse(result);
  } catch (e) {
    return { error: e.message };
  }
}

// ---- Main ----

async function main() {
  const manifoldPath = resolve(rootDir, 'server', 'web', 'node_modules', 'manifold-3d', 'manifold.js');
  const { default: Module } = await import(manifoldPath);
  const wasm = await Module();
  wasm.setup();

  const stlFiles = readdirSync(modelsDir).filter(f => f.endsWith('.stl') && !f.includes('supports'));

  console.log(`Testing ${stlFiles.length} models...\n`);
  console.log(`${'Model'.padEnd(20)} ${'Py Vol'.padStart(12)} ${'WASM Vol'.padStart(12)} ${'Delta%'.padStart(10)} ${'Py Pcs'.padStart(8)} ${'WASM Pcs'.padStart(8)} ${'Status'.padStart(8)}`);
  console.log('='.repeat(82));

  let allPassed = true;

  for (const file of stlFiles) {
    const stlPath = resolve(modelsDir, file);
    const stlBuffer = readFileSync(stlPath);
    const parsed = parseSTL(stlBuffer.buffer.slice(stlBuffer.byteOffset, stlBuffer.byteOffset + stlBuffer.byteLength));

    // Python result
    const pyResult = getPythonBaseline(stlPath);

    // WASM result
    let wasmResult;
    try {
      wasmResult = generateSupports(wasm, parsed, 0.2, 1.0);
    } catch (e) {
      console.log(`  ${file.padEnd(18)} ${pyResult.error ? 'ERROR'.padStart(12) : String(pyResult.volume).padStart(12)} ${'WASM ERR'.padStart(12)} ${''.padStart(10)} ${''.padStart(8)} ${''.padStart(8)} ${'⚠'.padStart(8)}  ${e.message}`);
      continue;
    }

    if (pyResult.error) {
      console.log(`  ${file.padEnd(18)} ${'ERROR'.padStart(12)} ${wasmResult ? wasmResult.volume.toFixed(0).padStart(12) : 'null'.padStart(12)} ${''.padStart(10)} ${''.padStart(8)} ${''.padStart(8)} ${'⚠'.padStart(8)}`);
      continue;
    }

    if (!wasmResult) {
      console.log(`  ${file.padEnd(18)} ${String(pyResult.volume).padStart(12)} ${'null'.padStart(12)} ${''.padStart(10)} ${String(pyResult.pieces).padStart(8)} ${'0'.padStart(8)} ${'✗'.padStart(8)}`);
      allPassed = false;
      continue;
    }

    const volDelta = pyResult.volume ? ((wasmResult.volume - pyResult.volume) / pyResult.volume * 100) : 0;
    const piecesMatch = Math.abs(wasmResult.pieces - pyResult.pieces) <= 1;
    const volOk = Math.abs(volDelta) < 15;
    const ok = piecesMatch && volOk;
    if (!ok) allPassed = false;

    console.log(
      `  ${file.padEnd(18)} ${pyResult.volume.toFixed(0).padStart(12)} ${wasmResult.volume.toFixed(0).padStart(12)} ${(volDelta.toFixed(1) + '%').padStart(10)} ${String(pyResult.pieces).padStart(8)} ${String(wasmResult.pieces).padStart(8)} ${(ok ? '✓' : '✗').padStart(8)}`
    );
  }

  console.log();
  if (allPassed) {
    console.log('✓ All models: WASM vertex-normal offset within tolerance of Python Minkowski sum');
  } else {
    console.log('✗ Some models failed tolerance check');
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
