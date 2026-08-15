/** Host half of the local Skill Manager provider and private Web API. */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { FileSystemSkillProvider } from '@deepseek-ai/dsh-skill-filesystem'
import { normalizeSkillManagerSettings, projectSkillCandidates } from './policy.js'

export const SKILL_MANAGER_ROUTE = '/dsh-skill-manager/settings'
export const SKILL_MANAGER_SETTINGS_PATH = dshHomePath('skill-manager.json')
const CLIENT_REQUEST_HEADER = 'x-dsh-skill-manager'
const MAX_REQUEST_BYTES = 64 * 1024

class SkillManagerStore {
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

/**
 * A filesystem provider that can be rebuilt when the user changes settings.
 * The DSH parser and watcher remain in FileSystemSkillProvider; this wrapper
 * only owns the mutable configuration and disabled-name policy.
 */
class ManagedSkillProvider {
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

function respondJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function isTrustedBrowserRequest(req) {
  return req.headers[CLIENT_REQUEST_HEADER] === '1'
}

async function readRequestJson(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    size += buffer.length
    if (size > MAX_REQUEST_BYTES) throw new Error('request body is too large')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.length === 0) throw new Error('request body is required')
  const value = JSON.parse(text)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('request body must be an object')
  }
  return value
}

function registerSettingsRoute(ctx, store) {
  return ctx.webServer.register({
    kind: 'exact',
    path: SKILL_MANAGER_ROUTE,
    handler: async (req, res) => {
      if (!isTrustedBrowserRequest(req)) {
        respondJson(res, 403, { error: 'forbidden' })
        return
      }
      if (req.method === 'GET') {
        respondJson(res, 200, { settings: store.snapshot() })
        return
      }
      if (req.method !== 'PUT') {
        respondJson(res, 405, { error: 'method not allowed' })
        return
      }
      try {
        const value = await readRequestJson(req)
        respondJson(res, 200, { settings: await store.update(value) })
      } catch (error) {
        respondJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}

/** Host services required by the provider and private same-origin route. */
export const inject = ['skills', 'webServer']

/** Start the provider with durable config from DSH home. */
export async function apply(ctx) {
  const store = new SkillManagerStore(ctx)
  await store.load()

  let provider
  const unregisterProvider = ctx.skills.registerProvider(control => {
    provider = new ManagedSkillProvider(ctx, control, store.snapshot())
    return provider
  })
  const unwatch = store.watch(next => provider?.update(next))
  const unregisterRoute = registerSettingsRoute(ctx, store)

  ctx.effect(() => () => {
    unwatch()
    unregisterRoute()
    unregisterProvider()
  }, 'skill-manager lifecycle')
}
