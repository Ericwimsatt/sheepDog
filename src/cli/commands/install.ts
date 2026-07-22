import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { info, success, step, warn } from '../../utils/logger.js'
import { SheepDogError } from '../../utils/errors.js'
import { SHEEPDOG_DIR } from '../../constants.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = resolve(__dirname, '../../..')
const PACKAGE_SKILLS_DIR = join(PACKAGE_ROOT, 'skills')

const AGENTS_MD_CONTENT = `# SheepDog: Overview for Coding Agents

SheepDog is a multi-phase task orchestrator. It lets you define coding
work as a sequence of phases, each with agent instructions and optional
verification gates between them.

## Where to Find Guidance

Detailed skill files are in \`.sheepdog/skills/\`. Read the relevant one
for your task:

| File | When to use it |
|---|---|
| \`.sheepdog/skills/install.md\` | First-time sheepdog setup — install, bootstrap, quick start |
| \`.sheepdog/skills/create-task.md\` | Creating or editing a task definition — task.yaml structure, phase design, verification steps |
| \`.sheepdog/skills/handle-failure.md\` | A verification step failed — understanding failure modes, diagnosing, fixing |

## Quick Reference

- Tasks live in \`.sheepdog/<task-name>/\`
- Each task has a \`task.yaml\` definition and \`todo-phase-N.md\` instruction files
- Run a task: \`sheepdog run <task-name>\`
- Signal phase completion: type \`/done\` or call \`sheepdog_done\`
- Between phases, sheepdog runs \`runAfter\` commands to verify work
- \`onPhaseFailure\` controls what happens on failure: \`stop\`, \`continue\`, or \`attempt fix\`
- Always use \`npx vitest run\` (not bare \`vitest\`) in commands — bare \`vitest\` never exits
`

export interface InstallOptions {
  dir: string
}

function copySkills(sourceDir: string, targetDir: string): void {
  if (!existsSync(sourceDir)) {
    warn(`Skills directory not found at ${sourceDir}, skipping skill copy`)
    return
  }

  mkdirSync(targetDir, { recursive: true })

  for (const entry of readdirSync(sourceDir)) {
    const srcPath = join(sourceDir, entry)
    if (!statSync(srcPath).isFile() || !entry.endsWith('.md')) continue

    const destPath = join(targetDir, entry)
    if (existsSync(destPath)) {
      warn(`Skill ${entry} already exists at ${destPath}, skipping`)
      continue
    }

    writeFileSync(destPath, readFileSync(srcPath, 'utf-8'), 'utf-8')
    step(`Copied skill ${entry}`)
  }
}

export async function installCommand(options: InstallOptions): Promise<void> {
  const projectRoot = resolve(options.dir)

  if (!existsSync(projectRoot)) {
    throw new SheepDogError(`Directory not found: ${projectRoot}`)
  }

  info(`Bootstrapping sheepdog in ${projectRoot}`)

  const sheepdogDir = join(projectRoot, SHEEPDOG_DIR)
  mkdirSync(sheepdogDir, { recursive: true })
  step(`Created ${sheepdogDir}/`)

  const agentsMdPath = join(sheepdogDir, 'AGENTS.md')
  if (existsSync(agentsMdPath)) {
    warn(`AGENTS.md already exists at ${agentsMdPath}, skipping`)
  } else {
    writeFileSync(agentsMdPath, AGENTS_MD_CONTENT, 'utf-8')
    step(`Created ${agentsMdPath}`)
  }

  const skillsTargetDir = join(sheepdogDir, 'skills')
  copySkills(PACKAGE_SKILLS_DIR, skillsTargetDir)

  success('Sheepdog installed.')
  info(`Run \`sheepdog init\` to create your first task.`)
}
