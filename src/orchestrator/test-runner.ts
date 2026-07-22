import { spawn } from 'node:child_process'
import type { TestCommand, TestResult } from '../types/types.js'
import { step, warn, error } from '../utils/logger.js'

export interface TestRunnerOptions {
  cwd: string
  env?: Record<string, string>
}

export class TestRunner {
  private options: TestRunnerOptions

  constructor(options: TestRunnerOptions) {
    this.options = options
  }

  async run(commands: TestCommand[]): Promise<TestResult[]> {
    const results: TestResult[] = []

    for (const cmd of commands) {
      step(`Running: ${cmd.command}`)
      const result = await this.executeCommand(cmd.command)
      results.push(result)

      if (!result.passed && !cmd.optional && cmd.failOnError) {
        error(`Command failed: ${cmd.command}`)
        break
      }

      if (!result.passed && cmd.optional) {
        warn(`Optional command failed (ignored): ${cmd.command}`)
      }
    }

    return results
  }

  private async executeCommand(command: string): Promise<TestResult> {
    const parts = command.split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    return new Promise(resolve => {
      const child = spawn(cmd, args, {
        cwd: this.options.cwd,
        env: { ...process.env, ...this.options.env },
        stdio: 'inherit',
        timeout: 300_000,
      })

      child.on('error', err => {
        resolve({
          command,
          exitCode: 1,
          stdout: '',
          stderr: err.message,
          passed: false,
        })
      })

      child.on('exit', code => {
        resolve({
          command,
          exitCode: code ?? 1,
          stdout: '',
          stderr: '',
          passed: code === 0,
        })
      })
    })
  }
}
