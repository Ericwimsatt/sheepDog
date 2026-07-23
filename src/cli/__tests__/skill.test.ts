import { describe, it, expect } from 'vitest'

describe('skill CLI commands', () => {
  it('creates skill command with list, install, remove subcommands', async () => {
    const { createSkillCommand } = await import('../commands/skill.js')
    const cmd = createSkillCommand()
    const subcommands = cmd.commands.map((c: any) => c.name())
    expect(subcommands).toContain('list')
    expect(subcommands).toContain('install')
    expect(subcommands).toContain('remove')
  })

  it('is registered in the main program', async () => {
    const { program } = await import('../index.js')
    const commands = program.commands.map((c: any) => c.name())
    expect(commands).toContain('skill')
  })

  it('skill --help shows subcommands', async () => {
    const { createSkillCommand } = await import('../commands/skill.js')
    const cmd = createSkillCommand()
    const help = cmd.helpInformation()
    expect(help).toContain('list')
    expect(help).toContain('install')
    expect(help).toContain('remove')
  })
})
