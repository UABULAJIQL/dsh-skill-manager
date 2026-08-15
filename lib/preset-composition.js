/** Pure composition transform for the user-owned managed preset. */

const MANAGED_MARKER = "name: '@sqnb/dsh-skill-manager/preset'"
const FILESYSTEM_ROW = "- id: skill-filesystem\n  name: '@deepseek-ai/dsh-skill-filesystem'\n\n"
const MANAGED_ROW = "- id: skill-filesystem\n  name: '@sqnb/dsh-skill-manager/preset'\n\n"
const LEGACY_PROVIDER_ROW = "- id: sqnb-skill-manager-provider\n  name: '@sqnb/dsh-skill-manager/preset-provider'\n\n"

export function addManagedProvider(composition) {
  if (composition.includes(LEGACY_PROVIDER_ROW)) {
    return composition.replace(LEGACY_PROVIDER_ROW, MANAGED_ROW)
  }
  if (composition.includes(FILESYSTEM_ROW)) {
    return composition.replace(FILESYSTEM_ROW, MANAGED_ROW)
  }
  if (composition.includes(MANAGED_MARKER)) return composition
  throw new Error('managed preset requires the code skill-filesystem row')
}
