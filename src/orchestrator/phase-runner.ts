import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { HerdrSessionManager } from '../session/herdr-session.js'
import { buildPhaseContext } from './context-builder.js'
import { doneMarkerPath, activePhasePath, contextFilePath } from '../task/task-loader.js'
import type { Phase, TestResult, PhaseState } from '../types/types.js'
import { info, success, step } from '../utils/logger.js'

export interface PhaseRunnerOptions {
  taskDir: string
  projectRoot: string
  herdr: HerdrSessionManager
  phase: Phase
  previousTestResults?: TestResult[]
}

export class PhaseRunner {
  async run(options: PhaseRunnerOptions): Promise<PhaseState> {
    const { taskDir, projectRoot, herdr, phase, previousTestResults } = options

    const startedAt = new Date().toISOString()

    info(`Preparing context for phase: ${phase.label}`)
    buildPhaseContext({ taskDir, phase, previousTestResults })

    writeFileSync(activePhasePath(taskDir), phase.id, 'utf-8')

    const donePath = doneMarkerPath(taskDir)
    if (existsSync(donePath)) {
      unlinkSync(donePath)
    }

    info(`Launching phase: ${phase.label}`)
    const agentName = `${phase.id}`
    const contextPath = contextFilePath(taskDir, phase.id)
    const agentInfo = await herdr.startAgent(agentName, projectRoot, [
      'opencode',
      '--prompt', `Phase "${phase.label}" has started. Read the instructions in ${contextPath} and follow them. When you have completed all the work, call the \`sheepdog_done\` tool to signal phase completion.`,
      '--auto',
    ], {
      split: 'right',
    })
    success(`Phase started in pane: ${agentInfo.paneId}`)

    step('Waiting for /done marker...')
    await this.waitForDoneMarker(taskDir)

    step('Reading phase output...')
    let output = ''
    try {
      output = await herdr.readPaneOutput(agentInfo.paneId, 'recent')
    } catch {
      step('Could not read pane output (pane may have been closed)')
    }

    step('Closing pane...')
    try {
      await herdr.closePane(agentInfo.paneId)
      success(`Pane ${agentInfo.paneId} closed`)
    } catch {
      step('Could not close pane')
    }

    const completedAt = new Date().toISOString()

    return {
      phaseId: phase.id,
      status: 'completed',
      startedAt,
      completedAt,
      testResults: [],
    }
  }

  private async waitForDoneMarker(taskDir: string, pollMs: number = 500, timeoutMs: number = 0): Promise<void> {
    const donePath = doneMarkerPath(taskDir)
    const startTime = Date.now()

    while (true) {
      if (existsSync(donePath)) {
        unlinkSync(donePath)
        return
      }

      if (timeoutMs > 0 && Date.now() - startTime > timeoutMs) {
        throw new Error(`Timed out waiting for /done marker after ${timeoutMs}ms`)
      }

      await sleep(pollMs)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
