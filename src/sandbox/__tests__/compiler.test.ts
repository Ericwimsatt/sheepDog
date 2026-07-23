import { describe, it, expect } from 'vitest'
import { compileSandboxScript } from '../compiler.js'

describe('compileSandboxScript', () => {
  it('compiles TS to JS and replaces sandbox imports', () => {
    const input = [
      `import { runAgentStep } from '@sheepdog/sandbox'`,
      `const x: number = 42`,
      `export async function main() {`,
      `  return runAgentStep({ planFile: 'plan.md' })`,
      `}`,
    ].join('\n')

    const result = compileSandboxScript(input, 'test.ts')

    expect(result).not.toContain(`from '@sheepdog/sandbox'`)
    expect(result).toContain(`__sheepdog_sandbox_api__`)
    expect(result).not.toContain(': number')
    expect(result).not.toContain('import {')
  })

  it('strips type-only sandbox imports', () => {
    const input = [
      `import type { SandboxAPI } from '@sheepdog/sandbox'`,
      `export const x = 1`,
    ].join('\n')

    const result = compileSandboxScript(input, 'test.ts')

    expect(result).not.toContain('SandboxAPI')
    expect(result).not.toContain('@sheepdog/sandbox')
    expect(result).toContain('x = 1')
  })

  it('transforms default imports', () => {
    const input = [
      `import api from '@sheepdog/sandbox'`,
      `api.runAgentStep({ planFile: 'plan.md' })`,
    ].join('\n')
    const result = compileSandboxScript(input, 'test.ts')
    expect(result).toContain(`const api = __sheepdog_sandbox_api__;`)
    expect(result).toContain(`api.runAgentStep`)
  })

  it('transforms namespace imports', () => {
    const input = [
      `import * as api from '@sheepdog/sandbox'`,
      `api.runAgentStep({ planFile: 'plan.md' })`,
    ].join('\n')
    const result = compileSandboxScript(input, 'test.ts')
    expect(result).toContain(`const api = __sheepdog_sandbox_api__;`)
    expect(result).toContain(`api.runAgentStep`)
  })

  it('transforms mixed imports', () => {
    const input = [
      `import api, { a } from '@sheepdog/sandbox'`,
      `api.runAgentStep({ planFile: 'plan.md' })`,
      `a()`,
    ].join('\n')
    const result = compileSandboxScript(input, 'test.ts')
    expect(result).toContain(`const api = __sheepdog_sandbox_api__;`)
    expect(result).toContain(`const { a } = __sheepdog_sandbox_api__;`)
  })

  it('throws on non-sandbox imports', () => {
    const input = [
      `import { runAgentStep } from '@sheepdog/sandbox'`,
      `import { something } from 'some-package'`,
      `runAgentStep({ planFile: 'plan.md' })`,
      `something()`,
    ].join('\n')

    expect(() => compileSandboxScript(input, 'test.ts')).toThrow(
      'Non-sandbox imports'
    )
  })

  it('throws on multiple sandbox imports', () => {
    const input = [
      `import { a } from '@sheepdog/sandbox'`,
      `import { b } from '@sheepdog/sandbox'`,
      `a() + b()`,
    ].join('\n')

    expect(() => compileSandboxScript(input, 'test.ts')).toThrow(
      'Multiple imports from @sheepdog/sandbox'
    )
  })

  it('allows type-only non-sandbox imports (stripped by TS)', () => {
    const input = [
      `import { runAgentStep } from '@sheepdog/sandbox'`,
      `import type { SomeType } from 'some-module'`,
      `const x: SomeType = 1`,
      `runAgentStep({ planFile: 'plan.md' })`,
    ].join('\n')

    const result = compileSandboxScript(input, 'test.ts')
    expect(result).toContain('__sheepdog_sandbox_api__')
    expect(result).toContain('x = 1')
    expect(result).not.toContain('some-module')
    expect(result).not.toContain('SomeType')
  })

  it('handles code with no imports', () => {
    const input = `const x: number = 42;\nexport const y: string = 'hello';`
    const result = compileSandboxScript(input, 'test.ts')
    expect(result).not.toContain(': number')
    expect(result).not.toContain(': string')
    expect(result).toContain('x = 42')
  })
})
