export interface Task {
  name: string
  phases: Phase[]
  runBetween: TestCommand[]
  runAfterAll: TestCommand[]
  onTestFailure: OnTestFailure
}

export interface Phase {
  id: string
  file: string
  label: string
}

export interface TestCommand {
  command: string
  optional?: boolean
  failOnError?: boolean
}

export interface OnTestFailure {
  action: 'append_to_next_phase' | 'stop'
}

export type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface PhaseState {
  phaseId: string
  status: PhaseStatus
  startedAt?: string
  completedAt?: string
  testResults: TestResult[]
}

export interface TestResult {
  command: string
  exitCode: number
  stdout: string
  stderr: string
  passed: boolean
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface TaskState {
  taskName: string
  status: TaskStatus
  phases: PhaseState[]
  currentPhaseIndex: number
  startedAt?: string
  completedAt?: string
}

export interface AgentInfo {
  paneId: string
  agentName: string
  status: 'running' | 'done' | 'idle' | 'blocked' | 'unknown'
}

export interface RunOptions {
  phase?: string
  fromPhase?: string
}
