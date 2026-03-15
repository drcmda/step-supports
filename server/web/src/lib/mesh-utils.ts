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
