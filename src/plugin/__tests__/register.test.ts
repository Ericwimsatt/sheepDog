import { describe, it, expect } from 'vitest'
import SheepDogPlugin from '../register.js'
import { findActiveSheepDogTask, isDoneCommand, writeDoneMarker } from '../done-handler.js'

describe('plugin exports', () => {
  it('exports default hooks object', () => {
    expect(SheepDogPlugin).toBeDefined()
    expect(typeof SheepDogPlugin).toBe('object')
  })

  it('has chat.message hook', () => {
    expect(SheepDogPlugin).toHaveProperty('chat.message')
    expect(typeof SheepDogPlugin['chat.message']).toBe('function')
  })

  it('re-exports done-handler functions from index', async () => {
    const mod = await import('../index.js')
    expect(mod.findActiveSheepDogTask).toBe(findActiveSheepDogTask)
    expect(mod.isDoneCommand).toBe(isDoneCommand)
    expect(mod.writeDoneMarker).toBe(writeDoneMarker)
  })
})
