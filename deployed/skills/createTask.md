To create a task:
Create the following folder structure:
.sheepdog
    |_[task_name]
        |_steps
            |_[step_name]
                instructions.md
                verification.tsx (Can be .sh for shell command, or .md for agent instructions)



Create a task folder in .sheepdog
In the task folder create a "plan" folder
Create a markdown file instructing an agent how to do each step of the plan.

In the task folder, create main.tsx.
main.tsx uses the primitives included in .sheepdog to direct the worktree.

runAgentStep(
    {
        agent: opencode,
        plan: path to pla (.md),
        on_verification_fail: "fix"|"stop"|"continue",
        checkpoint_on_complete?: boolean (default true)
    }
)

Most tasks can be completed with a series of calls to runAgentStep, but its possible others will call different functions in the future. 

Other useful functions:

/* Runs test functions, and reports on the output
[success, output] = run_verification({
    path: path to test file. (Can be .ts(x) for a script, .sh for shell command, or .md for agent instructions)
})
/* Runs an agent
run_agent({
    agent: openCode,
    instructions: .md file,
})

/* Runs anything, but will skip it if loading to a checkpoint in the future. Will cause bugs if it isn't idempotent
run_function({})

/* Creates a checkpoint that work can be resumed from in the future. 
checkpoint(name)