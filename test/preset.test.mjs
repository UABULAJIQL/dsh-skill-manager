import assert from 'node:assert/strict'
import { addManagedProvider } from '../lib/preset-composition.js'

const composition = `- id: skill-filesystem
  name: '@deepseek-ai/dsh-skill-filesystem'

- id: tool-skill
  name: '@deepseek-ai/dsh-tool-skill'
`
const managed = addManagedProvider(composition)
const migrated = composition.replace(
  '- id: tool-skill',
  "- id: sqnb-skill-manager-provider\n  name: '@sqnb/dsh-skill-manager/preset-provider'\n\n- id: tool-skill",
)

assert.match(managed, /id: sqnb-skill-manager-provider/)
assert.match(managed, /name: '@sqnb\/dsh-skill-manager\/preset-provider'/)
assert.ok(managed.indexOf('sqnb-skill-manager-provider') < managed.indexOf('tool-skill'))
assert.doesNotMatch(managed, /id: skill-filesystem/)
assert.equal(addManagedProvider(managed), managed)
assert.equal(addManagedProvider(migrated), managed)
assert.throws(() => addManagedProvider('- id: tool-filesystem\n'), /skill-filesystem/)

console.log('preset tests passed')
