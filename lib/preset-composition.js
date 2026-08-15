/** Pure composition transform for the user-owned managed preset. */

const PROVIDER_MARKER = "name: '@sqnb/dsh-skill-manager/preset-provider'"
const FILESYSTEM_ROW = "- id: skill-filesystem\n  name: '@deepseek-ai/dsh-skill-filesystem'\n\n"
const PROVIDER_ROW = "- id: sqnb-skill-manager-provider\n  name: '@sqnb/dsh-skill-manager/preset-provider'\n\n"

export function addManagedProvider(composition) {
  if (composition.includes(FILESYSTEM_ROW)) {
    return composition.replace(FILESYSTEM_ROW, composition.includes(PROVIDER_MARKER) ? '' : PROVIDER_ROW)
  }
  if (composition.includes(PROVIDER_MARKER)) return composition
  throw new Error('managed preset requires the code skill-filesystem row')
}
