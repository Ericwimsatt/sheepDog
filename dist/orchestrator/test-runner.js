import { spawn } from 'node:child_process';
import { step, warn, error } from '../utils/logger.js';
export class TestRunner {
    options;
    constructor(options) {
        this.options = options;
    }
    async run(commands) {
        const results = [];
        for (const cmd of commands) {
            step(`Running: ${cmd.command}`);
            const result = await this.executeCommand(cmd.command);
            results.push(result);
            if (!result.passed && !cmd.optional && cmd.failOnError) {
                error(`Command failed: ${cmd.command}`);
                break;
            }
            if (!result.passed && cmd.optional) {
                warn(`Optional command failed (ignored): ${cmd.command}`);
            }
        }
        return results;
    }
    async executeCommand(command) {
        const parts = command.split(/\s+/);
        const vitestIdx = parts.findIndex(p => p === 'vitest');
        if (vitestIdx !== -1 && parts[vitestIdx + 1] !== 'run') {
            parts.splice(vitestIdx + 1, 0, 'run');
            const fixed = parts.join(' ');
            warn(`'${command}' would run vitest in watch mode. Using '${fixed}' instead.`);
            command = fixed;
        }
        const cmd = parts[0];
        const args = parts.slice(1);
        return new Promise(resolve => {
            const child = spawn(cmd, args, {
                cwd: this.options.cwd,
                env: { ...process.env, ...this.options.env },
                stdio: 'inherit',
                timeout: 300_000,
            });
            child.on('error', err => {
                resolve({
                    command,
                    exitCode: 1,
                    stdout: '',
                    stderr: err.message,
                    passed: false,
                });
            });
            child.on('exit', code => {
                resolve({
                    command,
                    exitCode: code ?? 1,
                    stdout: '',
                    stderr: '',
                    passed: code === 0,
                });
            });
        });
    }
}
//# sourceMappingURL=test-runner.js.map