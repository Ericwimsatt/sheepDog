import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

import type { CallLogEntry, ScriptCheckpoint } from './types.js'

const CHECKPOINT_FILE = '.sheepdog-checkpoint.json'

export function checkpointPath(taskDir: string): string {
  return join(taskDir, CHECKPOINT_FILE)
}

export function computeCallId(name: string, args: unknown[]): string {
  const hash = createHash('sha256')
  hash.update(name)
  hash.update(JSON.stringify(args))
  return hash.digest('hex')
}

export function loadScriptCheckpoint(taskDir: string): ScriptCheckpoint {
  const path = checkpointPath(taskDir)
  if (!existsSync(path)) return { taskName: '', completedCalls: [] }
  try {
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw) as ScriptCheckpoint
  } catch {
    return { taskName: '', completedCalls: [] }
  }
}

export function saveScriptCheckpoint(taskDir: string, cp: ScriptCheckpoint): void {
  writeFileSync(checkpointPath(taskDir), JSON.stringify(cp, null, 2), 'utf-8')
}

export function clearScriptCheckpoint(taskDir: string): void {
  const path = checkpointPath(taskDir)
  try { unlinkSync(path) } catch {}
}

export function hasCompletedCall(cp: ScriptCheckpoint, id: string): CallLogEntry | undefined {
  return cp.completedCalls.find(entry => entry.id === id)
}

export function recordCompletedCall(
  cp: ScriptCheckpoint,
  id: string,
  name: string,
  args: unknown[],
  result: unknown,
): void {
  cp.completedCalls.push({
    id,
    name,
    args,
    result,
    completedAt: new Date().toISOString(),
  })
}

export function recordSkippedCall(
  cp: ScriptCheckpoint,
  id: string,
  name: string,
  args: unknown[],
  result: unknown,
): void {
  cp.completedCalls.push({
    id,
    name,
    args,
    result,
    skipped: true,
  })
}
