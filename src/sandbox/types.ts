export interface AgentStepOptions {
  planFile: string
}

export interface VerificationOptions {
  script: string
}

export interface VerificationResult {
  passed: boolean
  output: string
}

export interface ShellOptions {
  command: string
  cwd?: string
  timeout?: number
}

export interface CallLogEntry {
  id: string
  name: string
  args: unknown[]
  result: unknown
  completedAt?: string
  skipped?: boolean
}

export interface ScriptCheckpoint {
  taskName: string
  completedCalls: CallLogEntry[]
  startedAt?: string
  completedAt?: string
}

export interface SandboxAPI {
  runAgentStep(opts: AgentStepOptions): Promise<unknown>
  run_verification(opts: VerificationOptions): Promise<VerificationResult>
  run_command(opts: ShellOptions): Promise<{ stdout: string; stderr: string; exitCode: number }>
  checkpoint(name: string): Promise<void>
  run_agent(opts: Record<string, unknown>): Promise<unknown>
  run_function(fn: () => unknown): Promise<unknown>
}
