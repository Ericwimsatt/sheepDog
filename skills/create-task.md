# Creating a SheepDog Task

A task is a sequence of phases, each with agent instructions and
optional verification gates. Tasks live in `.sheepdog/<task-name>/`.

## Task Directory Structure

```
.sheepdog/<task-name>/
├── task.yaml            # Task definition — phases, commands, settings
├── todo-phase-1.md      # Agent instructions for phase 1
├── todo-phase-2.md      # Agent instructions for phase 2
└── ...                  # One file per phase
```

## Writing `task.yaml`

```yaml
name: my-task
phases:
  - description: "Set up the database schema"
  - description: "Implement the API endpoints"
    runAfter:
      - npm run test:db
  - description: "Add integration tests"
    runAfter:
      - npm test
runBeforeAll:
  - npm install
runAfterAll:
  - npm test
onPhaseFailure: stop
```

### Fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Matches the directory name |
| `phases` | Yes | List of 1–10 phases in order |
| `runBeforeAll` | No | Commands before any phase starts |
| `runAfterAll` | No | Commands after all phases complete |
| `nudgeInterval` | No | Seconds between "still working?" nudges (omit to disable) |
| `onPhaseFailure` | No | `stop`, `continue`, or `attempt fix` (default: `attempt fix`) |

Each phase supports:

| Field | Required | Description |
|---|---|---|
| `description` | Yes | Short label shown in progress output |
| `runAfter` | No | Commands to verify work after this phase |

## What Makes a Good Verification Step

A verification step (the commands in `runAfter` or `runAfterAll`) should
be **fast**, **deterministic**, and **specific** to what the phase just
produced.

### Good verification commands

- `npm run typecheck` — catches type errors immediately
- `npm run lint` — enforces style and catches common bugs
- `npm test` — runs the full test suite
- `npm run test:unit` — unit tests for a specific module
- `npm run test:db` — database integration tests
- `npm run build` — confirms the project compiles
- Custom scripts like `node scripts/validate-config.js`

### Avoid

- Long-running CI pipelines (save those for `runAfterAll`)
- Interactive commands that never exit
- Commands that depend on external services being available
- Commands with non-deterministic results (flakey tests)

### The Vitest Gotcha

If you use Vitest, always write `npx vitest run` (not bare `vitest`).
Bare `vitest` defaults to watch mode and never exits, which stalls the
task.

```yaml
# ✅ Correct
runAfter:
  - npx vitest run

# ❌ Wrong — hangs forever
runAfter:
  - npx vitest
```

## Writing Good Phase Instructions

Each `todo-phase-N.md` is given to the agent as its only instruction for
that phase. Be specific:

- **What files to create or modify** — list exact paths
- **What the implementation should do** — describe behavior, not just "implement X"
- **Acceptance criteria** — how to verify the work is done
- **Links to existing code** — point to patterns the agent should follow

### Example

```markdown
# Phase 1: Database Schema

Create the following:

1. `src/models/User.ts` — User model with fields: id, email,
   passwordHash, createdAt. Use the existing `BaseModel` in
   `src/models/BaseModel.ts`.
2. `src/db/migrations/001-create-users.sql` — SQL migration for the users
   table with the same fields.
3. `src/db/index.ts` — Database connection setup using the existing
   `src/db/config.ts`.
```

## How to Split Work Into Phases

Good phase decomposition follows these principles:

- **Each phase produces something testable** — You should be able to run
  a verification command after each phase that confirms the work is correct.
- **Phases are sequential** — Phase 2 depends on phase 1 being complete.
  If two pieces of work are independent, they belong in the same phase.
- **Keep phases focused** — A phase should do one thing well (e.g.,
  "implement the model", not "implement the model and the API and the tests").
- **3–6 phases is typical** — Fewer than 3 is probably not decomposed
  enough; more than 8 is probably too granular.

### Common phase breakdowns

For a feature:
1. Database schema / models
2. API endpoints
3. Integration tests
4. Documentation / polish

For a refactor:
1. Extract utility functions
2. Update callers
3. Remove old code
4. Verify with tests

## Scaffolding a New Task

```bash
sheepdog init
# or with a custom name:
sheepdog init --task-name add-auth
```

## Task from a Description

If you have an AI agent available, you can generate a task plan from a
description:

```bash
sheepdog plan "Add user authentication with JWT"
```

This asks the agent to decompose the work into phases and write the
`task.yaml` and phase instruction files.
