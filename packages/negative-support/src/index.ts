/**
 * negative-support — Generate 3D-print negative-space support structures.
 *
 * Supports STL, OBJ, and STEP files. Uses manifold-3d for boolean operations
 * and vertex-normal offset for mesh inflation.
 *
 * @example
 * ```typescript
 * import { generateSupports } from 'negative-support';
 * import { readFileSync } from 'fs';
 *
 * const buffer = readFileSync('model.stl').buffer;
 * const result = await generateSupports(buffer, { format: 'stl' });
 * // result.stl — ArrayBuffer of support STL
 * // result.stats — { pieces, faces, volume }
 * ```
 */

export type {
  ParsedMesh,
  BBox,
  STEPFaceInfo,
  STEPParseResult,
  GenerateOptions,
  SupportResult,
  OnProgress,
} from './types';

import type { GenerateOptions, SupportResult } from './types';
import { parseSTL } from './stl';
import { parseOBJ } from './obj';
import { getManifold, generateSupportsMesh, generateSupportsSTEP, prepareMesh } from './supports';

export { parseSTL } from './stl';
export { parseOBJ } from './obj';
export { exportSTL } from './stl';

/**
 * Generate negative-space supports from a 3D model.
 *
 * @param buffer — The file content as an ArrayBuffer
 * @param options — Format and parameters
 * @returns Support STL and statistics
 */
export async function generateSupports(
  buffer: ArrayBuffer,
  options: GenerateOptions = {},
): Promise<SupportResult> {
  const {
    format = detectFormat(buffer),
    margin = 0.2,
    angle = 45,
    minVolume = 1.0,
    onProgress,
  } = options;

  // Initialize manifold-3d WASM
  onProgress?.('Initialize');
  await getManifold();

  const fmt = format.toLowerCase();
  if (fmt === 'step' || fmt === 'stp') {
    // STEP pipeline: overhang detection + column extraction
    onProgress?.('Parse', 'STEP');
    const { parseSTEP } = await import('./step');
    const stepResult = await parseSTEP(buffer);
    onProgress?.('Repair');
    const repaired = prepareMesh(stepResult.mesh);
    return generateSupportsSTEP(repaired, stepResult.faces, margin, angle, minVolume, onProgress);
  }

  // Mesh pipeline: full-shell negative space
  onProgress?.('Parse', fmt.toUpperCase());
  let parsed;
  if (fmt === 'stl') {
    parsed = parseSTL(buffer);
  } else if (fmt === 'obj') {
    parsed = parseOBJ(buffer);
  } else {
    throw new Error(`Unsupported format: ${format}. Use 'stl', 'obj', 'step', or 'stp'.`);
  }

  onProgress?.('Repair');
  const repaired = prepareMesh(parsed);
  return generateSupportsMesh(repaired, margin, minVolume, onProgress);
}

/** Try to detect file format from buffer contents. */
function detectFormat(buffer: ArrayBuffer): string {
  const header = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(256, buffer.byteLength)));

  // STEP files start with ISO-10303
  if (header.includes('ISO-10303') || header.includes('STEP;')) return 'step';

  // STL files start with "solid" (ASCII) or have binary header
  if (header.startsWith('solid')) return 'stl';

  // OBJ files contain "v " vertex lines
  if (/^v\s+[\d\-\.]/m.test(header)) return 'obj';

  // Default to STL (binary STL has no magic bytes)
  return 'stl';
}
