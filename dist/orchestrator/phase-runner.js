import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { buildPhaseContext, buildFixContext } from './context-builder.js';
import { doneMarkerPath, activePhasePath, contextFilePath, fixContextFilePath } from '../task/task-loader.js';
import { info, success, step } from '../utils/logger.js';
import { debugLog } from '../utils/debug.js';
export class PhaseRunner {
    async run(options) {
        const { taskDir, projectRoot, herdr, phase, previousTestResults } = options;
        const startedAt = new Date().toISOString();
        info(`Preparing context for phase: ${phase.label}`);
        buildPhaseContext({ taskDir, phase, previousTestResults });
        writeFileSync(activePhasePath(taskDir), phase.id, 'utf-8');
        const donePath = doneMarkerPath(taskDir);
        if (existsSync(donePath)) {
            unlinkSync(donePath);
        }
        info(`Launching phase: ${phase.label}`);
        const agentName = `Sheepdog (${phase.id})`;
        const contextPath = contextFilePath(taskDir, phase.id);
        const agentInfo = await herdr.startAgent(agentName, projectRoot, [
            'opencode',
            '--prompt', `Phase "${phase.label}" has started. Read the instructions in ${contextPath} and follow them. When you have completed all the work, call the \`sheepdog_done\` tool to signal phase completion.`,
            '--auto',
        ], {
            split: 'right',
        });
        success(`Phase started in pane: ${agentInfo.paneId}`);
        const nudgeIntervalMs = (options.nudgeInterval ?? 0) * 1000;
        let nudgeTimer;
        if (nudgeIntervalMs > 0) {
            debugLog(`Starting nudge timer every ${nudgeIntervalMs}ms for pane ${agentInfo.paneId}`, taskDir);
            nudgeTimer = setInterval(() => {
                herdr.agentSendKeys(agentInfo.paneId, ['esc', 'esc'])
                    .then(() => sleep(500))
                    .then(() => herdr.agentPrompt(agentInfo.paneId, 'continue'))
                    .catch((err) => debugLog(`Nudge failed: ${err}`, taskDir));
            }, nudgeIntervalMs);
        }
        step('Waiting for /done marker...');
        debugLog('waitForDoneMarker: starting poll for .phase-done in ' + doneMarkerPath(taskDir), taskDir);
        await this.waitForDoneMarker(taskDir);
        if (nudgeTimer)
            clearInterval(nudgeTimer);
        step('Reading phase output...');
        let output = '';
        try {
            output = await herdr.readPaneOutput(agentInfo.paneId, 'recent');
        }
        catch {
            step('Could not read pane output (pane may have been closed)');
        }
        step('Closing pane...');
        try {
            await herdr.closePane(agentInfo.paneId);
            success(`Pane ${agentInfo.paneId} closed`);
        }
        catch {
            step('Could not close pane');
        }
        const completedAt = new Date().toISOString();
        return {
            phaseId: phase.id,
            status: 'completed',
            startedAt,
            completedAt,
            testResults: [],
        };
    }
    async runFixAttempt(options) {
        const { taskDir, projectRoot, herdr, phase, testResults, attempt, maxAttempts } = options;
        info(`Preparing fix context attempt ${attempt}/${maxAttempts} for phase: ${phase.label}`);
        buildFixContext({ taskDir, phase, testResults, attempt, maxAttempts });
        writeFileSync(activePhasePath(taskDir), `${phase.id}-fix-${attempt}`, 'utf-8');
        const donePath = doneMarkerPath(taskDir);
        if (existsSync(donePath)) {
            unlinkSync(donePath);
        }
        const agentName = `Sheepdog fix (${phase.id}, attempt ${attempt})`;
        const contextPath = fixContextFilePath(taskDir, phase.id, attempt);
        info(`Launching fix agent (${attempt}/${maxAttempts}) for phase: ${phase.label}`);
        const agentInfo = await herdr.startAgent(agentName, projectRoot, [
            'opencode',
            '--prompt', `Fix attempt ${attempt}/${maxAttempts} for phase "${phase.label}". Read the failing test details in ${contextPath} and fix the code. When done, call the \`sheepdog_done\` tool.`,
            '--auto',
        ], {
            split: 'right',
        });
        success(`Fix agent started in pane: ${agentInfo.paneId}`);
        const nudgeIntervalMs = (options.nudgeInterval ?? 0) * 1000;
        let nudgeTimer;
        if (nudgeIntervalMs > 0) {
            debugLog(`Starting nudge timer every ${nudgeIntervalMs}ms for fix pane ${agentInfo.paneId}`, taskDir);
            nudgeTimer = setInterval(() => {
                herdr.agentSendKeys(agentInfo.paneId, ['esc', 'esc'])
                    .then(() => sleep(500))
                    .then(() => herdr.agentPrompt(agentInfo.paneId, 'continue'))
                    .catch((err) => debugLog(`Nudge failed: ${err}`, taskDir));
            }, nudgeIntervalMs);
        }
        step('Waiting for fix agent to complete...');
        await this.waitForDoneMarker(taskDir);
        if (nudgeTimer)
            clearInterval(nudgeTimer);
        step('Reading fix agent output...');
        let output = '';
        try {
            output = await herdr.readPaneOutput(agentInfo.paneId, 'recent');
        }
        catch {
            step('Could not read pane output (pane may have been closed)');
        }
        step('Closing fix agent pane...');
        try {
            await herdr.closePane(agentInfo.paneId);
            success(`Fix agent pane ${agentInfo.paneId} closed`);
        }
        catch {
            step('Could not close pane');
        }
    }
    async waitForDoneMarker(taskDir, pollMs = 500, timeoutMs = 0) {
        const donePath = doneMarkerPath(taskDir);
        const startTime = Date.now();
        let pollCount = 0;
        while (true) {
            pollCount++;
            if (existsSync(donePath)) {
                const content = readFileContent(donePath);
                debugLog(`waitForDoneMarker: found .phase-done marker after ${pollCount} polls (elapsed: ${Date.now() - startTime}ms, content: ${content})`, taskDir);
                unlinkSync(donePath);
                debugLog('waitForDoneMarker: marker consumed, proceeding', taskDir);
                return;
            }
            if (pollCount % 20 === 0) {
                debugLog(`waitForDoneMarker: still waiting after ${pollCount} polls (${Date.now() - startTime}ms)`, taskDir);
            }
            if (timeoutMs > 0 && Date.now() - startTime > timeoutMs) {
                debugLog(`waitForDoneMarker: timeout after ${timeoutMs}ms`, taskDir);
                throw new Error(`Timed out waiting for /done marker after ${timeoutMs}ms`);
            }
            await sleep(pollMs);
        }
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function readFileContent(path) {
    try {
        return readFileSync(path, 'utf-8').trim();
    }
    catch {
        return '(unreadable)';
    }
}
//# sourceMappingURL=phase-runner.js.map