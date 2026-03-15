declare module 'occt-import-js' {
  interface BRepFace {
    /** First triangle index (inclusive) */
    first: number;
    /** Last triangle index (inclusive) */
    last: number;
    color: [number, number, number] | null;
  }

  interface OcctMesh {
    name: string;
    color?: [number, number, number];
    attributes: {
      position: { array: Float32Array };
      normal?: { array: Float32Array };
    };
    index: { array: Uint32Array };
    /** Per-face triangle ranges from B-Rep topology */
    brep_faces: BRepFace[];
  }

  interface OcctResult {
    success: boolean;
    root: { name: string; meshes: number[]; children: unknown[] };
    meshes: OcctMesh[];
  }

  interface OcctInstance {
    ReadStepFile(content: Uint8Array, params: null): OcctResult;
  }

  type OcctInitFn = (options?: { locateFile?: (path: string) => string }) => Promise<OcctInstance>;
  const init: OcctInitFn;
  export default init;
}
