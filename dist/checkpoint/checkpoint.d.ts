import type { TaskState, PhaseState } from '../types/types.js';
export interface CheckpointData {
    taskName: string;
    status: 'running' | 'failed' | 'completed';
    phases: PhaseState[];
    currentPhaseIndex: number;
    startedAt?: string;
    completedAt?: string;
}
export declare function checkpointPath(taskDir: string): string;
export declare function writeCheckpoint(taskDir: string, state: TaskState): void;
export declare function loadCheckpoint(taskDir: string): CheckpointData | null;
export declare function clearCheckpoint(taskDir: string): void;
export declare function getResumePhaseId(taskDir: string): string | null;
export type ResumeDecision = 'resume' | 'restart' | 'abort';
export interface ResumeInfo {
    decision: ResumeDecision;
    fromPhase: string | null;
    previousFailures: boolean;
}
//# sourceMappingURL=checkpoint.d.ts.map