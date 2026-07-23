import type { Task, Phase } from '../types/types.js';
export interface LoadedTask {
    task: Task;
    taskDir: string;
    projectRoot: string;
}
export declare function discoverTasks(projectRoot: string): string[];
export declare function loadTask(taskDir: string): LoadedTask;
export declare function loadTaskByName(projectRoot: string, name: string): LoadedTask;
export declare function phaseFilePath(taskDir: string, phase: Phase): string;
export declare function contextFilePath(taskDir: string, phaseId: string): string;
export declare function fixContextFilePath(taskDir: string, phaseId: string, attempt: number): string;
export declare function doneMarkerPath(taskDir: string): string;
export declare function activePhasePath(taskDir: string): string;
//# sourceMappingURL=task-loader.d.ts.map