import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { glob } from '../fs.js';
import { SHEEPDOG_DIR } from '../../constants.js';
let tmpDir;
beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-fs-test-'));
});
afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
});
describe('glob', () => {
    it(`matches ${SHEEPDOG_DIR}/*/task.yaml patterns`, () => {
        mkdirSync(join(tmpDir, SHEEPDOG_DIR, 'task-a'), { recursive: true });
        mkdirSync(join(tmpDir, SHEEPDOG_DIR, 'task-b'), { recursive: true });
        writeFileSync(join(tmpDir, SHEEPDOG_DIR, 'task-a', 'task.yaml'), 'name: a');
        writeFileSync(join(tmpDir, SHEEPDOG_DIR, 'task-b', 'task.yaml'), 'name: b');
        const results = glob(`${SHEEPDOG_DIR}/*/task.yaml`, tmpDir);
        expect(results).toHaveLength(2);
        expect(results).toContain(join(tmpDir, SHEEPDOG_DIR, 'task-a', 'task.yaml'));
        expect(results).toContain(join(tmpDir, SHEEPDOG_DIR, 'task-b', 'task.yaml'));
    });
    it('matches ** patterns recursively', () => {
        mkdirSync(join(tmpDir, 'a', 'b', 'c'), { recursive: true });
        writeFileSync(join(tmpDir, 'a', 'file.txt'), 'hello');
        writeFileSync(join(tmpDir, 'a', 'b', 'file.txt'), 'hello');
        writeFileSync(join(tmpDir, 'a', 'b', 'c', 'file.txt'), 'hello');
        const results = glob('**/file.txt', tmpDir);
        expect(results).toHaveLength(3);
    });
    it('returns empty array when no matches', () => {
        const results = glob(`${SHEEPDOG_DIR}/*/task.yaml`, tmpDir);
        expect(results).toEqual([]);
    });
});
//# sourceMappingURL=fs.test.js.map