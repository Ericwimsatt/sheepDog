export class SheepDogError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SheepDogError';
    }
}
export class HerdrCommandError extends SheepDogError {
    constructor(cmd, exitCode, stderr) {
        super(`herdr command failed: ${cmd} (exit ${exitCode}): ${stderr}`);
        this.name = 'HerdrCommandError';
    }
}
export class TaskError extends SheepDogError {
    constructor(taskName, message) {
        super(`[${taskName}] ${message}`);
        this.name = 'TaskError';
    }
}
//# sourceMappingURL=errors.js.map