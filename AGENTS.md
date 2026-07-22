# Instructions for Coding Agents: Creating a SheepDog Task

Use these instructions when asked to create a sheepdog task 

## Overview

SheepDog is a multi-phase task orchestrator. You define a task as a set of sequential phases, each with instructions for an AI coding agent and optional test gates between them.

## Step-by-Step Instructions

### 1. Install SheepDog

SheepDog is an npm package. Install it in the repo:

```bash
npm install -g sheepdog  # global install
# or
npm install --save-dev sheepdog  # local install
```

### 2. Create the Task Directory

Tasks live under `.sheepdog/<task-name>/` in the repository root. Create the directory:

```
.sheepdog/<task-name>/
├── task.yaml            # Task definition (required)
├── todo-phase-1.md      # Phase 1 instructions (required)
├── todo-phase-2.md      # Phase 2 instructions (optional)
└── ...
```

### 3. Define `task.yaml`

The schema supports:

```yaml
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
nudgeInterval: 180                 # Optional: seconds between "continue" nudges (0 or omit to disable)
runBeforeAll:                      # Optional: commands before any phase starts
  - <command>
runAfterAll:                       # Optional: commands after all phases complete
  - <command>
onPhaseFailure: attempt fix               # Optional: "attempt fix" (default), "continue", or "stop
```

Example:
```yaml
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
```

### 4. Write Phase Instructions

Each `todo-phase-N.md` file contains the instructions the AI coding agent will receive for that phase. Be specific:

- What files to create or modify
- What the implementation should do
- Any acceptance criteria
- Links to relevant existing code or documentation

Example `todo-phase-1.md`:
```markdown
# Phase 1: Database Schema

Create the following:

1. `src/models/User.ts` — User model with fields: id, email, passwordHash, createdAt
2. `src/db/migrations/001-create-users.sql` — SQL migration for the users table
3. `src/db/index.ts` — Database connection setup

The User model should use the existing `BaseModel` in `src/models/BaseModel.ts`.
```

### 5. Run the Task

```bash
sheepdog run <task-name>
```

### 6. During Execution

- SheepDog opens opencode in a herdr pane for each phase
- The agent reads the `todo-phase-N.md` and works through it
- When done, type `/done` in the agent to signal phase completion
- SheepDog runs any \`runAfter\` commands and either proceeds to the next phase, stops on failure, or automatically retries fixing (controlled by \`onPhaseFailure\`)

## Best Practices

- **Keep phases focused** — each phase should be a self-contained unit of work (e.g., "implement the model", "write the API endpoint")
- **Add test gates** — use `runAfter` to run relevant tests between phases to catch issues early
- **Write detailed phase instructions** — the more context you give the agent, the better the outcome
- **Use `runBeforeAll`** for setup (install, build, migrate) and `runAfterAll` for final verification
- **Use \`onPhaseFailure: continue\`** when you want the agent to see and fix test failures in the next phase
- **Use \`onPhaseFailure: attempt fix\`** when you want the orchestrator to automatically retry fixing failed tests (up to 2 attempts) before aborting

## Vitest in `runAfter` / `runBeforeAll` / `runAfterAll`

Always use `npx vitest run` (not `npx vitest`) in commands. Bare `vitest` defaults to **watch mode**, which never exits and stalls the task. The orchestrator auto-inserts `run` if you use bare `vitest`, but you should not rely on this — write `vitest run` explicitly.
