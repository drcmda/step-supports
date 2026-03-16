/**
 * Mesh utility functions: bounding box, signed volume, z-translation, inflation.
 */

import type { ParsedMesh } from './stl';

export interface BBox {
  min: [number, number, number];
  max: [number, number, number];
}

/** Compute axis-aligned bounding box. */
export function computeBBox(vertices: Float32Array): BBox {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertices.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const v = vertices[i + j];
      if (v < min[j]) min[j] = v;
      if (v > max[j]) max[j] = v;
    }
  }
  return { min, max };
}

/** Compute signed volume of a closed mesh using the divergence theorem. */
export function computeVolume(mesh: ParsedMesh): number {
  const v = mesh.vertices;
  const f = mesh.faces;
  let vol = 0;
  for (let i = 0; i < f.length; i += 3) {
    const a = f[i] * 3, b = f[i + 1] * 3, c = f[i + 2] * 3;
    vol +=
      v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) +
      v[a + 1] * (v[b + 2] * v[c] - v[b] * v[c + 2]) +
      v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]);
  }
  return Math.abs(vol / 6);
}

/** Translate all vertices in-place along Z. */
export function translateZ(vertices: Float32Array, dz: number): void {
  for (let i = 2; i < vertices.length; i += 3) {
    vertices[i] += dz;
  }
}

/**
 * Repair a mesh to be manifold-safe:
 * 1. Remove degenerate (zero-area) faces
 * 2. Remove duplicate faces
 * 3. Remove faces causing non-manifold edges (>2 faces per edge)
 * 4. Fill small boundary holes (edges with only 1 face)
 * 5. Remove unreferenced vertices
 *
 * Mirrors Python's _repair_mesh + trimesh.repair behavior.
 */
export function repairMesh(mesh: ParsedMesh): ParsedMesh {
  const v = mesh.vertices;
  const f = mesh.faces;
  const numTri = f.length / 3;

  // --- Pass 1: Remove degenerate faces and track edges ---
  const keep: boolean[] = new Array(numTri).fill(true);
  const faceSet = new Set<string>();

  for (let i = 0; i < numTri; i++) {
    const a = f[i * 3], b = f[i * 3 + 1], c = f[i * 3 + 2];

    // Degenerate: repeated vertex
    if (a === b || b === c || a === c) {
      keep[i] = false;
      continue;
    }

    // Degenerate: zero area
    const ai = a * 3, bi = b * 3, ci = c * 3;
    const e1x = v[bi] - v[ai], e1y = v[bi + 1] - v[ai + 1], e1z = v[bi + 2] - v[ai + 2];
    const e2x = v[ci] - v[ai], e2y = v[ci + 1] - v[ai + 1], e2z = v[ci + 2] - v[ai + 2];
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    if (nx * nx + ny * ny + nz * nz < 1e-16) {
      keep[i] = false;
      continue;
    }

    // Duplicate face
    const sorted = [a, b, c].sort((x, y) => x - y);
    const faceKey = `${sorted[0]},${sorted[1]},${sorted[2]}`;
    if (faceSet.has(faceKey)) {
      keep[i] = false;
      continue;
    }
    faceSet.add(faceKey);
  }

  // Build edge map from kept faces only
  const edgeFaces = new Map<string, number[]>();
  for (let i = 0; i < numTri; i++) {
    if (!keep[i]) continue;
    const a = f[i * 3], b = f[i * 3 + 1], c = f[i * 3 + 2];
    const edges: [number, number][] = [[a, b], [b, c], [c, a]];
    for (const [ea, eb] of edges) {
      const ek = ea < eb ? `${ea},${eb}` : `${eb},${ea}`;
      const list = edgeFaces.get(ek);
      if (list) list.push(i);
      else edgeFaces.set(ek, [i]);
    }
  }

  // --- Pass 2: Remove faces creating non-manifold edges (>2 faces per edge) ---
  for (const [, faceIndices] of edgeFaces) {
    if (faceIndices.length > 2) {
      for (let j = 2; j < faceIndices.length; j++) {
        keep[faceIndices[j]] = false;
      }
    }
  }

  // --- Rebuild kept faces ---
  const keptFaces: number[] = [];
  for (let i = 0; i < numTri; i++) {
    if (keep[i]) {
      keptFaces.push(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]);
    }
  }

  // --- Rebuild edge map after removals for hole filling ---
  const edgeFaces2 = new Map<string, number>();
  const keptTris = keptFaces.length / 3;
  for (let i = 0; i < keptTris; i++) {
    const a = keptFaces[i * 3], b = keptFaces[i * 3 + 1], c = keptFaces[i * 3 + 2];
    const edges: [number, number][] = [[a, b], [b, c], [c, a]];
    for (const [ea, eb] of edges) {
      const ek = ea < eb ? `${ea},${eb}` : `${eb},${ea}`;
      edgeFaces2.set(ek, (edgeFaces2.get(ek) || 0) + 1);
    }
  }

  // --- Pass 3: Fill small boundary holes ---
  // Find boundary edges (shared by only 1 face) and try to fill with fan triangulation
  const boundaryEdges: [number, number][] = [];
  for (const [ek, count] of edgeFaces2) {
    if (count === 1) {
      const [a, b] = ek.split(',').map(Number);
      boundaryEdges.push([a, b]);
    }
  }

  if (boundaryEdges.length > 0 && boundaryEdges.length <= 100) {
    // Build boundary loops from boundary edges
    const adj = new Map<number, number[]>();
    for (const [a, b] of boundaryEdges) {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a)!.push(b);
      adj.get(b)!.push(a);
    }

    // Walk boundary loops and triangulate them
    const visited = new Set<number>();
    for (const [startVert] of adj) {
      if (visited.has(startVert)) continue;

      // Walk the loop
      const loop: number[] = [];
      let current = startVert;
      let prev = -1;
      let valid = true;

      while (true) {
        if (visited.has(current) && current !== startVert) { valid = false; break; }
        visited.add(current);
        loop.push(current);

        const neighbors = adj.get(current)!;
        // Each boundary vertex should have exactly 2 boundary neighbors
        if (neighbors.length !== 2) { valid = false; break; }

        const next = neighbors[0] === prev ? neighbors[1] : neighbors[0];
        prev = current;
        current = next;

        if (current === startVert) break;
        if (loop.length > 1000) { valid = false; break; }
      }

      // Triangulate the loop with a fan from vertex 0
      if (valid && loop.length >= 3) {
        for (let i = 1; i < loop.length - 1; i++) {
          keptFaces.push(loop[0], loop[i], loop[i + 1]);
        }
      }
    }
  }

  const changed = keptFaces.length !== f.length;
  if (!changed) return mesh;

  // --- Compact vertices ---
  const usedVerts = new Set(keptFaces);
  const vertMap = new Map<number, number>();
  const newVerts: number[] = [];
  for (const vi of usedVerts) {
    vertMap.set(vi, newVerts.length / 3);
    newVerts.push(v[vi * 3], v[vi * 3 + 1], v[vi * 3 + 2]);
  }

  const newFaces = new Uint32Array(keptFaces.length);
  for (let i = 0; i < keptFaces.length; i++) {
    newFaces[i] = vertMap.get(keptFaces[i])!;
  }

  return {
    vertices: new Float32Array(newVerts),
    faces: newFaces,
  };
}

/**
 * Inflate a mesh by moving each vertex outward along its averaged vertex normal.
 * This approximates Minkowski sum with a sphere of radius `margin`.
 * At small margins (0.1-0.5mm) this is effectively identical.
 */
export function inflateMesh(mesh: ParsedMesh, margin: number): ParsedMesh {
  const v = mesh.vertices;
  const f = mesh.faces;
  const numVerts = v.length / 3;

  // Accumulate face normals per vertex
  const normals = new Float32Array(v.length); // initialized to 0

  for (let i = 0; i < f.length; i += 3) {
    const ai = f[i] * 3, bi = f[i + 1] * 3, ci = f[i + 2] * 3;

    // Edge vectors
    const e1x = v[bi] - v[ai], e1y = v[bi + 1] - v[ai + 1], e1z = v[bi + 2] - v[ai + 2];
    const e2x = v[ci] - v[ai], e2y = v[ci + 1] - v[ai + 1], e2z = v[ci + 2] - v[ai + 2];

    // Cross product (face normal, not normalized — area-weighted)
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    // Accumulate onto each vertex
    for (const vi of [ai, bi, ci]) {
      normals[vi] += nx;
      normals[vi + 1] += ny;
      normals[vi + 2] += nz;
    }
  }

  // Normalize and offset
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
