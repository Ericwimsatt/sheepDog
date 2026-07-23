import { writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { SHEEPDOG_DIR } from '../constants.js';
import { debugLog } from '../utils/debug.js';
export function findActiveSheepDogTask(cwd) {
    return findActiveSheepDogTaskWithDiagnostics(cwd).taskDir;
}
export function findActiveSheepDogTaskWithDiagnostics(cwd) {
    let dir = resolve(cwd);
    const diagnostics = [];
    diagnostics.push(`Starting search from: ${cwd}`);
    for (let i = 0; i < 10; i++) {
        const sheepdogDir = resolve(dir, SHEEPDOG_DIR);
        diagnostics.push(`[${i + 1}] Checking: ${sheepdogDir}`);
        debugLog(`findActiveSheepDogTask: checking ${sheepdogDir}`);
        if (existsSync(sheepdogDir)) {
            const entries = readdirSimple(sheepdogDir);
            diagnostics.push(`  Found dirs: [${entries.join(', ') || '(none)'}]`);
            debugLog(`findActiveSheepDogTask: found entries in ${sheepdogDir}: [${entries.join(', ')}]`);
            for (const entry of entries) {
                const taskDir = resolve(sheepdogDir, entry);
                const activePhaseFile = resolve(taskDir, '.active-phase');
                if (existsSync(activePhaseFile)) {
                    diagnostics.push(`  MATCH: ${taskDir} (has .active-phase)`);
                    debugLog(`findActiveSheepDogTask: found active task at ${taskDir}`);
                    return { taskDir, diagnostics };
                }
                diagnostics.push(`  Skipped: ${taskDir} (no .active-phase)`);
                debugLog(`findActiveSheepDogTask: no .active-phase in ${taskDir}`);
            }
        }
        else {
            diagnostics.push(`  Not found: ${sheepdogDir} does not exist`);
            debugLog(`findActiveSheepDogTask: ${sheepdogDir} does not exist`);
        }
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    diagnostics.push('No active task found after walking up 10 levels');
    debugLog('findActiveSheepDogTask: no active task found after walking up 10 levels');
    return { taskDir: null, diagnostics };
}
export function writeDoneMarker(taskDir) {
    const path = resolve(taskDir, '.phase-done');
    debugLog(`writeDoneMarker: writing ${path}`, taskDir);
    writeFileSync(path, Date.now().toString(), 'utf-8');
    debugLog(`writeDoneMarker: ${path} written`, taskDir);
}
export function isDoneCommand(message) {
    return (message.text?.trim() === '/done' &&
        (message.from === 'user' || message.from === undefined));
}
function readdirSimple(dir) {
    try {
        return readdirSync(dir).filter((entry) => {
            try {
                return statSync(resolve(dir, entry)).isDirectory();
            }
            catch {
                return false;
            }
        });
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=done-handler.js.map