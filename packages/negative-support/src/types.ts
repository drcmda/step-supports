/** Flat triangle mesh: interleaved xyz vertices + triangle index triplets. */
export interface ParsedMesh {
  vertices: Float32Array; // flat xyz: [x0,y0,z0, x1,y1,z1, ...]
  faces: Uint32Array;     // flat tri indices: [a0,b0,c0, a1,b1,c1, ...]
}

/** Axis-aligned bounding box. */
export interface BBox {
  min: [number, number, number];
  max: [number, number, number];
}

/** Per B-Rep face metadata from STEP topology. */
export interface STEPFaceInfo {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
  /** Minimum normal Z component across all vertices (most downward-facing). */
  minNormalZ: number;
}

/** Result of STEP parsing: merged mesh + per-face metadata. */
export interface STEPParseResult {
  mesh: ParsedMesh;
  faces: STEPFaceInfo[];
}

/** Progress callback for reporting generation steps. */
export type OnProgress = (step: string, detail?: string) => void;

/** Options for support generation. */
export interface GenerateOptions {
  /** File format. Auto-detected from buffer if omitted. */
  format?: 'stl' | 'obj' | 'step' | 'stp';
  /** Gap between support and model in mm (default: 0.2). */
  margin?: number;
  /** Overhang angle threshold in degrees (default: 45, STEP only). */
  angle?: number;
  /** Minimum piece volume in mm³ (default: 1.0). */
  minVolume?: number;
  /** Optional progress callback. */
  onProgress?: OnProgress;
}

/** Result of support generation. */
export interface SupportResult {
  /** Binary STL of the generated supports. */
  stl: ArrayBuffer;
  /** Statistics about the generated supports. */
  stats: {
    pieces: number;
    faces: number;
    volume: number;
  };
}
