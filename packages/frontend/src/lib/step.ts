/**
 * Browser-specific STEP parser wrapper.
 * Uses occt-import-js with explicit WASM URL for browser/worker context.
 * The actual parsing logic lives in @core/step.ts but its WASM init
 * doesn't work in browsers, so we override it here.
 */

import type { ParsedMesh, STEPFaceInfo, STEPParseResult } from '@core/types';
import occtInit from 'occt-import-js';
// @ts-ignore — Vite ?url import for WASM file
import occtWasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';

export type { STEPFaceInfo, STEPParseResult };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let occtInstance: any = null;

async function getOcct() {
  if (occtInstance) return occtInstance;
  occtInstance = await occtInit({
    locateFile: (path: string) => {
      if (path.endsWith('.wasm')) return occtWasmUrl;
      return path;
    },
  });
  return occtInstance;
}

export async function parseSTEP(buffer: ArrayBuffer): Promise<STEPParseResult> {
  const occt = await getOcct();
  const fileContent = new Uint8Array(buffer);
  const result = occt.ReadStepFile(fileContent, null);

  if (!result.success || !result.meshes || result.meshes.length === 0) {
    throw new Error('Failed to parse STEP file — no geometry found.');
  }

  const allPositions: number[] = [];
  const allRawIndices: number[] = [];
  let globalVertOffset = 0;
  const faces: STEPFaceInfo[] = [];

  for (const m of result.meshes) {
    const pos = m.attributes.position.array;
    const idx = m.index.array;
    const norm = m.attributes.normal?.array;

    for (let i = 0; i < pos.length; i++) allPositions.push(pos[i]);
    for (let i = 0; i < idx.length; i++) allRawIndices.push(idx[i] + globalVertOffset);

    if (m.brep_faces) {
      for (const bf of m.brep_faces) {
        let fMinX = Infinity, fMinY = Infinity, fMinZ = Infinity;
        let fMaxX = -Infinity, fMaxY = -Infinity, fMaxZ = -Infinity;
        let minNormalZ = 1.0;

        for (let ti = bf.first; ti <= bf.last; ti++) {
          for (let v = 0; v < 3; v++) {
            const vi = idx[ti * 3 + v];
            const x = pos[vi * 3], y = pos[vi * 3 + 1], z = pos[vi * 3 + 2];
            if (x < fMinX) fMinX = x; if (y < fMinY) fMinY = y; if (z < fMinZ) fMinZ = z;
            if (x > fMaxX) fMaxX = x; if (y > fMaxY) fMaxY = y; if (z > fMaxZ) fMaxZ = z;
            if (norm) { const nz = norm[vi * 3 + 2]; if (nz < minNormalZ) minNormalZ = nz; }
          }
        }

        if (!norm) {
          for (let ti = bf.first; ti <= bf.last; ti++) {
            const a = idx[ti * 3] * 3, b = idx[ti * 3 + 1] * 3, c = idx[ti * 3 + 2] * 3;
            const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
            const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
            const nx = e1y * e2z - e1z * e2y;
            const ny = e1z * e2x - e1x * e2z;
            const nz = e1x * e2y - e1y * e2x;
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            if (nz / len < minNormalZ) minNormalZ = nz / len;
          }
        }

        faces.push({ minX: fMinX, minY: fMinY, minZ: fMinZ, maxX: fMaxX, maxY: fMaxY, maxZ: fMaxZ, minNormalZ });
      }
    }
    globalVertOffset += pos.length / 3;
  }

  const vertMap = new Map<string, number>();
  const uniqueVerts: number[] = [];
  const remappedIndices = new Uint32Array(allRawIndices.length);

  for (let i = 0; i < allRawIndices.length; i++) {
    const vi = allRawIndices[i] * 3;
    const x = allPositions[vi], y = allPositions[vi + 1], z = allPositions[vi + 2];
    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
    let idx = vertMap.get(key);
    if (idx === undefined) {
      idx = uniqueVerts.length / 3;
      uniqueVerts.push(x, y, z);
      vertMap.set(key, idx);
    }
    remappedIndices[i] = idx;
  }

  return {
    mesh: { vertices: new Float32Array(uniqueVerts), faces: remappedIndices },
    faces,
  };
}
