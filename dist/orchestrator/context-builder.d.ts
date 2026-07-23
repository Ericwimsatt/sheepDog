import type { Phase, TestResult } from '../types/types.js';
export interface ContextBuilderOptions {
    taskDir: string;
    phase: Phase;
    previousTestResults?: TestResult[];
}
export declare function buildPhaseContext(options: ContextBuilderOptions): string;
export declare function buildFixContext(options: {
    taskDir: string;
    phase: Phase;
    testResults: TestResult[];
    attempt: number;
    maxAttempts: number;
}): string;
//# sourceMappingURL=context-builder.d.ts.map