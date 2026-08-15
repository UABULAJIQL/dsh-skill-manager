import assert from 'node:assert/strict'
import { filterSkillCandidates, normalizeSkillManagerSettings } from '../lib/policy.js'

assert.deepEqual(normalizeSkillManagerSettings({
  includeDefaultRoots: false,
  paths: [' C:/skills ', 'C:/skills', '', 42],
  disabled: ['review', 'review', ' '],
}), {
  includeDefaultRoots: false,
  paths: ['C:/skills'],
  disabled: ['review'],
})

const candidates = [
  { name: 'review', path: 'C:/a/SKILL.md' },
  { name: 'build', path: 'C:/b/SKILL.md' },
]
assert.deepEqual(filterSkillCandidates(candidates, ['review']), [candidates[1]])
console.log('policy tests passed')
