import type { RunOptions } from '../types/types.js';
import type { TaskState } from '../types/types.js';
export declare class Orchestrator {
    private herdr;
    private phaseRunner;
    private testRunner;
    constructor();
    runTask(taskDir: string, options?: RunOptions): Promise<TaskState>;
    private cleanup;
}
//# sourceMappingURL=orchestrator.d.ts.map