/** Create a user-owned code preset that mounts the managed provider safely. */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { addManagedProvider } from './preset-composition.js'

export { addManagedProvider } from './preset-composition.js'

export const MANAGED_PRESET_ID = 'skill-manager-code'
const PRESET_FILE = join(dshHomePath('.agent-presets'), MANAGED_PRESET_ID, 'agent.cordis.yml')

export async function ensureManagedCodePreset(agentPresets) {
  const known = await agentPresets.list()
  if (!known.some(preset => preset.id === MANAGED_PRESET_ID)) {
    await agentPresets.copy('code', MANAGED_PRESET_ID, 'Code (Skill Manager)')
  }
  const composition = await readFile(PRESET_FILE, 'utf8')
  const next = addManagedProvider(composition)
  if (next !== composition) await writeFile(PRESET_FILE, next, 'utf8')
}

