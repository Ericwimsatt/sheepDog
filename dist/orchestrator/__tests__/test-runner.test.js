import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestRunner } from '../test-runner.js';
const mockSpawn = vi.hoisted(() => vi.fn());
let onErrorCb;
let onExitCb;
vi.mock('node:child_process', () => ({
    spawn: mockSpawn,
}));
let runner;
beforeEach(() => {
    vi.clearAllMocks();
    onErrorCb = undefined;
    onExitCb = undefined;
    mockSpawn.mockImplementation(() => ({
        on: vi.fn((event, cb) => {
            if (event === 'error')
                onErrorCb = cb;
            if (event === 'exit')
                onExitCb = cb;
        }),
    }));
    runner = new TestRunner({ cwd: '/tmp' });
});
describe('TestRunner', () => {
    it('runs a successful command and returns passed: true', async () => {
        const promise = runner.run([{ command: 'echo hello', optional: false, failOnError: false }]);
        onExitCb(0);
        const results = await promise;
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(true);
        expect(results[0].exitCode).toBe(0);
        expect(results[0].stdout).toBe('');
        expect(results[0].command).toBe('echo hello');
    });
    it('runs a failing command and returns passed: false', async () => {
        const promise = runner.run([{ command: 'false', optional: false, failOnError: false }]);
        onErrorCb(Object.assign(new Error('command failed'), { code: 1 }));
        const results = await promise;
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(false);
        expect(results[0].exitCode).toBe(1);
        expect(results[0].stderr).toBe('command failed');
    });
    it('stops on failOnError commands', async () => {
        const promise = runner.run([
            { command: 'failing-cmd', optional: false, failOnError: true },
            { command: 'echo should-not-run', optional: false, failOnError: false },
        ]);
        onErrorCb(new Error('failed'));
        const results = await promise;
        expect(results).toHaveLength(1);
    });
    it('continues on optional failures', async () => {
        let spawnCount = 0;
        mockSpawn.mockImplementation(() => {
            spawnCount++;
            return {
                on: vi.fn((event, cb) => {
                    if (spawnCount === 1 && event === 'error') {
                        cb(new Error('optional failed'));
                    }
                    if (spawnCount === 2 && event === 'exit') {
                        cb(0);
                    }
                }),
            };
        });
        const results = await runner.run([
            { command: 'optional-cmd', optional: true, failOnError: false },
            { command: 'echo ok', optional: false, failOnError: false },
        ]);
        expect(results).toHaveLength(2);
        expect(results[0].passed).toBe(false);
        expect(results[1].passed).toBe(true);
    });
    it('returns TestResult with correct stdout/stderr/exitCode', async () => {
        const promise = runner.run([{ command: 'some-tool', optional: false, failOnError: false }]);
        onExitCb(0);
        const results = await promise;
        expect(results[0]).toEqual({
            command: 'some-tool',
            exitCode: 0,
            stdout: '',
            stderr: '',
            passed: true,
        });
    });
});
//# sourceMappingURL=test-runner.test.js.map