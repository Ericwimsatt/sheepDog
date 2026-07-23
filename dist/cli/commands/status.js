import { resolve, basename } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { discoverTasks, loadTask, activePhasePath, contextFilePath } from '../../task/task-loader.js';
import { loadCheckpoint } from '../../checkpoint/checkpoint.js';
import { info, warn } from '../../utils/logger.js';
export async function statusCommand(taskName, options) {
    const projectRoot = resolve(options?.dir ?? process.cwd());
    const tasks = discoverTasks(projectRoot);
    if (tasks.length === 0) {
        info('No sheepdog tasks found.');
        return;
    }
    for (const taskDir of tasks) {
        const loaded = loadTask(taskDir);
        const name = loaded.task.name;
        const hasActive = existsSync(activePhasePath(taskDir));
        const activePhase = hasActive
            ? readFileSync(activePhasePath(taskDir), 'utf-8').trim()
            : null;
        if (taskName && taskName !== name && basename(taskDir) !== taskName)
            continue;
        info(`\nTask: ${name} (${taskDir})`);
        const cp = loadCheckpoint(taskDir);
        if (cp && (cp.status === 'failed' || cp.status === 'running')) {
            warn(`  \u26a0 Checkpoint: ${cp.status} (use \`sheepdog resume ${name}\` to resume)`);
        }
        for (const phase of loaded.task.phases) {
            const contextPath = contextFilePath(taskDir, phase.id);
            const isActive = activePhase === phase.id;
            const completed = existsSync(contextPath) && !isActive;
            let status;
            if (isActive) {
                status = '\u25b6 active';
            }
            else if (completed) {
                const phaseCp = cp?.phases.find(p => p.phaseId === phase.id);
                const failures = phaseCp?.testResults.filter(r => !r.passed) ?? [];
                if (failures.length > 0) {
                    status = `\u2713 done (\u2716 ${failures.length} test failure(s))`;
                }
                else {
                    status = '\u2713 done';
                }
            }
            else {
                status = '\u25cb pending';
            }
            info(`  ${status}  ${phase.id}: ${phase.label}`);
        }
    }
}
//# sourceMappingURL=status.js.map