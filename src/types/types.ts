export interface TestCommand {
  command: string
  optional?: boolean
  failOnError?: boolean
}

export interface Phase {
  id: string
  file: string
  label: string
  runAfter: TestCommand[]
}

export interface Task {
  name: string
  phases: Phase[]
  runBeforeAll: TestCommand[]
  runAfterAll: TestCommand[]
  onPhaseFailure: 'stop' | 'continue' | 'attempt fix'
  nudgeInterval: number
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
