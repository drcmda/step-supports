/**
 * Binary/ASCII STL parser and binary STL exporter.
 * Zero dependencies — operates on ArrayBuffer/Float32Array/Uint32Array.
 */

import type { ParsedMesh } from './types';

/** Parse an STL file (binary or ASCII) from an ArrayBuffer. */
export function parseSTL(buffer: ArrayBuffer): ParsedMesh {
  const view = new DataView(buffer);
  const header = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength)));
  if (header.startsWith('solid') && buffer.byteLength > 84) {
    const binaryTriCount = view.getUint32(80, true);
    const expectedBinarySize = 84 + binaryTriCount * 50;
    if (Math.abs(expectedBinarySize - buffer.byteLength) <= 1) {
      return parseBinarySTL(view, binaryTriCount);
    }
    try {
      return parseASCIISTL(buffer);
    } catch {
      return parseBinarySTL(view, binaryTriCount);
    }
  }
  const triCount = view.getUint32(80, true);
  return parseBinarySTL(view, triCount);
}

function parseBinarySTL(view: DataView, triCount: number): ParsedMesh {
  const vertMap = new Map<string, number>();
  const verts: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < triCount; i++) {
    const offset = 84 + i * 50;
    for (let v = 0; v < 3; v++) {
      const vOffset = offset + 12 + v * 12;
      const x = view.getFloat32(vOffset, true);
      const y = view.getFloat32(vOffset + 4, true);
      const z = view.getFloat32(vOffset + 8, true);
      const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
      let idx = vertMap.get(key);
      if (idx === undefined) {
        idx = verts.length / 3;
        vertMap.set(key, idx);
        verts.push(x, y, z);
      }
      indices.push(idx);
    }
  }

  return { vertices: new Float32Array(verts), faces: new Uint32Array(indices) };
}

function parseASCIISTL(buffer: ArrayBuffer): ParsedMesh {
  const text = new TextDecoder().decode(new Uint8Array(buffer));
  const vertMap = new Map<string, number>();
  const verts: number[] = [];
  const indices: number[] = [];
  const vertexRegex = /vertex\s+([\-\+]?[\d\.eE\-\+]+)\s+([\-\+]?[\d\.eE\-\+]+)\s+([\-\+]?[\d\.eE\-\+]+)/gi;
  let match;
  let count = 0;

  while ((match = vertexRegex.exec(text)) !== null) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const z = parseFloat(match[3]);
    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
    let idx = vertMap.get(key);
    if (idx === undefined) {
      idx = verts.length / 3;
      vertMap.set(key, idx);
      verts.push(x, y, z);
    }
    indices.push(idx);
    count++;
  }

  if (count === 0 || count % 3 !== 0) {
    throw new Error('Invalid ASCII STL: no triangles found');
  }

  return { vertices: new Float32Array(verts), faces: new Uint32Array(indices) };
}

/** Export a mesh to binary STL format. */
export function exportSTL(mesh: ParsedMesh): ArrayBuffer {
  const triCount = mesh.faces.length / 3;
  const buffer = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buffer);

  const header = new TextEncoder().encode('binary STL exported by negative.support');
  new Uint8Array(buffer, 0, header.length).set(header);
  view.setUint32(80, triCount, true);

  const v = mesh.vertices;
  const f = mesh.faces;

  for (let i = 0; i < triCount; i++) {
    const offset = 84 + i * 50;
    const a = f[i * 3] * 3;
    const b = f[i * 3 + 1] * 3;
    const c = f[i * 3 + 2] * 3;

    const ax = v[b] - v[a], ay = v[b + 1] - v[a + 1], az = v[b + 2] - v[a + 2];
    const bx = v[c] - v[a], by = v[c + 1] - v[a + 1], bz = v[c + 2] - v[a + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

    view.setFloat32(offset, nx / len, true);
    view.setFloat32(offset + 4, ny / len, true);
    view.setFloat32(offset + 8, nz / len, true);

    for (let vi = 0; vi < 3; vi++) {
      const idx = f[i * 3 + vi] * 3;
      const vOff = offset + 12 + vi * 12;
      view.setFloat32(vOff, v[idx], true);
      view.setFloat32(vOff + 4, v[idx + 1], true);
      view.setFloat32(vOff + 8, v[idx + 2], true);
    }

    view.setUint16(offset + 48, 0, true);
  }

  return buffer;
}
