// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const staging = mkdtempSync(join(root, '.denantle-build-'))
const assets = [
  'index.html',
  'licenses.html',
  'styles.css',
  'language.css',
  'licenses.css',
  'favicon.ico',
  'images',
  'vendor',
  'licenses',
  'source',
  'LICENSE',
  'ARTWORK.md',
  'THIRD_PARTY_NOTICES.md',
  'third-party-manifest.json',
  'README.md',
  'GAMEPLAY_AND_IMPLEMENTATION.md',
]

try {
  for (const config of [
    'tsconfig.json',
    'tsconfig.embedding-worker.json',
    'tsconfig.finnish-worker.json',
  ]) {
    const result = spawnSync(
      process.execPath,
      ['node_modules/typescript/bin/tsc', '-p', config, '--outDir', staging],
      {
        cwd: root,
        stdio: 'inherit',
      },
    )
    if (result.error) throw result.error
    if (result.status !== 0)
      throw new Error(`TypeScript compilation failed: ${config}`)
  }
  for (const asset of assets)
    cpSync(join(root, asset), join(staging, asset), { recursive: true })
  await build({
    absWorkingDir: root,
    entryPoints: ['src/peerjs-session.ts'],
    outfile: join(staging, 'src/peerjs-session.js'),
    external: ['./data-peer.js', './i18n.js', './validation.js'],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    sourcemap: true,
    legalComments: 'linked',
  })
  await build({
    absWorkingDir: root,
    entryPoints: ['src/embedding-worker.ts'],
    outfile: join(staging, 'src/embedding-worker.js'),
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    sourcemap: true,
    // Load the matching WASM module from the files copied below.
    conditions: ['onnxruntime-web-use-extern-wasm'],
  })
  const runtime = dirname(
    fileURLToPath(import.meta.resolve('@huggingface/transformers')),
  )
  const wasm = join(staging, 'vendor/onnx')
  mkdirSync(wasm, { recursive: true })
  for (const file of [
    'ort-wasm-simd-threaded.jsep.mjs',
    'ort-wasm-simd-threaded.jsep.wasm',
  ])
    cpSync(join(runtime, file), join(wasm, file))
  const output = join(root, 'dist')
  mkdirSync(output, { recursive: true })
  for (const entry of readdirSync(output))
    rmSync(join(output, entry), { recursive: true, force: true })
  cpSync(staging, output, { recursive: true })
  console.log('Built static site in dist/')
} finally {
  rmSync(staging, { recursive: true, force: true })
}
