# SheepDog: Overview for Coding Agents

SheepDog is a multi-phase task orchestrator. It lets you define coding
work as a sequence of phases, each with agent instructions and optional
verification gates between them.

## Where to Find Guidance

Detailed skill files are in `.sheepdog/skills/`. Read the relevant one
for your task:

| File | When to use it |
|---|---|
| `.sheepdog/skills/install.md` | First-time sheepdog setup — install, bootstrap, quick start |
| `.sheepdog/skills/create-task.md` | Creating or editing a task definition — task.yaml structure, phase design, verification steps |
| `.sheepdog/skills/handle-failure.md` | A verification step failed — understanding failure modes, diagnosing, fixing |

## Quick Reference

- Tasks live in `.sheepdog/<task-name>/`
- Each task has a `task.yaml` definition and `todo-phase-N.md` instruction files
- Run a task: `sheepdog run <task-name>`
- Signal phase completion: type `/done` or call `sheepdog_done`
- Between phases, sheepdog runs `runAfter` commands to verify work
- `onPhaseFailure` controls what happens on failure: `stop`, `continue`, or `attempt fix`
- Always use `npx vitest run` (not bare `vitest`) in commands — bare `vitest` never exits
