import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { TaskYamlSchema } from './task-schema.js';
import { glob } from '../utils/fs.js';
import { SheepDogError } from '../utils/errors.js';
import { SHEEPDOG_DIR } from '../constants.js';
function toTestCommands(commands) {
    return commands.map(cmd => ({ command: cmd }));
}
function resolvePhases(yaml) {
    return yaml.phases.map((p, i) => ({
        id: `phase-${i + 1}`,
        file: `todo-phase-${i + 1}.md`,
        label: p.description,
        runAfter: toTestCommands(p.runAfter ?? []),
    }));
}
function resolveTask(yaml) {
    return {
        name: yaml.name,
        phases: resolvePhases(yaml),
        runBeforeAll: toTestCommands(yaml.runBeforeAll ?? []),
        runAfterAll: toTestCommands(yaml.runAfterAll ?? []),
        onPhaseFailure: yaml.onPhaseFailure ?? 'stop',
        nudgeInterval: yaml.nudgeInterval,
    };
}
export function discoverTasks(projectRoot) {
    const pattern = join(SHEEPDOG_DIR, '*', 'task.yaml');
    const files = glob(pattern, projectRoot);
    return files.map(f => dirname(f));
}
export function loadTask(taskDir) {
    const yamlPath = join(taskDir, 'task.yaml');
    if (!existsSync(yamlPath)) {
        throw new SheepDogError(`task.yaml not found in ${taskDir}`);
    }
    const raw = readFileSync(yamlPath, 'utf-8');
    let parsed;
    try {
        parsed = parseYaml(raw);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new SheepDogError(`Invalid YAML in task.yaml: ${msg}`);
    }
    const result = TaskYamlSchema.safeParse(parsed);
    if (!result.success) {
        throw new SheepDogError(`Invalid task.yaml: ${result.error.message}`);
    }
    return {
        task: resolveTask(result.data),
        taskDir,
        projectRoot: resolve(taskDir, '..', '..'),
    };
}
export function loadTaskByName(projectRoot, name) {
    const taskDir = join(projectRoot, SHEEPDOG_DIR, name);
    return loadTask(taskDir);
}
export function phaseFilePath(taskDir, phase) {
    return join(taskDir, phase.file);
}
export function contextFilePath(taskDir, phaseId) {
    return join(taskDir, `.phase-context-${phaseId}.md`);
}
export function fixContextFilePath(taskDir, phaseId, attempt) {
    return join(taskDir, `.phase-fix-context-${phaseId}-attempt-${attempt}.md`);
}
export function doneMarkerPath(taskDir) {
    return join(taskDir, '.phase-done');
}
export function activePhasePath(taskDir) {
    return join(taskDir, '.active-phase');
}
//# sourceMappingURL=task-loader.js.map