import { unlinkSync } from 'node:fs'
import { HerdrSessionManager } from '../session/herdr-session.js'
import { loadTask, activePhasePath, doneMarkerPath } from '../task/task-loader.js'
import type { LoadedTask } from '../task/task-loader.js'
import { PhaseRunner } from './phase-runner.js'
import { TestRunner } from './test-runner.js'
import type { RunOptions } from '../types/types.js'
import type { PhaseState, TaskState, TestResult } from '../types/types.js'
import { info, success, warn, error } from '../utils/logger.js'

export class Orchestrator {
  private herdr: HerdrSessionManager
  private phaseRunner: PhaseRunner
  private testRunner: TestRunner

  constructor() {
    this.herdr = new HerdrSessionManager()
    this.phaseRunner = new PhaseRunner()
    this.testRunner = new TestRunner({ cwd: process.cwd() })
  }

  async runTask(taskDir: string, options?: RunOptions): Promise<TaskState> {
    const loaded = loadTask(taskDir)
    const { task, projectRoot } = loaded

    info(`Starting task: ${task.name}`)

    const taskState: TaskState = {
      taskName: task.name,
      status: 'running',
      phases: [],
      currentPhaseIndex: 0,
      startedAt: new Date().toISOString(),
    }

    const startIndex = options?.fromPhase
      ? task.phases.findIndex(p => p.id === options.fromPhase)
      : 0

    const runPhases = options?.phase
      ? task.phases.filter(p => p.id === options.phase)
      : task.phases.slice(Math.max(0, startIndex))

    if (runPhases.length === 0) {
      error('No phases to run')
      taskState.status = 'failed'
      return taskState
    }

    let previousTestResults: TestResult[] | undefined

    for (const phase of runPhases) {
      info(`\u2500\u2500 Phase: ${phase.label} \u2500\u2500`)

      const phaseState = await this.phaseRunner.run({
        taskDir,
        projectRoot,
        herdr: this.herdr,
        phase,
        previousTestResults,
      })

      taskState.phases.push(phaseState)
      success(`Phase complete: ${phase.label}`)

      if (task.runBetween && task.runBetween.length > 0) {
        info('Running between-phase tests...')
        const testResults = await this.testRunner.run(task.runBetween)
        phaseState.testResults = testResults

        const hardFailures = testResults.filter(
          r => !r.passed && !task.runBetween.find(tc => tc.command === r.command)?.optional
        )

        if (hardFailures.length > 0) {
          if (task.onTestFailure?.action === 'stop') {
            error('Tests failed and onTestFailure is set to stop. Aborting.')
            taskState.status = 'failed'
            taskState.completedAt = new Date().toISOString()
            return taskState
          }

          warn(`Tests failed, but continuing. Failures will be passed to next phase.`)
          previousTestResults = testResults
        } else {
          previousTestResults = undefined
        }
      }
    }

    if (task.runAfterAll && task.runAfterAll.length > 0) {
      info('Running after-all tests...')
      const finalResults = await this.testRunner.run(task.runAfterAll)
      const failures = finalResults.filter(r => !r.passed)
      if (failures.length > 0) {
        warn(`${failures.length} after-all test(s) failed`)
      } else {
        success('All after-all tests passed')
      }
    }

    this.cleanup(taskDir)

    taskState.status = 'completed'
    taskState.completedAt = new Date().toISOString()
    success(`Task complete: ${task.name}`)
    return taskState
  }

  private cleanup(taskDir: string): void {
    const active = activePhasePath(taskDir)
    const done = doneMarkerPath(taskDir)
    try { unlinkSync(active) } catch {}
    try { unlinkSync(done) } catch {}
  }
}
