import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { SHEEPDOG_DIR } from '../constants.js'

export function debugLog(msg: string, taskDir?: string): void {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${msg}\n`

  process.stderr.write(`\x1b[34m[sheepdog:debug]\x1b[0m ${line}`)

  if (taskDir) {
    try {
      appendFileSync(join(taskDir, '.sheepdog-debug.log'), line, 'utf-8')
    } catch {
      // debug log file write is best-effort
    }
  }
}
