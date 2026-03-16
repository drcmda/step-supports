declare module 'occt-import-js' {
  interface OcctMesh {
    index: { array: Uint32Array };
    attributes: {
      position: { array: Float32Array };
    };
  }
  interface OcctFace {
    first_index: number;
    last_index: number;
  }
  interface OcctResult {
    success: boolean;
    meshes: OcctMesh[];
    faces?: OcctFace[];
  }
  export default function occtimportjs(): Promise<{
    ReadStepFile(buffer: Uint8Array, params: null): OcctResult;
  }>;
}
