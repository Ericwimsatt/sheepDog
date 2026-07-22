import { writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { SHEEPDOG_DIR } from '../constants.js'

export function findActiveSheepDogTask(cwd: string): string | null {
  let dir = resolve(cwd)

  for (let i = 0; i < 10; i++) {
    const sheepdogDir = resolve(dir, SHEEPDOG_DIR)
    if (existsSync(sheepdogDir)) {
      const entries = readdirSimple(sheepdogDir)
      for (const entry of entries) {
        const taskDir = resolve(sheepdogDir, entry)
        const activePhaseFile = resolve(taskDir, '.active-phase')
        if (existsSync(activePhaseFile)) {
          return taskDir
        }
      }
    }

    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return null
}

export function writeDoneMarker(taskDir: string): void {
  writeFileSync(resolve(taskDir, '.phase-done'), Date.now().toString(), 'utf-8')
}

export function isDoneCommand(message: { text?: string; from?: string }): boolean {
  return (
    message.text?.trim() === '/done' &&
    (message.from === 'user' || message.from === undefined)
  )
}

function readdirSimple(dir: string): string[] {
  try {
    return readdirSync(dir).filter((entry: string) => {
      try { return statSync(resolve(dir, entry)).isDirectory() } catch { return false }
    })
  } catch {
    return []
  }
}
