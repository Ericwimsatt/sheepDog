import { describe, it, expect } from 'vitest'

describe('CLI index', () => {
  it('all 5 commands are registered', async () => {
    const { program } = await import('../index.js')

    const commands = program.commands.map((c: any) => c.name())
    expect(commands).toContain('init')
    expect(commands).toContain('run')
    expect(commands).toContain('status')
    expect(commands).toContain('list')
    expect(commands).toContain('plan')
  })

  it('--help shows all commands', async () => {
    const { program } = await import('../index.js')
    const helpText = program.helpInformation()
    expect(helpText).toContain('init')
    expect(helpText).toContain('run')
    expect(helpText).toContain('status')
    expect(helpText).toContain('list')
    expect(helpText).toContain('plan')
  })

  it('--version shows version', async () => {
    const { program } = await import('../index.js')
    expect(program.version()).toBe('0.1.0')
  })
})
