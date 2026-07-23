import { run_command, run_function, checkpoint } from '@sheepdog/sandbox'

await run_command({ command: 'echo first' })
await run_function(() => { return 'expensive' })
await checkpoint('mid-point')
await run_command({ command: 'echo last' })
