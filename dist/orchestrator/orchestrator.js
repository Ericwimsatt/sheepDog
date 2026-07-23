import { unlinkSync } from 'node:fs';
import { HerdrSessionManager } from '../session/herdr-session.js';
import { loadTask, activePhasePath, doneMarkerPath } from '../task/task-loader.js';
import { PhaseRunner } from './phase-runner.js';
import { TestRunner } from './test-runner.js';
import { writeCheckpoint, loadCheckpoint, clearCheckpoint } from '../checkpoint/checkpoint.js';
import { info, success, warn, error } from '../utils/logger.js';
export class Orchestrator {
    herdr;
    phaseRunner;
    testRunner;
    constructor() {
        this.herdr = new HerdrSessionManager();
        this.phaseRunner = new PhaseRunner();
        this.testRunner = new TestRunner({ cwd: process.cwd() });
    }
    async runTask(taskDir, options) {
        const loaded = loadTask(taskDir);
        const { task, projectRoot } = loaded;
        let taskState;
        let previousTestResults;
        if (options?.fromPhase || options?.phase) {
            info(`Starting task: ${task.name}`);
            taskState = {
                taskName: task.name,
                status: 'running',
                phases: [],
                currentPhaseIndex: 0,
                startedAt: new Date().toISOString(),
            };
            if (task.runBeforeAll && task.runBeforeAll.length > 0) {
                info('Running before-all commands...');
                const beforeResults = await this.testRunner.run(task.runBeforeAll);
                const failures = beforeResults.filter(r => !r.passed);
                if (failures.length > 0) {
                    error('runBeforeAll commands failed. Aborting.');
                    taskState.status = 'failed';
                    taskState.completedAt = new Date().toISOString();
                    writeCheckpoint(taskDir, taskState);
                    return taskState;
                }
                success('All before-all commands passed');
            }
        }
        else {
            const cp = loadCheckpoint(taskDir);
            if (cp && (cp.status === 'failed' || cp.status === 'running')) {
                info(`Resuming task: ${task.name} from previous checkpoint (status: ${cp.status})`);
                const lastFailed = [...cp.phases].reverse().find(p => p.testResults.some(r => !r.passed));
                const resumePhaseId = lastFailed?.phaseId ?? cp.phases[cp.phases.length - 1]?.phaseId;
                if (resumePhaseId) {
                    const resumeIdx = cp.phases.findIndex(p => p.phaseId === resumePhaseId);
                    const completedPhases = cp.phases.slice(0, resumeIdx);
                    previousTestResults = cp.phases[resumeIdx]?.testResults?.filter(r => !r.passed).length
                        ? cp.phases[resumeIdx].testResults
                        : undefined;
                    if (previousTestResults) {
                        info(`Previous failures detected in ${resumePhaseId}, passing as context`);
                    }
                    taskState = {
                        taskName: cp.taskName,
                        status: 'running',
                        phases: completedPhases,
                        currentPhaseIndex: completedPhases.length,
                        startedAt: cp.startedAt ?? new Date().toISOString(),
                    };
                }
                else {
                    taskState = {
                        taskName: cp.taskName,
                        status: 'running',
                        phases: [],
                        currentPhaseIndex: 0,
                        startedAt: cp.startedAt ?? new Date().toISOString(),
                    };
                }
            }
            else {
                info(`Starting task: ${task.name}`);
                taskState = {
                    taskName: task.name,
                    status: 'running',
                    phases: [],
                    currentPhaseIndex: 0,
                    startedAt: new Date().toISOString(),
                };
                if (task.runBeforeAll && task.runBeforeAll.length > 0) {
                    info('Running before-all commands...');
                    const beforeResults = await this.testRunner.run(task.runBeforeAll);
                    const failures = beforeResults.filter(r => !r.passed);
                    if (failures.length > 0) {
                        error('runBeforeAll commands failed. Aborting.');
                        taskState.status = 'failed';
                        taskState.completedAt = new Date().toISOString();
                        writeCheckpoint(taskDir, taskState);
                        return taskState;
                    }
                    success('All before-all commands passed');
                }
            }
        }
        const startIndex = options?.fromPhase
            ? task.phases.findIndex(p => p.id === options.fromPhase)
            : options?.phase
                ? task.phases.findIndex(p => p.id === options.phase)
                : taskState.phases.length;
        const runPhases = options?.phase
            ? task.phases.filter(p => p.id === options.phase)
            : task.phases.slice(Math.max(0, startIndex));
        if (runPhases.length === 0) {
            error('No phases to run');
            taskState.status = 'failed';
            writeCheckpoint(taskDir, taskState);
            return taskState;
        }
        for (const phase of runPhases) {
            info(`\u2500\u2500 Phase: ${phase.label} \u2500\u2500`);
            const phaseState = await this.phaseRunner.run({
                taskDir,
                projectRoot,
                herdr: this.herdr,
                phase,
                previousTestResults,
                nudgeInterval: task.nudgeInterval,
            });
            taskState.phases.push(phaseState);
            taskState.currentPhaseIndex = taskState.phases.length;
            writeCheckpoint(taskDir, taskState);
            success(`Phase complete: ${phase.label}`);
            if (phase.runAfter && phase.runAfter.length > 0) {
                info('Running phase after-commands...');
                const testResults = await this.testRunner.run(phase.runAfter);
                phaseState.testResults = testResults;
                writeCheckpoint(taskDir, taskState);
                const hardFailures = testResults.filter(r => !r.passed && !phase.runAfter.find(tc => tc.command === r.command)?.optional);
                if (hardFailures.length > 0) {
                    if (task.onPhaseFailure === 'stop') {
                        error('Tests failed and onPhaseFailure is set to stop. Aborting.');
                        taskState.status = 'failed';
                        taskState.completedAt = new Date().toISOString();
                        writeCheckpoint(taskDir, taskState);
                        return taskState;
                    }
                    if (task.onPhaseFailure === 'attempt fix') {
                        const maxAttempts = 2;
                        let fixed = false;
                        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                            info(`Fix attempt ${attempt}/${maxAttempts} for phase: ${phase.label}`);
                            await this.phaseRunner.runFixAttempt({
                                taskDir,
                                projectRoot,
                                herdr: this.herdr,
                                phase,
                                testResults: phaseState.testResults,
                                attempt,
                                maxAttempts,
                                nudgeInterval: task.nudgeInterval,
                            });
                            info(`Re-running phase after-commands after fix attempt ${attempt}...`);
                            const retestResults = await this.testRunner.run(phase.runAfter);
                            phaseState.testResults = retestResults;
                            writeCheckpoint(taskDir, taskState);
                            const retestFailures = retestResults.filter(r => !r.passed && !phase.runAfter.find(tc => tc.command === r.command)?.optional);
                            if (retestFailures.length === 0) {
                                success(`Fix attempt ${attempt} succeeded!`);
                                fixed = true;
                                previousTestResults = undefined;
                                break;
                            }
                            if (attempt < maxAttempts) {
                                warn(`Fix attempt ${attempt} failed. Retrying...`);
                            }
                        }
                        if (!fixed) {
                            error(`Fix attempts exhausted (${maxAttempts}/${maxAttempts}). Aborting.`);
                            taskState.status = 'failed';
                            taskState.completedAt = new Date().toISOString();
                            writeCheckpoint(taskDir, taskState);
                            return taskState;
                        }
                    }
                    else {
                        warn(`Tests failed, but continuing. Failures will be passed to next phase.`);
                        previousTestResults = testResults;
                    }
                }
                else {
                    previousTestResults = undefined;
                }
            }
        }
        if (task.runAfterAll && task.runAfterAll.length > 0) {
            info('Running after-all tests...');
            const finalResults = await this.testRunner.run(task.runAfterAll);
            const failures = finalResults.filter(r => !r.passed);
            if (failures.length > 0) {
                warn(`${failures.length} after-all test(s) failed`);
            }
            else {
                success('All after-all tests passed');
            }
        }
        clearCheckpoint(taskDir);
        this.cleanup(taskDir);
        taskState.status = 'completed';
        taskState.completedAt = new Date().toISOString();
        success(`Task complete: ${task.name}`);
        return taskState;
    }
    cleanup(taskDir) {
        const active = activePhasePath(taskDir);
        const done = doneMarkerPath(taskDir);
        try {
            unlinkSync(active);
        }
        catch { }
        try {
            unlinkSync(done);
        }
        catch { }
    }
}
//# sourceMappingURL=orchestrator.js.map