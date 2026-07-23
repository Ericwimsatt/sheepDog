export interface TaskSearchResult {
    taskDir: string | null;
    diagnostics: string[];
}
export declare function findActiveSheepDogTask(cwd: string): string | null;
export declare function findActiveSheepDogTaskWithDiagnostics(cwd: string): TaskSearchResult;
export declare function writeDoneMarker(taskDir: string): void;
export declare function isDoneCommand(message: {
    text?: string;
    from?: string;
}): boolean;
//# sourceMappingURL=done-handler.d.ts.map