import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installCommand } from '../commands/install.js';
import { SHEEPDOG_DIR } from '../../constants.js';
let tmpDir;
beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-install-'));
});
afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
});
describe('installCommand', () => {
    it(`creates ${SHEEPDOG_DIR}/ directory`, async () => {
        await installCommand({ dir: tmpDir });
        expect(existsSync(join(tmpDir, SHEEPDOG_DIR))).toBe(true);
    });
    it(`creates AGENTS.md inside ${SHEEPDOG_DIR}/`, async () => {
        await installCommand({ dir: tmpDir });
        const agentsPath = join(tmpDir, SHEEPDOG_DIR, 'AGENTS.md');
        expect(existsSync(agentsPath)).toBe(true);
        const content = readFileSync(agentsPath, 'utf-8');
        expect(content).toContain('Creating a SheepDog Task');
        expect(content).toContain('task.yaml');
    });
    it(`does not overwrite existing ${SHEEPDOG_DIR}/AGENTS.md`, async () => {
        const sheepdogDir = join(tmpDir, SHEEPDOG_DIR);
        mkdirSync(sheepdogDir, { recursive: true });
        writeFileSync(join(sheepdogDir, 'AGENTS.md'), 'custom content', 'utf-8');
        await installCommand({ dir: tmpDir });
        const content = readFileSync(join(sheepdogDir, 'AGENTS.md'), 'utf-8');
        expect(content).toBe('custom content');
    });
    it('errors on non-existent directory', async () => {
        await expect(installCommand({ dir: '/nonexistent/path' }))
            .rejects.toThrow('Directory not found');
    });
});
//# sourceMappingURL=install.test.js.map