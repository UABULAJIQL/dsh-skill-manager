/** Settings-aware filesystem provider mounted inside a preset scope. */

import { FileSystemSkillProvider } from '@deepseek-ai/dsh-skill-filesystem'
import { normalizeSkillManagerSettings, projectSkillCandidates } from './policy.js'

export class ManagedSkillProvider {
  name = 'skill-manager'
  #ctx
  #control
  #current
  #defaultRoots
  #disabled = new Set()
  #candidateProviders = new WeakMap()
  #blockedCandidates = new WeakSet()
  #disposed = false

  constructor(ctx, control, settings) {
    this.#ctx = ctx
    this.#control = control
    this.#install(settings)
  }

  async list(options) {
    const provider = this.#current
    const observed = await provider.list(options)
    const candidates = Array.isArray(observed) ? observed : observed.candidates
    const managed = projectSkillCandidates(candidates, this.#disabled)
    for (const candidate of managed) this.#candidateProviders.set(candidate, provider)

    if (this.#defaultRoots !== undefined) {
      const observedDefaults = await this.#defaultRoots.list(options)
      const defaults = Array.isArray(observedDefaults) ? observedDefaults : observedDefaults.candidates
      const configuredNames = new Set(candidates.map(candidate => candidate.name))
      const hiddenDefaults = defaults.filter(candidate => !configuredNames.has(candidate.name))
      const blocked = projectSkillCandidates(hiddenDefaults, hiddenDefaults.map(candidate => candidate.name))
      for (const candidate of blocked) {
        this.#candidateProviders.set(candidate, this.#defaultRoots)
        this.#blockedCandidates.add(candidate)
      }
      managed.push(...blocked)
    }

    const presentNames = new Set(managed.map(candidate => candidate.name))
    for (const name of this.#disabled) {
      if (presentNames.has(name)) continue
      const blocked = disabledSkillCandidate(name)
      this.#blockedCandidates.add(blocked)
      managed.push(blocked)
    }
    return Array.isArray(observed) ? managed : { ...observed, candidates: managed }
  }

  async get(candidate, options) {
    if (this.#disabled.has(candidate.name) || this.#blockedCandidates.has(candidate)) return undefined
    const provider = this.#candidateProviders.get(candidate) ?? this.#current
    return provider.get(candidate, options)
  }

  async update(settings) {
    if (this.#disposed) return
    const previous = this.#current
    const previousDefaults = this.#defaultRoots
    this.#install(settings)
    this.#control.invalidate()
    await Promise.all([previous.dispose(), previousDefaults?.dispose()])
  }

  async dispose() {
    if (this.#disposed) return
    this.#disposed = true
    await Promise.all([this.#current.dispose(), this.#defaultRoots?.dispose()])
  }

  #install(settings) {
    const normalized = normalizeSkillManagerSettings(settings)
    this.#disabled = new Set(normalized.disabled)
    this.#candidateProviders = new WeakMap()
    this.#blockedCandidates = new WeakSet()
    this.#current = new FileSystemSkillProvider(this.#ctx, this.#control, {
      providerName: this.name,
      includeDefaultRoots: normalized.includeDefaultRoots,
      customSkillDirs: normalized.paths,
    })
    this.#defaultRoots = normalized.includeDefaultRoots ? undefined : new FileSystemSkillProvider(this.#ctx, this.#control, {
      providerName: this.name,
      includeDefaultRoots: true,
      customSkillDirs: [],
    })
  }
}

function disabledSkillCandidate(name) {
  return {
    name,
    description: 'Disabled by Skill Manager',
    invocation: { modelInvocable: false, userInvocable: false },
    source: 'skill-manager',
    provider: 'skill-manager',
    rank: -1000000,
    locator: null,
  }
}
