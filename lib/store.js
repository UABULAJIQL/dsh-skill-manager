/** Durable settings shared by the global Web entry and preset-scoped provider. */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { normalizeSkillManagerSettings } from './policy.js'

export const SKILL_MANAGER_SETTINGS_PATH = dshHomePath('skill-manager.json')

let activeStore

export class SkillManagerStore {
  #ctx
  #path
  #value = normalizeSkillManagerSettings()
  #listeners = new Set()

  constructor(ctx, path = SKILL_MANAGER_SETTINGS_PATH) {
    this.#ctx = ctx
    this.#path = path
  }

  snapshot() {
    return {
      includeDefaultRoots: this.#value.includeDefaultRoots,
      paths: [...this.#value.paths],
      disabled: [...this.#value.disabled],
    }
  }

  async load() {
    try {
      this.#value = normalizeSkillManagerSettings(JSON.parse(await readFile(this.#path, 'utf8')))
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') return
      this.#ctx.logger?.warn?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  watch(listener) {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async update(value) {
    const next = normalizeSkillManagerSettings(value)
    await mkdir(dirname(this.#path), { recursive: true })
    await writeFile(this.#path, JSON.stringify(next, null, 2) + '\n', 'utf8')
    this.#value = next
    await Promise.all([...this.#listeners].map(listener => listener(this.snapshot())))
    return this.snapshot()
  }
}

export function activateSkillManagerStore(store) {
  activeStore = store
}

export function deactivateSkillManagerStore(store) {
  if (activeStore === store) activeStore = undefined
}

export function getSkillManagerStore() {
  if (activeStore === undefined) throw new Error('Skill Manager settings are not initialized')
  return activeStore
}
