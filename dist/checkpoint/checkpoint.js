import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
const CHECKPOINT_FILE = '.sheepdog-checkpoint.json';
export function checkpointPath(taskDir) {
    return join(taskDir, CHECKPOINT_FILE);
}
export function writeCheckpoint(taskDir, state) {
    const data = {
        taskName: state.taskName,
        status: state.status,
        phases: state.phases,
        currentPhaseIndex: state.currentPhaseIndex,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
    };
    writeFileSync(checkpointPath(taskDir), JSON.stringify(data, null, 2), 'utf-8');
}
export function loadCheckpoint(taskDir) {
    const path = checkpointPath(taskDir);
    if (!existsSync(path))
        return null;
    try {
        const raw = readFileSync(path, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function clearCheckpoint(taskDir) {
    const path = checkpointPath(taskDir);
    try {
        unlinkSync(path);
    }
    catch { }
}
export function getResumePhaseId(taskDir) {
    const cp = loadCheckpoint(taskDir);
    if (!cp)
        return null;
    if (cp.status === 'completed')
        return null;
    if (cp.phases.length === 0)
        return null;
    const lastPhase = cp.phases[cp.phases.length - 1];
    const hasTestFailures = lastPhase.testResults.some(r => !r.passed);
    if (hasTestFailures)
        return lastPhase.phaseId;
    return null;
}
//# sourceMappingURL=checkpoint.js.map