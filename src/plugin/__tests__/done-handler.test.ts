import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { isDoneCommand, findActiveSheepDogTask, writeDoneMarker } from '../done-handler.js'
import { SHEEPDOG_DIR } from '../../constants.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sheepdog-done-test-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('isDoneCommand', () => {
  it('returns true for /done from user', () => {
    expect(isDoneCommand({ text: '/done', from: 'user' })).toBe(true)
  })

  it('returns false for other text', () => {
    expect(isDoneCommand({ text: '/help', from: 'user' })).toBe(false)
    expect(isDoneCommand({ text: '', from: 'user' })).toBe(false)
  })

  it('returns false for /Done (case sensitive)', () => {
    expect(isDoneCommand({ text: '/Done', from: 'user' })).toBe(false)
    expect(isDoneCommand({ text: '/DONE', from: 'user' })).toBe(false)
  })

  it('returns false for messages from agent', () => {
    expect(isDoneCommand({ text: '/done', from: 'agent' })).toBe(false)
  })

  it('returns true for /done with no from field', () => {
    expect(isDoneCommand({ text: '/done' })).toBe(true)
  })
})

describe('findActiveSheepDogTask', () => {
  it('finds task dir with .active-phase', () => {
    const taskDir = join(tmpDir, SHEEPDOG_DIR, 'my-task')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, '.active-phase'), 'p1', 'utf-8')

    const result = findActiveSheepDogTask(tmpDir)
    expect(result).toBe(taskDir)
  })

  it('walks up directories', () => {
    const deepDir = join(tmpDir, 'a', 'b', 'c')
    mkdirSync(deepDir, { recursive: true })
    const taskDir = join(tmpDir, SHEEPDOG_DIR, 'my-task')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, '.active-phase'), 'p1', 'utf-8')

    const result = findActiveSheepDogTask(deepDir)
    expect(result).toBe(taskDir)
  })

  it('returns null when no task found', () => {
    const result = findActiveSheepDogTask(tmpDir)
    expect(result).toBeNull()
  })

  it('returns null when sheepdog dir exists but no active task', () => {
    const taskDir = join(tmpDir, SHEEPDOG_DIR, 'inactive-task')
    mkdirSync(taskDir, { recursive: true })

    const result = findActiveSheepDogTask(tmpDir)
    expect(result).toBeNull()
  })
})

describe('writeDoneMarker', () => {
  it('creates .phase-done file', () => {
    const taskDir = join(tmpDir, SHEEPDOG_DIR, 'my-task')
    mkdirSync(taskDir, { recursive: true })

    writeDoneMarker(taskDir)

    const markerPath = join(taskDir, '.phase-done')
    expect(existsSync(markerPath)).toBe(true)

    const content = readFileSync(markerPath, 'utf-8')
    expect(content).toMatch(/^\d+$/)
  })
})
