const PREFIX = '\x1b[34m[sheepdog]\x1b[0m'

export function info(msg: string): void {
  console.log(`${PREFIX} ${msg}`)
}

export function success(msg: string): void {
  console.log(`${PREFIX} \x1b[32m\u2713\x1b[0m ${msg}`)
}

export function warn(msg: string): void {
  console.log(`${PREFIX} \x1b[33m\u26a0\x1b[0m ${msg}`)
}

export function error(msg: string): void {
  console.error(`${PREFIX} \x1b[31m\u2717\x1b[0m ${msg}`)
}

export function step(msg: string): void {
  console.log(`  \x1b[90m\u2192\x1b[0m ${msg}`)
}
