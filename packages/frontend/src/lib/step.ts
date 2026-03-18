/**
 * Browser-specific STEP parser wrapper.
 * Uses occt-import-js with explicit WASM URL for browser/worker context.
 * Mesh processing logic is shared with core via processOcctResult.
 */

import type { STEPParseResult } from '@core/types'
import { processOcctResult } from '@core/step-process'
import occtInit from 'occt-import-js'
// @ts-ignore — Vite ?url import for WASM file
import occtWasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url'

export type { STEPParseResult }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let occtInstance: any = null

async function getOcct() {
  if (occtInstance) return occtInstance
  occtInstance = await occtInit({
    locateFile: (path: string) => {
      if (path.endsWith('.wasm')) return occtWasmUrl
      return path
    },
  })
  return occtInstance
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseSTEP(buffer: ArrayBuffer, params?: any): Promise<STEPParseResult> {
  const occt = await getOcct()
  const fileContent = new Uint8Array(buffer)
  const result = occt.ReadStepFile(fileContent, params ?? null)

  if (!result.success || !result.meshes || result.meshes.length === 0) {
    throw new Error('Failed to parse STEP file — no geometry found.')
  }

  return processOcctResult(result.meshes)
}
