# SheepDog: Install & First-Time Setup

SheepDog is a multi-phase agent task orchestrator. You define coding
tasks as a sequence of phases, each with agent instructions and optional
test gates between them.

## Prerequisites

- Node.js >= 18
- An AI coding agent capable of executing shell commands and editing files
- (Optional) [herdr](https://herdr.dev) for terminal workspace management

## Installing SheepDog

```bash
# Global install (recommended for CLI access everywhere)
npm install -g sheepdog

# Or as a project devDependency
npm install --save-dev sheepdog
```

## Bootstrapping a Project

From the project root:

```bash
sheepdog install
```

This creates:
- `.sheepdog/` — directory for all sheepdog task definitions and state
- `.sheepdog/AGENTS.md` — instructions your coding agent reads
- `.sheepdog/skills/` — detailed guidance files for specific topics

## Creating Your First Task

```bash
sheepdog init
```

This scaffolds a 4-phase task skeleton under `.sheepdog/my-task/`. Edit the
`task.yaml` and `todo-phase-*.md` files to describe your actual work.

## Running a Task

```bash
sheepdog run my-task
```

SheepDog launches your agent for each phase in sequence. The agent reads
the phase instructions and works through them. Type `/done` (or call the
`sheepdog_done` tool if your agent supports it) to signal phase completion.

Between phases, sheepdog runs any `runAfter` test commands to verify the
work before proceeding.

## Understanding the Task Lifecycle

1. **Define** — Create `.sheepdog/<task>/task.yaml` + phase instructions
2. **Run** — `sheepdog run <task>` starts execution
3. **Phase executes** — Agent reads `todo-phase-N.md` and does the work
4. **Verify** — `runAfter` commands run; pass or fail determines next step
5. **Repeat** — Next phase starts, or the task completes with `runAfterAll`

## Next Steps

Read the other skills in this directory for detailed guidance:
- `create-task.md` — How to write good task definitions and verification steps
- `handle-failure.md` — What happens when verification fails
