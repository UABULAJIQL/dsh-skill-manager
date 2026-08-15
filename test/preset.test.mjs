import assert from 'node:assert/strict'
import { addManagedProvider } from '../lib/preset-composition.js'

const composition = `- id: skill-filesystem
  name: '@deepseek-ai/dsh-skill-filesystem'

- id: tool-skill
  name: '@deepseek-ai/dsh-tool-skill'
`
const legacy = `- id: sqnb-skill-manager-provider
  name: '@sqnb/dsh-skill-manager/preset-provider'

- id: tool-skill
  name: '@deepseek-ai/dsh-tool-skill'
`
const managed = addManagedProvider(composition)

assert.match(managed, /id: skill-filesystem/)
assert.match(managed, /name: '@sqnb\/dsh-skill-manager\/preset'/)
assert.doesNotMatch(managed, /@deepseek-ai\/dsh-skill-filesystem/)
assert.doesNotMatch(managed, /sqnb-skill-manager-provider/)
assert.ok(managed.indexOf('skill-filesystem') < managed.indexOf('tool-skill'))
assert.equal(addManagedProvider(managed), managed)
assert.equal(addManagedProvider(legacy), managed)
assert.throws(() => addManagedProvider('- id: tool-filesystem\n'), /skill-filesystem/)

console.log('preset tests passed')
