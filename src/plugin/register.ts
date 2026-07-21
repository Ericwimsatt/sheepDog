import type { Hooks } from '@opencode-ai/plugin'
import type { Part } from '@opencode-ai/sdk'
import { findActiveSheepDogTask, isDoneCommand, writeDoneMarker } from './done-handler.js'

const SheepDogPlugin: Hooks = {
  'chat.message': async (_input, output) => {
    if (output.message.role !== 'user') return

    const text = output.parts
      .filter((p): p is Part & { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('')

    if (!isDoneCommand({ text, from: 'user' })) return

    const taskDir = findActiveSheepDogTask(process.cwd())
    if (!taskDir) return

    writeDoneMarker(taskDir)
  },
}

export default SheepDogPlugin
