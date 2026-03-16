/**
 * STEP file parser using occt-import-js (OpenCascade WASM).
 *
 * Tessellates B-Rep geometry → triangle mesh compatible with manifold-3d.
 * The WASM binary (7.6 MB) is only loaded when this module is first called.
 *
 * occt-import-js outputs non-indexed meshes (each triangle has unique vertices),
 * so we must deduplicate vertices for manifold-3d to work correctly.
 *
 * Returns per-face metadata via `brep_faces` (bounding box, min normal Z) for
 * overhang detection — enabling STEP-specific targeted support generation.
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

/** Per-face metadata from STEP B-Rep topology. */
export interface STEPFaceInfo {
  /** Full bounding box of the face */
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
  /** Minimum normal Z component across all vertices (most downward-facing) */
  minNormalZ: number;
}

export interface STEPParseResult {
  mesh: ParsedMesh;
  faces: STEPFaceInfo[];
}

/**
 * Parse a STEP/STP file and return:
 * - A merged, vertex-deduplicated triangle mesh
 * - Per B-Rep face metadata for overhang detection
 */
export async function parseSTEP(buffer: ArrayBuffer): Promise<STEPParseResult> {
  const occt = await getOcct();

  const fileContent = new Uint8Array(buffer);
  const result = occt.ReadStepFile(fileContent, null);

  if (!result.success || !result.meshes || result.meshes.length === 0) {
    throw new Error('Failed to parse STEP file — no geometry found.');
  }

  // Collect all positions and indices across meshes, plus per-face info
  const allPositions: number[] = [];
  const allRawIndices: number[] = [];
  let globalVertOffset = 0;
  const faces: STEPFaceInfo[] = [];

  for (const m of result.meshes) {
    const pos = m.attributes.position.array;
    const idx = m.index.array;
    const norm = m.attributes.normal?.array;

    // Accumulate merged mesh data
    for (let i = 0; i < pos.length; i++) allPositions.push(pos[i]);
    for (let i = 0; i < idx.length; i++) allRawIndices.push(idx[i] + globalVertOffset);

    // Extract per B-Rep face metadata using brep_faces triangle ranges
    if (m.brep_faces) {
      for (const bf of m.brep_faces) {
        let fMinX = Infinity, fMinY = Infinity, fMinZ = Infinity;
        let fMaxX = -Infinity, fMaxY = -Infinity, fMaxZ = -Infinity;
        let minNormalZ = 1.0;

        for (let ti = bf.first; ti <= bf.last; ti++) {
          for (let v = 0; v < 3; v++) {
            const vi = idx[ti * 3 + v];
            const x = pos[vi * 3], y = pos[vi * 3 + 1], z = pos[vi * 3 + 2];
            if (x < fMinX) fMinX = x;
            if (y < fMinY) fMinY = y;
            if (z < fMinZ) fMinZ = z;
            if (x > fMaxX) fMaxX = x;
            if (y > fMaxY) fMaxY = y;
            if (z > fMaxZ) fMaxZ = z;

            if (norm) {
              const nz = norm[vi * 3 + 2];
              if (nz < minNormalZ) minNormalZ = nz;
            }
          }
        }

        // If no normals, compute from triangle cross products
        if (!norm) {
          for (let ti = bf.first; ti <= bf.last; ti++) {
            const a = idx[ti * 3] * 3, b = idx[ti * 3 + 1] * 3, c = idx[ti * 3 + 2] * 3;
            const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
            const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
            const nx = e1y * e2z - e1z * e2y;
            const ny = e1z * e2x - e1x * e2z;
            const nz = e1x * e2y - e1y * e2x;
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            const normalZ = nz / len;
            if (normalZ < minNormalZ) minNormalZ = normalZ;
          }
        }

        faces.push({ minX: fMinX, minY: fMinY, minZ: fMinZ, maxX: fMaxX, maxY: fMaxY, maxZ: fMaxZ, minNormalZ });
      }
    }

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
    mesh: {
      vertices: new Float32Array(uniqueVerts),
      faces: remappedIndices,
    },
    faces,
  };
}
