declare module 'occt-import-js' {
  interface OcctMesh {
    index: { array: Uint32Array };
    attributes: {
      position: { array: Float32Array };
      normal?: { array: Float32Array };
    };
    brep_faces?: Array<{ first: number; last: number }>;
  }
  interface OcctResult {
    success: boolean;
    meshes: OcctMesh[];
  }
  interface OcctInitOptions {
    locateFile?: (path: string) => string;
  }
  export default function occtimportjs(options?: OcctInitOptions): Promise<{
    ReadStepFile(buffer: Uint8Array, params: null): OcctResult;
  }>;
}

declare module 'occt-import-js/dist/occt-import-js.wasm?url' {
  const url: string;
  export default url;
}
