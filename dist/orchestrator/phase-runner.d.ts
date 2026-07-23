import { HerdrSessionManager } from '../session/herdr-session.js';
import type { Phase, TestResult, PhaseState } from '../types/types.js';
export interface PhaseRunnerOptions {
    taskDir: string;
    projectRoot: string;
    herdr: HerdrSessionManager;
    phase: Phase;
    previousTestResults?: TestResult[];
    nudgeInterval?: number;
}
export declare class PhaseRunner {
    run(options: PhaseRunnerOptions): Promise<PhaseState>;
    runFixAttempt(options: {
        taskDir: string;
        projectRoot: string;
        herdr: HerdrSessionManager;
        phase: Phase;
        testResults: TestResult[];
        attempt: number;
        maxAttempts: number;
        nudgeInterval?: number;
    }): Promise<void>;
    waitForDoneMarker(taskDir: string, pollMs?: number, timeoutMs?: number): Promise<void>;
}
//# sourceMappingURL=phase-runner.d.ts.map