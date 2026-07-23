import { resolve } from 'node:path';
import { Orchestrator } from '../../orchestrator/index.js';
import { loadTaskByName, discoverTasks } from '../../task/task-loader.js';
import { loadCheckpoint } from '../../checkpoint/checkpoint.js';
import { info, warn, error } from '../../utils/logger.js';
import { SHEEPDOG_DIR } from '../../constants.js';
export async function resumeCommand(taskName, options) {
    const projectRoot = resolve(options.dir ?? process.cwd());
    const taskDir = resolve(projectRoot, SHEEPDOG_DIR, taskName);
    try {
        loadTaskByName(projectRoot, taskName);
    }
    catch (e) {
        error(`Task '${taskName}' not found in ${projectRoot}: ${e.message}`);
        info('Available tasks:');
        const tasks = discoverTasks(projectRoot);
        for (const t of tasks) {
            info(`  - ${t}`);
        }
        process.exit(1);
    }
    const cp = loadCheckpoint(taskDir);
    if (!cp) {
        warn('No checkpoint found. Starting from the beginning.');
    }
    else if (cp.status === 'completed') {
        info('Task was already completed. Starting from the beginning.');
    }
    else if (cp.phases.length > 0) {
        const lastPhase = cp.phases[cp.phases.length - 1];
        const failures = lastPhase.testResults.filter(r => !r.passed).length;
        info(`Resuming from ${lastPhase.phaseId} (${failures} prior test failure(s) in checkpoint)`);
    }
    const orchestrator = new Orchestrator();
    try {
        const result = await orchestrator.runTask(taskDir);
        if (result.status === 'failed') {
            process.exit(1);
        }
    }
    catch (e) {
        error(`Task failed: ${e.message}`);
        process.exit(1);
    }
}
//# sourceMappingURL=resume.js.map