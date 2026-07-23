import type { TestCommand, TestResult } from '../types/types.js';
export interface TestRunnerOptions {
    cwd: string;
    env?: Record<string, string>;
}
export declare class TestRunner {
    private options;
    constructor(options: TestRunnerOptions);
    run(commands: TestCommand[]): Promise<TestResult[]>;
    private executeCommand;
}
//# sourceMappingURL=test-runner.d.ts.map