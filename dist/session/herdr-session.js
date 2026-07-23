import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { HerdrCommandError } from '../utils/errors.js';
const HERDR_BIN = 'herdr';
const execFileAsync = promisify(execFile);
export class HerdrSessionManager {
    async startAgent(name, cwd, argv, options) {
        return this.startAgentWithRetry(name, 1, cwd, argv, options);
    }
    async startAgentWithRetry(baseName, attempt, cwd, argv, options) {
        const name = attempt === 1 ? baseName : `${baseName}(${attempt})`;
        const args = ['agent', 'start', name, '--cwd', cwd];
        if (options?.tab)
            args.push('--tab', options.tab);
        if (options?.workspace)
            args.push('--workspace', options.workspace);
        if (options?.split)
            args.push('--split', options.split);
        if (options?.env) {
            for (const [k, v] of Object.entries(options.env)) {
                args.push('--env', `${k}=${v}`);
            }
        }
        if (options?.focus !== false)
            args.push('--focus');
        args.push('--', ...argv);
        try {
            const { stdout, stderr } = await execFileAsync(HERDR_BIN, args);
            const paneId = extractPaneId(stdout, stderr);
            return { paneId, agentName: name, status: 'running' };
        }
        catch (err) {
            const errorText = (err.stderr || '') + (err.message || '');
            if (isNameTaken(errorText) && attempt < 10) {
                return this.startAgentWithRetry(baseName, attempt + 1, cwd, argv, options);
            }
            throw err;
        }
    }
    async waitForStatus(paneId, status = 'done', timeoutMs = 0) {
        const args = ['wait', 'agent-status', paneId, '--status', status];
        try {
            if (timeoutMs > 0) {
                args.push('--timeout', String(timeoutMs));
                await execFileAsync(HERDR_BIN, args, { timeout: timeoutMs + 5000 });
            }
            else {
                await execFileAsync(HERDR_BIN, args);
            }
        }
        catch (err) {
            if (err.code === 'ETIMEDOUT') {
                throw new HerdrCommandError('wait', 0, `Timed out after ${timeoutMs}ms`);
            }
            throw new HerdrCommandError('wait', err.code || 1, err.stderr || err.message);
        }
    }
    async readPaneOutput(paneId, source = 'recent') {
        const args = ['pane', 'read', paneId, '--source', source];
        const { stdout } = await execFileAsync(HERDR_BIN, args);
        return stdout;
    }
    async agentSendKeys(target, keys) {
        await execFileAsync(HERDR_BIN, ['agent', 'send-keys', target, ...keys]);
    }
    async agentPrompt(target, text) {
        await execFileAsync(HERDR_BIN, ['agent', 'prompt', target, text]);
    }
    async closePane(paneId) {
        await execFileAsync(HERDR_BIN, ['pane', 'close', paneId]);
    }
    async listAgents() {
        const { stdout } = await execFileAsync(HERDR_BIN, ['agent', 'list']);
        return parseAgentList(stdout);
    }
    async getAgent(name) {
        try {
            const { stdout } = await execFileAsync(HERDR_BIN, ['agent', 'get', name]);
            return parseAgentInfo(stdout);
        }
        catch {
            return null;
        }
    }
}
function extractPaneId(stdout, stderr) {
    try {
        const parsed = JSON.parse(stdout);
        const paneId = parsed?.result?.agent?.pane_id;
        if (paneId)
            return paneId;
    }
    catch { }
    const combined = stdout + stderr;
    const match = combined.match(/pane[_\s]?(\w+)/i);
    if (match)
        return match[1];
    const idMatch = combined.match(/(pane_\w+)/);
    if (idMatch)
        return idMatch[1];
    return 'unknown';
}
function parseAgentList(output) {
    const agents = [];
    for (const line of output.split('\n').filter(Boolean)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
            agents.push({
                paneId: parts[0],
                agentName: parts[1],
                status: parts[2].toLowerCase(),
            });
        }
    }
    return agents;
}
function isNameTaken(text) {
    return text.includes('agent_name_taken') || text.includes('name is already used');
}
function parseAgentInfo(output) {
    const lines = output.trim().split('\n').filter(Boolean);
    if (lines.length === 0)
        return null;
    const parts = lines[0].trim().split(/\s+/);
    if (parts.length < 3)
        return null;
    return {
        paneId: parts[0],
        agentName: parts[1],
        status: parts[2].toLowerCase(),
    };
}
//# sourceMappingURL=herdr-session.js.map