# Handling Failed Verification

When a phase's `runAfter` commands fail, what happens next depends on
the `onPhaseFailure` setting in `task.yaml`.

## The Three Failure Modes

### `stop` (default)

The task stops immediately. You inspect the output, fix the issue, and
re-run the task. Useful when a failure means the task cannot continue
safely (e.g., a core schema migration failed).

### `continue`

The failure output is logged and passed to the next phase as context.
The next phase's agent sees the failure and can attempt to fix it.

Example use case: A lint warning that the next phase can address while
adding new code.

### `attempt fix`

SheepDog re-opens the same phase with the failure output as additional
context. The agent sees the test failure and tries to fix it. This
retries up to 3 times. If the fix succeeds, it moves to the next phase.
If it exhausts retries, the task stops.

## What Causes Verification Failures

Common causes:

- **Incomplete implementation** — The phase didn't do everything the
  instructions asked for
- **Type errors** — Imports are wrong, interfaces don't match
- **Test assumptions changed** — The implementation changed a behavior
  that existing tests rely on
- **Missing dependencies** — The phase added code but didn't update
  `package.json`
- **Flakey tests** — Tests that pass and fail non-deterministically
  (rare, but happens)
- **Environment issues** — Missing environment variables, wrong Node
  version, unstarted services

## Diagnosing Failures

When a verification step fails, look at:

1. **The error output** — Is it a compilation error, a test assertion,
   or a timeout?
2. **Which command failed** — Was it a typecheck, a lint rule, or a
   test? Different commands need different fixes.
3. **Was the phase work actually complete?** — If the agent didn't
   finish the implementation, the fix is to complete it.

## Recovery Strategies

### If `onPhaseFailure` is `stop`

1. Identify the failure from the output
2. Make the fix manually or with your agent
3. Re-run the task: `sheepdog run <task-name>`

The task starts from the beginning. If your agent supports
checkpointing, you can resume from the failed phase:
`sheepdog resume <task-name>`.

### If `onPhaseFailure` is `continue`

The next phase receives the failure output in its context. The agent
should address the failure as part of its work. Add a note in the
next phase's `todo-phase-N.md` like:

```markdown
Note: Phase 2 ran but the following verification failed:
<include relevant error output>

Your implementation should fix this issue.
```

### If `onPhaseFailure` is `attempt fix`

The agent in the same phase sees the test output and tries to fix it.
If the agent is not fixing the issue correctly, you can:

- Provide more specific instructions in the phase's `todo-phase-N.md`
- Tighten the phase scope so less can go wrong
- Use `stop` mode and handle the fix yourself

## Preventing Failures

- **Keep phases small** — A phase that does one thing is easier to
  verify and fix than a phase that does five things
- **Write specific phase instructions** — Vague instructions lead to
  wrong implementations
- **Use typecheck/lint as early gates** — Add `npm run typecheck` and
  `npm run lint` as `runAfter` on early phases to catch issues cheaply
- **Run `runAfterAll` with the full test suite** — Final validation
  catches integration issues between phases
