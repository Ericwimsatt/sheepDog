import { resolve } from 'node:path';
import { discoverTasks, loadTask } from '../../task/task-loader.js';
import { info, warn } from '../../utils/logger.js';
export async function listCommand(options) {
    const projectRoot = resolve(options?.dir ?? process.cwd());
    const tasks = discoverTasks(projectRoot);
    if (tasks.length === 0) {
        warn(`No sheepdog tasks found in ${projectRoot}`);
        info('Run `sheepdog init` to create one, or `sheepdog plan <description>` to generate one.');
        return;
    }
    info(`Sheepdog tasks in ${projectRoot}:`);
    for (const taskDir of tasks) {
        try {
            const loaded = loadTask(taskDir);
            info(`  ${loaded.task.name} (${loaded.task.phases.length} phases)`);
        }
        catch {
            info(`  ${taskDir} (invalid task.yaml)`);
        }
    }
}
//# sourceMappingURL=list.js.map