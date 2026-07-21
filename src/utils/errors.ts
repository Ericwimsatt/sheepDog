export class SheepDogError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SheepDogError'
  }
}

export class HerdrCommandError extends SheepDogError {
  constructor(cmd: string, exitCode: number, stderr: string) {
    super(`herdr command failed: ${cmd} (exit ${exitCode}): ${stderr}`)
    this.name = 'HerdrCommandError'
  }
}

export class TaskError extends SheepDogError {
  constructor(taskName: string, message: string) {
    super(`[${taskName}] ${message}`)
    this.name = 'TaskError'
  }
}
