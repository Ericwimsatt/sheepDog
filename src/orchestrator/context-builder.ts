import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Phase, TestResult } from '../types/types.js'
import { phaseFilePath, contextFilePath } from '../task/task-loader.js'

export interface ContextBuilderOptions {
  taskDir: string
  phase: Phase
  previousTestResults?: TestResult[]
}

export function buildPhaseContext(options: ContextBuilderOptions): string {
  const { taskDir, phase, previousTestResults } = options

  const todoPath = phaseFilePath(taskDir, phase)
  const todoContent = existsSync(todoPath)
    ? readFileSync(todoPath, 'utf-8')
    : '# No instructions provided\n'

  const lines: string[] = []

  lines.push(`# Phase: ${phase.label}`)
  lines.push('')
  lines.push('## Instructions')
  lines.push('')
  lines.push(todoContent.trim())
  lines.push('')

  if (previousTestResults && previousTestResults.length > 0) {
    const failures = previousTestResults.filter(r => !r.passed)
    if (failures.length > 0) {
      lines.push('---')
      lines.push('')
      lines.push('## Previous Phase Test Failures')
      lines.push('')
      lines.push('The following tests failed in the previous phase. Please address these before proceeding.')
      lines.push('')

      for (const failure of failures) {
        lines.push(`### \`${failure.command}\` (exit code ${failure.exitCode})`)
        lines.push('')
        lines.push('```')
        if (failure.stdout) {
          lines.push(failure.stdout)
        }
        if (failure.stderr) {
          lines.push(failure.stderr)
        }
        if (!failure.stdout && !failure.stderr) {
          lines.push('(no output)')
        }
        lines.push('```')
        lines.push('')
      }
    }
  }

  const content = lines.join('\n')
  const outputPath = contextFilePath(taskDir, phase.id)
  writeFileSync(outputPath, content, 'utf-8')

  return outputPath
}
