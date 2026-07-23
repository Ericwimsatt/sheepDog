import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HerdrSessionManager } from '../herdr-session.js';
import { HerdrCommandError } from '../../utils/errors.js';
const mockImpl = vi.fn();
vi.mock('node:child_process', () => ({
    execFile: (...args) => {
        const cb = args[args.length - 1];
        try {
            const result = mockImpl(...args.slice(0, -1));
            if (result && typeof result.then === 'function') {
                result.then((res) => cb(null, res), (err) => cb(err));
            }
            else {
                cb(null, result ?? { stdout: '', stderr: '' });
            }
        }
        catch (err) {
            cb(err);
        }
    },
}));
let manager;
beforeEach(() => {
    vi.clearAllMocks();
    manager = new HerdrSessionManager();
});
describe('HerdrSessionManager', () => {
    describe('startAgent', () => {
        it('calls herdr agent start with all args', async () => {
            mockImpl.mockReturnValue({ stdout: 'Created agent in pane pane_abc123', stderr: '' });
            const result = await manager.startAgent('test-agent', '/root', ['node', 'test.js']);
            expect(mockImpl).toHaveBeenCalledWith('herdr', [
                'agent', 'start', 'test-agent', '--cwd', '/root',
                '--focus',
                '--', 'node', 'test.js',
            ]);
            expect(result).toEqual({ paneId: 'pane_abc123', agentName: 'test-agent', status: 'running' });
        });
        it('parses pane ID from output', async () => {
            mockImpl.mockReturnValue({ stdout: 'pane_xyz789', stderr: '' });
            const result = await manager.startAgent('a', '/root', ['echo', 'hi']);
            expect(result.paneId).toBe('xyz789');
        });
        it('passes --env correctly', async () => {
            mockImpl.mockReturnValue({ stdout: 'pane_p1', stderr: '' });
            await manager.startAgent('a', '/root', ['cmd'], {
                env: { FOO: 'bar', BAZ: 'qux' },
            });
            expect(mockImpl).toHaveBeenCalledWith('herdr', expect.arrayContaining([
                '--env', 'FOO=bar',
                '--env', 'BAZ=qux',
            ]));
        });
        it('passes --split, --tab, --workspace', async () => {
            mockImpl.mockReturnValue({ stdout: 'pane_p1', stderr: '' });
            await manager.startAgent('a', '/root', ['cmd'], {
                split: 'right',
                tab: 'my-tab',
                workspace: 'ws1',
            });
            expect(mockImpl).toHaveBeenCalledWith('herdr', expect.arrayContaining([
                '--split', 'right',
                '--tab', 'my-tab',
                '--workspace', 'ws1',
            ]));
        });
    });
    describe('waitForStatus', () => {
        it('calls herdr wait agent-status with correct args', async () => {
            mockImpl.mockReturnValue({ stdout: '', stderr: '' });
            await manager.waitForStatus('pane_abc');
            expect(mockImpl).toHaveBeenCalledWith('herdr', [
                'wait', 'agent-status', 'pane_abc', '--status', 'done',
            ]);
        });
        it('passes custom timeout', async () => {
            mockImpl.mockReturnValue({ stdout: '', stderr: '' });
            await manager.waitForStatus('pane_abc', 'working', 30000);
            expect(mockImpl).toHaveBeenCalledWith('herdr', [
                'wait', 'agent-status', 'pane_abc', '--status', 'working', '--timeout', '30000',
            ], { timeout: 35000 });
        });
        it('throws HerdrCommandError on failure', async () => {
            mockImpl.mockImplementation(() => {
                const error = new Error('command failed');
                error.code = 1;
                error.stderr = 'something went wrong';
                throw error;
            });
            await expect(manager.waitForStatus('pane_abc'))
                .rejects.toThrow(HerdrCommandError);
        });
    });
    describe('readPaneOutput', () => {
        it('calls herdr pane read with correct args', async () => {
            mockImpl.mockReturnValue({ stdout: 'output content' });
            const result = await manager.readPaneOutput('pane_abc');
            expect(mockImpl).toHaveBeenCalledWith('herdr', [
                'pane', 'read', 'pane_abc', '--source', 'recent',
            ]);
            expect(result).toBe('output content');
        });
        it('passes visible source when specified', async () => {
            mockImpl.mockReturnValue({ stdout: '' });
            await manager.readPaneOutput('pane_abc', 'visible');
            expect(mockImpl).toHaveBeenCalledWith('herdr', [
                'pane', 'read', 'pane_abc', '--source', 'visible',
            ]);
        });
    });
    describe('closePane', () => {
        it('calls herdr pane close', async () => {
            mockImpl.mockReturnValue({ stdout: '', stderr: '' });
            await manager.closePane('pane_abc');
            expect(mockImpl).toHaveBeenCalledWith('herdr', ['pane', 'close', 'pane_abc']);
        });
    });
    describe('listAgents', () => {
        it('parses output correctly', async () => {
            mockImpl.mockReturnValue({
                stdout: 'pane_123  agent-one  running\npane_456  agent-two  done\n',
                stderr: '',
            });
            const agents = await manager.listAgents();
            expect(agents).toEqual([
                { paneId: 'pane_123', agentName: 'agent-one', status: 'running' },
                { paneId: 'pane_456', agentName: 'agent-two', status: 'done' },
            ]);
        });
    });
    describe('getAgent', () => {
        it('returns null for missing agent', async () => {
            mockImpl.mockImplementation(() => {
                throw new Error('not found');
            });
            const result = await manager.getAgent('nonexistent');
            expect(result).toBeNull();
        });
        it('parses agent info', async () => {
            mockImpl.mockReturnValue({
                stdout: 'pane_789  my-agent  idle\n',
                stderr: '',
            });
            const result = await manager.getAgent('my-agent');
            expect(result).toEqual({ paneId: 'pane_789', agentName: 'my-agent', status: 'idle' });
        });
    });
});
//# sourceMappingURL=herdr-session.test.js.map