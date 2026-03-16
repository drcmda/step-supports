/**
 * Simple OBJ parser. Handles v/f lines, triangulates quads.
 */

import type { ParsedMesh } from './stl';

/** Parse an OBJ file from an ArrayBuffer. */
export function parseOBJ(buffer: ArrayBuffer): ParsedMesh {
  const text = new TextDecoder().decode(new Uint8Array(buffer));
  const lines = text.split('\n');

  const verts: number[] = [];
  const indices: number[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('v ')) {
      const parts = line.split(/\s+/);
      verts.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
    } else if (line.startsWith('f ')) {
      const parts = line.split(/\s+/).slice(1);
      // Parse vertex indices (handle v, v/vt, v/vt/vn, v//vn formats)
      const faceIdx = parts.map((p) => {
        const idx = parseInt(p.split('/')[0], 10);
        // OBJ is 1-indexed, convert to 0-indexed; handle negative indices
        return idx > 0 ? idx - 1 : verts.length / 3 + idx;
      });
      // Triangulate (fan from first vertex)
      for (let i = 1; i < faceIdx.length - 1; i++) {
        indices.push(faceIdx[0], faceIdx[i], faceIdx[i + 1]);
      }
    }
  }

  if (verts.length === 0) {
    throw new Error('Invalid OBJ: no vertices found');
  }

  return {
    vertices: new Float32Array(verts),
    faces: new Uint32Array(indices),
  };
}
