import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { info, success, step, warn } from '../../utils/logger.js'
import { SheepDogError } from '../../utils/errors.js'
import { SHEEPDOG_DIR } from '../../constants.js'

const AGENTS_MD_CONTENT = `# Instructions for Coding Agents: Creating a SheepDog Task

Use these instructions when asked to create a sheepdog task in a repository that has never used sheepdog before.

## Overview

SheepDog is a multi-phase task orchestrator for herdr + opencode. You define a task as a set of sequential phases, each with instructions for an AI coding agent and optional test gates between them.

## Step-by-Step Instructions

### 1. Install SheepDog

SheepDog is an npm package. Install it in the repo:

\`\`\`bash
npm install -g sheepdog  # global install
# or
npm install --save-dev sheepdog  # local install
\`\`\`

### 2. Create the Task Directory

Tasks live under \`.sheepdog/<task-name>/\` in the repository root. Create the directory:

\`\`\`
.sheepdog/<task-name>/
├── task.yaml            # Task definition (required)
├── todo-phase-1.md      # Phase 1 instructions (required)
├── todo-phase-2.md      # Phase 2 instructions (optional)
└── ...
\`\`\`

### 3. Define \`task.yaml\`

The schema supports:

\`\`\`yaml
name: <task-name>                  # Required: name matching the directory
phases:                            # Required: list of 1-10 phases
  - description: "Phase 1 title"   # Required: short description
    runAfter:                      # Optional: commands to run after this phase
      - <command>
  - description: "Phase 2 title"
    runAfter:
      - <command>
schemas:                           # Optional: JSON schema keys for validation
  - <schema-ref>
runBeforeAll:                      # Optional: commands before any phase starts
  - <command>
runAfterAll:                       # Optional: commands after all phases complete
  - <command>
onPhaseFailure: stop               # Optional: "attempt fix" (default), "continue", or "stop"
\`\`\`

Example:
\`\`\`yaml
name: add-auth
phases:
  - description: "Create database schema and models"
  - description: "Implement JWT login/signup endpoints"
    runAfter:
      - npm run test:db
  - description: "Add middleware and protected routes"
    runAfter:
      - npm run test:api
runBeforeAll:
  - npm install
runAfterAll:
  - npm run test
onPhaseFailure: stop
\`\`\`

### 4. Write Phase Instructions

Each \`todo-phase-N.md\` file contains the instructions the AI coding agent will receive for that phase. Be specific:

- What files to create or modify
- What the implementation should do
- Any acceptance criteria
- Links to relevant existing code or documentation

Example \`todo-phase-1.md\`:
\`\`\`markdown
# Phase 1: Database Schema

Create the following:

1. \`src/models/User.ts\` — User model with fields: id, email, passwordHash, createdAt
2. \`src/db/migrations/001-create-users.sql\` — SQL migration for the users table
3. \`src/db/index.ts\` — Database connection setup

The User model should use the existing \`BaseModel\` in \`src/models/BaseModel.ts\`.
\`\`\`

### 5. Run the Task

\`\`\`bash
sheepdog run <task-name>
\`\`\`

### 6. During Execution

- SheepDog opens opencode in a herdr pane for each phase
- The agent reads the \`todo-phase-N.md\` and works through it
- When done, type \`/done\` in the agent to signal phase completion
- SheepDog runs any \`runAfter\` commands and either proceeds to the next phase, stops on failure, or automatically retries fixing (controlled by \`onPhaseFailure\`)

## Best Practices

- **Keep phases focused** — each phase should be a self-contained unit of work (e.g., "implement the model", "write the API endpoint")
- **Add test gates** — use \`runAfter\` to run relevant tests between phases to catch issues early
- **Write detailed phase instructions** — the more context you give the agent, the better the outcome
- **Use \`runBeforeAll\`** for setup (install, build, migrate) and \`runAfterAll\` for final verification
- **Use \`onPhaseFailure: continue\`** when you want the agent to see and fix test failures in the next phase
- **Use \`onPhaseFailure: attempt fix\`** when you want the orchestrator to automatically retry fixing failed tests (up to 2 attempts) before aborting
`

export interface InstallOptions {
  dir: string
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

  success('Sheepdog installed.')
  info(`Run \`sheepdog init\` to create your first task.`)
}
