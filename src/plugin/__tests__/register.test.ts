import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import SheepDogPlugin from '../register.js'
import { findActiveSheepDogTask, isDoneCommand, writeDoneMarker } from '../done-handler.js'
import { SHEEPDOG_DIR } from '../../constants.js'

describe('plugin exports', () => {
  it('exports default hooks object', () => {
    expect(SheepDogPlugin).toBeDefined()
    expect(typeof SheepDogPlugin).toBe('object')
  })

  it('has chat.message hook', () => {
    expect(SheepDogPlugin).toHaveProperty('chat.message')
    expect(typeof SheepDogPlugin['chat.message']).toBe('function')
  })

  it('has tool.sheepdog_done hook', () => {
    expect(SheepDogPlugin).toHaveProperty('tool')
    expect(SheepDogPlugin.tool).toHaveProperty('sheepdog_done')
  })

  it('re-exports done-handler functions from index', async () => {
    const mod = await import('../index.js')
    expect(mod.findActiveSheepDogTask).toBe(findActiveSheepDogTask)
    expect(mod.isDoneCommand).toBe(isDoneCommand)
    expect(mod.writeDoneMarker).toBe(writeDoneMarker)
  })
})

describe('sheepdog_done tool', () => {
  let tmpDir: string
  let taskDir: string
  const doneTool = SheepDogPlugin.tool?.sheepdog_done

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-register-test-'))
    taskDir = join(tmpDir, SHEEPDOG_DIR, 'my-task')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, '.active-phase'), 'p1', 'utf-8')
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('has description', () => {
    expect(doneTool?.description).toBeTruthy()
  })

  it('writes .phase-done marker when executed', async () => {
    const result = await doneTool?.execute({}, {
      sessionID: 'test',
      messageID: 'test',
      agent: 'test',
      directory: tmpDir,
      worktree: tmpDir,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    })

    expect(result).toBe('Phase completion signaled')
    expect(existsSync(join(taskDir, '.phase-done'))).toBe(true)
  })

  it('returns message when no active task found', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'sheepdog-empty-'))

    const result = await doneTool?.execute({}, {
      sessionID: 'test',
      messageID: 'test',
      agent: 'test',
      directory: emptyDir,
      worktree: emptyDir,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    })

    expect(String(result)).toContain('No active sheepdog task found')
    expect(String(result)).toContain('Search diagnostics:')
    expect(String(result)).toContain('Starting search from:')
    rmSync(emptyDir, { recursive: true, force: true })
  })
})
