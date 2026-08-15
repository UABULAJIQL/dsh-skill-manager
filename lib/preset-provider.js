/** Preset-scoped entry: safely overrides same-name filesystem candidates. */

import { ManagedSkillProvider } from './provider.js'
import { getSkillManagerStore } from './store.js'

export const inject = ['skills']

export function apply(ctx) {
  const store = getSkillManagerStore()
  let provider
  const unregisterProvider = ctx.skills.registerProvider(control => {
    provider = new ManagedSkillProvider(ctx, control, store.snapshot())
    return provider
  })
  const unwatch = store.watch(next => provider?.update(next))

  ctx.effect(() => () => {
    unwatch()
    unregisterProvider()
  }, 'skill-manager preset provider')
}
