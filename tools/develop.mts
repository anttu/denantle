// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { spawn, spawnSync } from 'node:child_process'
import { type FSWatcher, watch } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const build = () =>
  spawnSync(process.execPath, ['tools/build.mts'], {
    cwd: root,
    stdio: 'inherit',
  })
const initial = build()
if (initial.error) throw initial.error
if (initial.status !== 0) process.exit(initial.status || 1)

const server = spawn(process.execPath, ['tools/serve.mts'], {
  cwd: root,
  stdio: 'inherit',
})
const watchers: FSWatcher[] = []
let timer: ReturnType<typeof setTimeout> | undefined
const rebuild = () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const result = build()
    if (result.error) console.error(result.error)
    if (result.status !== 0)
      console.error('Build failed; serving the previous successful build.')
  }, 150)
}
for (const directory of [
  'src',
  'tools',
  'images',
  'vendor',
  'licenses',
  'source',
]) {
  watchers.push(
    watch(
      new URL(`../${directory}/`, import.meta.url),
      { recursive: true },
      rebuild,
    ),
  )
}
watchers.push(
  watch(root, (_event, filename) => {
    if (
      filename &&
      /^(?:tsconfig.*\.json|.*\.(?:html|css|ico|md)|third-party-manifest\.json)$/.test(
        filename,
      )
    )
      rebuild()
  }),
)

function stop(signal: NodeJS.Signals = 'SIGTERM') {
  clearTimeout(timer)
  for (const watcher of watchers) watcher.close()
  if (server.exitCode === null) server.kill(signal)
}
process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop())
server.on('error', (error) => {
  console.error(error)
  stop()
  process.exitCode = 1
})
server.on('exit', (code) => {
  stop()
  process.exitCode = code || 0
})
