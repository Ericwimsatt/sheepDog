export declare class SheepDogError extends Error {
    constructor(message: string);
}
export declare class HerdrCommandError extends SheepDogError {
    constructor(cmd: string, exitCode: number, stderr: string);
}
export declare class TaskError extends SheepDogError {
    constructor(taskName: string, message: string);
}
//# sourceMappingURL=errors.d.ts.map