// Type declarations for the @sheepdog/sandbox module
// This file is copied into .sheepdog/ to provide editor support

declare module '@sheepdog/sandbox' {
  export interface AgentStepOptions {
    agent: 'opencode' | string
    plan: string
    on_verification_fail?: 'fix' | 'stop' | 'continue'
    checkpoint_on_complete?: boolean
  }

  export interface VerificationOptions {
    path: string
  }

  export interface ShellOptions {
    command: string
    cwd?: string
    optional?: boolean
  }

  export function runAgentStep(opts: AgentStepOptions): Promise<{ completed: boolean }>
  export function run_verification(opts: VerificationOptions): Promise<{ success: boolean; output: string }>
  export function run_command(opts: ShellOptions): Promise<{ exitCode: number; stdout: string; stderr: string }>
  export function checkpoint(name: string): Promise<void>
  export function run_agent(opts: { agent: string; instructions: string }): Promise<{ output: string }>
  export function run_function(fn: () => Promise<void>): Promise<void>
}
