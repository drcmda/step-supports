/**
 * 3MF export with slicer config for supports.
 *
 * A 3MF file is a ZIP containing XML. We create it manually using
 * the ZIP STORE method (no compression) to avoid any dependencies.
 *
 * Objects:
 *   1. "Model" — the input geometry
 *   2. "Supports" — generated supports with per-object slicer settings
 *
 * Slicer settings (same as Python):
 *   - wall_loops: 1
 *   - sparse_infill_density: 15%
 *   - sparse_infill_pattern: cubic
 */

import type { ParsedMesh } from './stl';

/** Export a 3MF file containing model + supports meshes. */
export function export3MF(model: ParsedMesh, supports: ParsedMesh): ArrayBuffer {
  const modelXml = build3DModel(model, supports);
  const contentTypes = buildContentTypes();
  const rels = buildRels();
  const slicerConfig = buildSlicerConfig(1, 2);

  const files: [string, Uint8Array][] = [
    ['[Content_Types].xml', encode(contentTypes)],
    ['_rels/.rels', encode(rels)],
    ['3D/3dmodel.model', encode(modelXml)],
    ['Metadata/model_settings.config', encode(slicerConfig)],
    ['Metadata/Slic3r_PE_model.config', encode(slicerConfig)],
  ];

  return createZip(files);
}

function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function meshToXml(mesh: ParsedMesh, id: number, name: string): string {
  const verts = mesh.vertices;
  const faces = mesh.faces;
  const numVerts = verts.length / 3;
  const numTris = faces.length / 3;

  const lines: string[] = [];
  lines.push(`    <object id="${id}" type="model" name="${name}">`);
  lines.push('      <mesh>');
  lines.push('        <vertices>');
  for (let i = 0; i < numVerts; i++) {
    lines.push(`          <vertex x="${verts[i * 3]}" y="${verts[i * 3 + 1]}" z="${verts[i * 3 + 2]}" />`);
  }
  lines.push('        </vertices>');
  lines.push('        <triangles>');
  for (let i = 0; i < numTris; i++) {
    lines.push(`          <triangle v1="${faces[i * 3]}" v2="${faces[i * 3 + 1]}" v3="${faces[i * 3 + 2]}" />`);
  }
  lines.push('        </triangles>');
  lines.push('      </mesh>');
  lines.push('    </object>');
  return lines.join('\n');
}

function build3DModel(model: ParsedMesh, supports: ParsedMesh): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    '  <resources>',
    meshToXml(model, 1, 'Model'),
    meshToXml(supports, 2, 'Supports'),
    '  </resources>',
    '  <build>',
    '    <item objectid="1" />',
    '    <item objectid="2" />',
    '  </build>',
    '</model>',
  ].join('\n');
}

function buildContentTypes(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />',
    '  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />',
    '  <Default Extension="config" ContentType="text/xml" />',
    '</Types>',
  ].join('\n');
}

function buildRels(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />',
    '</Relationships>',
  ].join('\n');
}

function buildSlicerConfig(modelId: number, supportsId: number): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<config>',
    `  <object id="${modelId}">`,
    '    <metadata key="name" value="Model"/>',
    '  </object>',
    `  <object id="${supportsId}">`,
    '    <metadata key="name" value="Supports"/>',
    '    <metadata key="wall_loops" value="1"/>',
    '    <metadata key="sparse_infill_density" value="15%"/>',
    '    <metadata key="sparse_infill_pattern" value="cubic"/>',
    '  </object>',
    '</config>',
  ].join('\n');
}

// ── Minimal ZIP writer (STORE method, no compression) ────────────────

function createZip(files: [string, Uint8Array][]): ArrayBuffer {
  const entries: { name: Uint8Array; data: Uint8Array; offset: number }[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  // Local file headers + data
  for (const [name, data] of files) {
    const nameBytes = encode(name);
    const header = new ArrayBuffer(30);
    const hv = new DataView(header);
    hv.setUint32(0, 0x04034b50, true);  // local file header signature
    hv.setUint16(4, 20, true);           // version needed
    hv.setUint16(6, 0, true);            // flags
    hv.setUint16(8, 0, true);            // compression: STORE
    hv.setUint16(10, 0, true);           // mod time
    hv.setUint16(12, 0, true);           // mod date
    hv.setUint32(14, crc32(data), true); // CRC-32
    hv.setUint32(18, data.length, true); // compressed size
    hv.setUint32(22, data.length, true); // uncompressed size
    hv.setUint16(26, nameBytes.length, true); // name length
    hv.setUint16(28, 0, true);           // extra field length

    const headerBytes = new Uint8Array(header);
    entries.push({ name: nameBytes, data, offset });
    chunks.push(headerBytes, nameBytes, data);
    offset += 30 + nameBytes.length + data.length;
  }

  // Central directory
  const cdStart = offset;
  for (const entry of entries) {
    const cd = new ArrayBuffer(46);
    const cv = new DataView(cd);
    cv.setUint32(0, 0x02014b50, true);  // central directory header
    cv.setUint16(4, 20, true);           // version made by
    cv.setUint16(6, 20, true);           // version needed
    cv.setUint16(8, 0, true);            // flags
    cv.setUint16(10, 0, true);           // compression: STORE
    cv.setUint16(12, 0, true);           // mod time
    cv.setUint16(14, 0, true);           // mod date
    cv.setUint32(16, crc32(entry.data), true); // CRC-32
    cv.setUint32(20, entry.data.length, true); // compressed size
    cv.setUint32(24, entry.data.length, true); // uncompressed size
    cv.setUint16(28, entry.name.length, true); // name length
    cv.setUint16(30, 0, true);           // extra field length
    cv.setUint16(32, 0, true);           // comment length
    cv.setUint16(34, 0, true);           // disk start
    cv.setUint16(36, 0, true);           // internal attrs
    cv.setUint32(38, 0, true);           // external attrs
    cv.setUint32(42, entry.offset, true); // local header offset

    chunks.push(new Uint8Array(cd), entry.name);
    offset += 46 + entry.name.length;
  }

  // End of central directory
  const cdSize = offset - cdStart;
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);    // EOCD signature
  ev.setUint16(4, 0, true);              // disk number
  ev.setUint16(6, 0, true);              // disk with CD
  ev.setUint16(8, entries.length, true);  // entries on disk
  ev.setUint16(10, entries.length, true); // total entries
  ev.setUint32(12, cdSize, true);         // CD size
  ev.setUint32(16, cdStart, true);        // CD offset
  ev.setUint16(20, 0, true);             // comment length
  chunks.push(new Uint8Array(eocd));

  // Merge all chunks
  const totalSize = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result.buffer;
}

// CRC-32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
