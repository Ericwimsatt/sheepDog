import { describe, it, expect } from 'vitest'
import {
  replaceSandboxImports,
  replaceSandboxImportsRegex,
  replaceSandboxImportsAST,
  validateImports,
} from '../resolver.js'

describe('replaceSandboxImports (default — AST strategy)', () => {
  it('transforms named imports', () => {
    const input = `import { runAgentStep, run_command } from '@sheepdog/sandbox'`
    const result = replaceSandboxImports(input)
    expect(result).toBe(
      `const { runAgentStep, run_command } = __sheepdog_sandbox_api__;`
    )
  })

  it('transforms default imports', () => {
    const input = `import api from '@sheepdog/sandbox'`
    const result = replaceSandboxImports(input)
    expect(result).toBe(`const api = __sheepdog_sandbox_api__;`)
  })

  it('transforms mixed imports', () => {
    const input = `import api, { a } from '@sheepdog/sandbox'`
    const result = replaceSandboxImports(input)
    expect(result).toBe(
      `const api = __sheepdog_sandbox_api__;\nconst { a } = __sheepdog_sandbox_api__;`
    )
  })

  it('transforms namespace imports', () => {
    const input = `import * as api from '@sheepdog/sandbox'`
    const result = replaceSandboxImports(input)
    expect(result).toBe(`const api = __sheepdog_sandbox_api__;`)
  })

  it('strips type-only sandbox imports entirely', () => {
    const input = `import type { SandboxAPI } from '@sheepdog/sandbox'`
    const result = replaceSandboxImports(input)
    expect(result).toBe('')
  })

  it('strips type-only non-sandbox imports', () => {
    const input = [
      `import { runAgentStep } from '@sheepdog/sandbox'`,
      `import type { SomeType } from 'some-module'`,
    ].join('\n')
    const result = replaceSandboxImports(input)
    expect(result).toContain(`const { runAgentStep } = __sheepdog_sandbox_api__;`)
    expect(result).not.toContain(`import type`)
    expect(result).not.toContain(`some-module`)
  })

  it('passes through code with no sandbox imports and no other imports', () => {
    const input = `console.log('hello')`
    const result = replaceSandboxImports(input)
    expect(result).toBe(input)
  })

  it('throws on non-sandbox imports', () => {
    const input = `import { something } from 'some-package'`
    expect(() => replaceSandboxImports(input)).toThrow('Non-sandbox imports')
  })

  it('throws on multiple sandbox imports', () => {
    const input = [
      `import { a } from '@sheepdog/sandbox'`,
      `import { b } from '@sheepdog/sandbox'`,
    ].join('\n')
    expect(() => replaceSandboxImports(input)).toThrow(
      'Multiple imports from @sheepdog/sandbox'
    )
  })

  it('handles complex multi-line imports', () => {
    const input = `import {\n  runAgentStep,\n  run_command\n} from '@sheepdog/sandbox'`
    const result = replaceSandboxImports(input)
    expect(result).toBe(
      `const { runAgentStep, run_command } = __sheepdog_sandbox_api__;`
    )
  })

  it('handles import type modifier on specific bindings', () => {
    const input = `import { type A, B } from '@sheepdog/sandbox'`
    const result = replaceSandboxImports(input)
    expect(result).toBe(`const { B } = __sheepdog_sandbox_api__;`)
  })
})

describe('replaceSandboxImportsRegex', () => {
  it('transforms named imports', () => {
    const input = `import { runAgentStep } from '@sheepdog/sandbox'`
    const result = replaceSandboxImportsRegex(input)
    expect(result).toBe(
      `const { runAgentStep } = __sheepdog_sandbox_api__;`
    )
  })

  it('throws on unsupported sandbox patterns (default import)', () => {
    const input = `import api from '@sheepdog/sandbox'`
    expect(() => replaceSandboxImportsRegex(input)).toThrow(
      'only supports named imports'
    )
  })

  it('throws on non-sandbox imports', () => {
    const input = `import { x } from 'other'`
    expect(() => replaceSandboxImportsRegex(input)).toThrow(
      'Non-sandbox imports'
    )
  })

  it('passes through when no imports exist', () => {
    const input = `const x = 1`
    expect(replaceSandboxImportsRegex(input)).toBe(input)
  })
})

describe('replaceSandboxImportsAST', () => {
  it('handles all pattern types (same as default)', () => {
    expect(
      replaceSandboxImportsAST(`import { a } from '@sheepdog/sandbox'`)
    ).toBe(`const { a } = __sheepdog_sandbox_api__;`)

    expect(
      replaceSandboxImportsAST(`import def from '@sheepdog/sandbox'`)
    ).toBe(`const def = __sheepdog_sandbox_api__;`)

    expect(
      replaceSandboxImportsAST(`import * as ns from '@sheepdog/sandbox'`)
    ).toBe(`const ns = __sheepdog_sandbox_api__;`)

    expect(
      replaceSandboxImportsAST(
        `import def, { a } from '@sheepdog/sandbox'`
      )
    ).toBe(
      `const def = __sheepdog_sandbox_api__;\nconst { a } = __sheepdog_sandbox_api__;`
    )
  })
})

describe('validateImports', () => {
  it('passes with no imports', () => {
    expect(() => validateImports(`const x = 1`)).not.toThrow()
  })

  it('passes with only sandbox imports', () => {
    expect(() =>
      validateImports(`import { a } from '@sheepdog/sandbox'`)
    ).not.toThrow()
  })

  it('throws on non-sandbox imports', () => {
    expect(() =>
      validateImports(`import { a } from 'other'`)
    ).toThrow('Non-sandbox imports')
  })

  it('passes with type-only non-sandbox imports', () => {
    expect(() =>
      validateImports(`import type { SomeType } from 'other'`)
    ).not.toThrow()
  })

  it('throws on mixed sandbox and non-sandbox imports', () => {
    const input = [
      `import { a } from '@sheepdog/sandbox'`,
      `import { b } from 'other'`,
    ].join('\n')
    expect(() => validateImports(input)).toThrow('Non-sandbox imports')
  })

  it('passes with empty source', () => {
    expect(() => validateImports('')).not.toThrow()
  })
})
