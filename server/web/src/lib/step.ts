/**
 * STEP file parser using occt-import-js (OpenCascade WASM).
 *
 * Tessellates B-Rep geometry → triangle mesh compatible with manifold-3d.
 * The WASM binary (7.6 MB) is only loaded when this module is first called.
 *
 * occt-import-js outputs non-indexed meshes (each triangle has unique vertices),
 * so we must deduplicate vertices for manifold-3d to work correctly.
 */

import type { ParsedMesh } from './stl';
import occtInit from 'occt-import-js';

// @ts-ignore — Vite ?url import for WASM file
import occtWasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let occtInstance: any = null;

/** Initialize occt-import-js WASM (cached after first call). */
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

/**
 * Parse a STEP/STP file and return a merged, vertex-deduplicated triangle mesh.
 */
export async function parseSTEP(buffer: ArrayBuffer): Promise<ParsedMesh> {
  const occt = await getOcct();

  const fileContent = new Uint8Array(buffer);
  const result = occt.ReadStepFile(fileContent, null);

  if (!result.success || !result.meshes || result.meshes.length === 0) {
    throw new Error('Failed to parse STEP file — no geometry found.');
  }

  // Collect all positions and indices across meshes
  const allPositions: number[] = [];
  const allRawIndices: number[] = [];
  let globalVertOffset = 0;

  for (const m of result.meshes) {
    const pos = m.attributes.position.array;
    const idx = m.index.array;
    for (let i = 0; i < pos.length; i++) allPositions.push(pos[i]);
    for (let i = 0; i < idx.length; i++) allRawIndices.push(idx[i] + globalVertOffset);
    globalVertOffset += pos.length / 3;
  }

  // Deduplicate vertices (occt-import-js outputs non-shared vertices per face)
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
    vertices: new Float32Array(uniqueVerts),
    faces: remappedIndices,
  };
}
