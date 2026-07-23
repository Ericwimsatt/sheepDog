import { mkdirSync, existsSync, cpSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { info, success, step, warn } from '../../utils/logger.js'
import { SheepDogError } from '../../utils/errors.js'
import { SHEEPDOG_DIR } from '../../constants.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const templatesDir = join(__dirname, '..', '..', '..', 'templates', 'sheepdog')

export interface InstallOptions {
  dir: string
}

function copyIfNotExists(src: string, dest: string, isDir: boolean): void {
  if (existsSync(dest)) {
    warn(`${dest} already exists, skipping`)
    return
  }
  if (isDir) {
    cpSync(src, dest, { recursive: true })
    step(`Copied ${dest}/`)
  } else {
    cpSync(src, dest)
    step(`Created ${dest}`)
  }
}

export async function installCommand(options: InstallOptions): Promise<void> {
  const projectRoot = resolve(options.dir)

  if (!existsSync(projectRoot)) {
    throw new SheepDogError(`Directory not found: ${projectRoot}`)
  }

  info(`Bootstrapping sheepdog in ${projectRoot}`)

  const sheepdogDir = join(projectRoot, SHEEPDOG_DIR)
  mkdirSync(sheepdogDir, { recursive: true })
  step(`Created ${sheepdogDir}/`)

  const templateEntries = readdirSync(templatesDir, { withFileTypes: true })
  for (const entry of templateEntries) {
    const src = join(templatesDir, entry.name)
    const dest = join(sheepdogDir, entry.name)
    copyIfNotExists(src, dest, entry.isDirectory())
  }

  success('Sheepdog installed.')
  info(`Run \`sheepdog init\` to create your first task.`)
}
