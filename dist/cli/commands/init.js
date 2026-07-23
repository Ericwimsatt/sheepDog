import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { info, success, step } from '../../utils/logger.js';
import { SheepDogError } from '../../utils/errors.js';
import { SHEEPDOG_DIR } from '../../constants.js';
export async function initCommand(options) {
    const projectRoot = resolve(options.dir);
    const taskName = options.taskName ?? 'my-task';
    const taskDir = join(projectRoot, SHEEPDOG_DIR, taskName);
    if (!existsSync(projectRoot)) {
        throw new SheepDogError(`Directory not found: ${projectRoot}`);
    }
    info(`Initializing sheepdog task '${taskName}' in ${projectRoot}`);
    mkdirSync(taskDir, { recursive: true });
    step(`Created ${taskDir}`);
    const taskYaml = `name: "${taskName}"
phases:
  - description: "Phase 1: Planning"
  - description: "Phase 2: Implementation"
    runAfter:
      - npm run typecheck
      - npm run lint
  - description: "Phase 3: Testing & Refinement"
    runAfter:
      - npm test
  - description: "Phase 4: Polish & Documentation"
    runAfter:
      - npm run typecheck
      - npm test
runBeforeAll:
  - npm install
runAfterAll:
  - npm run typecheck
  - npm test
onPhaseFailure: attempt fix  # "stop", "continue", or "attempt fix"
`;
    writeFileSync(join(taskDir, 'task.yaml'), taskYaml, 'utf-8');
    step('Created task.yaml');
    for (let i = 1; i <= 4; i++) {
        const todoPath = join(taskDir, `todo-phase-${i}.md`);
        if (!existsSync(todoPath)) {
            writeFileSync(todoPath, `# Phase ${i}\n\nTODO: Describe the work for phase ${i}.\n`, 'utf-8');
            step(`Created todo-phase-${i}.md`);
        }
    }
    success(`Sheepdog task '${taskName}' initialized.`);
    info(`Edit ${join(taskDir, 'task.yaml')} to configure phases and test commands.`);
    info(`Edit the todo-phase-*.md files with instructions for each phase.`);
    info(`Then run: sheepdog run ${taskName}`);
}
//# sourceMappingURL=init.js.map