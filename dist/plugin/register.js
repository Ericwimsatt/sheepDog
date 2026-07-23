import { tool } from '@opencode-ai/plugin';
import { findActiveSheepDogTask, findActiveSheepDogTaskWithDiagnostics, isDoneCommand, writeDoneMarker } from './done-handler.js';
import { debugLog } from '../utils/debug.js';
const SheepDogPlugin = {
    'chat.message': async (_input, output) => {
        if (output.message.role !== 'user')
            return;
        const text = output.parts
            .filter((p) => p.type === 'text')
            .map(p => p.text)
            .join('');
        if (!isDoneCommand({ text, from: 'user' }))
            return;
        const taskDir = findActiveSheepDogTask(process.cwd());
        if (!taskDir) {
            debugLog('/done received but no active sheepdog task found (cwd: ' + process.cwd() + ')');
            return;
        }
        debugLog('/done received from user, writing marker', taskDir);
        writeDoneMarker(taskDir);
    },
    tool: {
        sheepdog_done: tool({
            description: 'Signal that the current sheepdog phase is complete. Call this when you have finished all the work for the current phase.',
            args: {},
            execute: async (_args, context) => {
                debugLog('sheepdog_done tool called (directory: ' + context.directory + ')');
                const result = findActiveSheepDogTaskWithDiagnostics(context.directory);
                if (!result.taskDir) {
                    const diag = result.diagnostics.join('\n');
                    debugLog('sheepdog_done: no active sheepdog task found from directory: ' + context.directory);
                    return 'No active sheepdog task found.\nSearch diagnostics:\n' + diag;
                }
                const taskDir = result.taskDir;
                debugLog('sheepdog_done: writing marker', taskDir);
                writeDoneMarker(taskDir);
                debugLog('sheepdog_done: marker written successfully', taskDir);
                return 'Phase completion signaled';
            },
        }),
    },
};
export default SheepDogPlugin;
//# sourceMappingURL=register.js.map