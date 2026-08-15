/** Global Web entry: durable settings and safe managed-preset provisioning. */

import { SkillManagerStore, activateSkillManagerStore, deactivateSkillManagerStore } from './store.js'
import { ensureManagedCodePreset } from './preset.js'

export const SKILL_MANAGER_ROUTE = '/dsh-skill-manager/settings'
export { SKILL_MANAGER_SETTINGS_PATH } from './store.js'

const CLIENT_REQUEST_HEADER = 'x-dsh-skill-manager'
const MAX_REQUEST_BYTES = 64 * 1024

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
        respondJson(res, 200, { settings: await store.update(await readRequestJson(req)) })
      } catch (error) {
        respondJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}

/** Host services required by the private settings route and preset authoring. */
export const inject = ['webServer', 'agentPresets']

/** Initialize settings before a managed preset mounts its scoped provider. */
export async function apply(ctx) {
  const store = new SkillManagerStore(ctx)
  await store.load()
  activateSkillManagerStore(store)

  try {
    await ensureManagedCodePreset(ctx.agentPresets)
  } catch (error) {
    ctx.logger?.warn?.(error instanceof Error ? error : new Error(String(error)))
  }

  const unregisterRoute = registerSettingsRoute(ctx, store)
  ctx.effect(() => () => {
    unregisterRoute()
    deactivateSkillManagerStore(store)
  }, 'skill-manager lifecycle')
}
