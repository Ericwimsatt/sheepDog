# SheepDog

Multi-phase agent task orchestrator for [herdr](https://herdr.dev) + [opencode](https://opencode.ai).

Define multi-step coding tasks with test gates between phases, then run them with an AI agent.

## Prerequisites

- [herdr](https://herdr.dev) — terminal workspace manager
- [opencode](https://opencode.ai) — AI coding agent (with the herdr-opencode integration installed)
- Node.js >= 18

## Installation

```bash
npm install -g sheepdog
```

Or run directly from the repo:

```bash
npm install
npm run build
node dist/cli/index.js --help
```

## Quick Start

```bash
# Bootstrap sheepdog in a project (creates .sheepdog/ dir + AGENTS.md)
sheepdog install

# Scaffold a new task interactively
sheepdog init

# List available tasks
sheepdog list

# Run a task
sheepdog run my-task

# Check status of running/completed tasks
sheepdog status

# Generate a task plan from a description
sheepdog plan "Add user authentication with JWT"
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `sheepdog install` | Bootstrap sheepdog in a project (creates `.sheepdog/` + `AGENTS.md`) |
| `sheepdog init` | Scaffold a new task definition |
| `sheepdog list` | List all available tasks |
| `sheepdog run <task>` | Execute a task |
| `sheepdog status [task]` | Show phase status for all or a specific task |
| `sheepdog plan <description>` | Use AI to generate a task from a description |

## How It Works

1. A **task** is defined in `.sheepdog/<task-name>/task.yaml` with up to 10 phases
2. Each phase has a corresponding `todo-phase-*.md` file with instructions for the agent
3. `sheepdog run <task>` launches opencode in a new herdr pane for each phase
4. The agent works through the phase — you type `/done` to signal completion
5. SheepDog runs test commands between phases to verify work
6. If tests fail, the run either stops, continues with output passed to the next phase, or automatically retries fixing (based on `onPhaseFailure`)
7. Final verification tests run after all phases complete

## Task File Format

Task definitions live in `.sheepdog/<task-name>/task.yaml`:

```yaml
name: my-task
phases:
  - description: "Set up the database schema"
  - description: "Implement the API endpoints"
    runAfter:
      - npm run test:db
schemas:
  - npm run lint
runBeforeAll:
  - npm install
runAfterAll:
  - npm run test
onPhaseFailure: stop  # "stop", "continue", or "attempt fix"
```

## Development

```bash
npm test              # Run tests
npm run typecheck     # Type-check without emitting
npm run build         # Compile TypeScript
```

### Using your local build in other repos

```bash
# In the sheepdog repo — link the CLI globally
npm link

# Rebuild after making changes
npm run build

# Now in any other repo, the `sheepdog` command uses your local build
cd /path/to/other-project
sheepdog install
sheepdog init
sheepdog run my-task
```

To unlink the local version and revert to the published package:

```bash
# In the sheepdog repo
npm unlink --global sheepdog
```
