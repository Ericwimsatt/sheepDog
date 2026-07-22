import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskState, PhaseState } from '../types/types.js'

const CHECKPOINT_FILE = '.sheepdog-checkpoint.json'

export interface CheckpointData {
  taskName: string
  status: 'running' | 'failed' | 'completed'
  phases: PhaseState[]
  currentPhaseIndex: number
  startedAt?: string
  completedAt?: string
}

export function checkpointPath(taskDir: string): string {
  return join(taskDir, CHECKPOINT_FILE)
}

export function writeCheckpoint(taskDir: string, state: TaskState): void {
  const data: CheckpointData = {
    taskName: state.taskName,
    status: state.status as CheckpointData['status'],
    phases: state.phases,
    currentPhaseIndex: state.currentPhaseIndex,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
  }
  writeFileSync(checkpointPath(taskDir), JSON.stringify(data, null, 2), 'utf-8')
}

export function loadCheckpoint(taskDir: string): CheckpointData | null {
  const path = checkpointPath(taskDir)
  if (!existsSync(path)) return null

  try {
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw) as CheckpointData
  } catch {
    return null
  }
}

export function clearCheckpoint(taskDir: string): void {
  const path = checkpointPath(taskDir)
  try { unlinkSync(path) } catch {}
}

export function getResumePhaseId(taskDir: string): string | null {
  const cp = loadCheckpoint(taskDir)
  if (!cp) return null

  if (cp.status === 'completed') return null
  if (cp.phases.length === 0) return null

  const lastPhase = cp.phases[cp.phases.length - 1]
  const hasTestFailures = lastPhase.testResults.some(r => !r.passed)
  if (hasTestFailures) return lastPhase.phaseId

  return null
}

export type ResumeDecision = 'resume' | 'restart' | 'abort'

export interface ResumeInfo {
  decision: ResumeDecision
  fromPhase: string | null
  previousFailures: boolean
}
