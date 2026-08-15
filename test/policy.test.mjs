import assert from 'node:assert/strict'
import { MANAGED_SKILL_RANK_OFFSET, normalizeSkillManagerSettings, projectSkillCandidates } from '../lib/policy.js'

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
  { name: 'review', path: 'C:/a/SKILL.md', rank: 40, invocation: { modelInvocable: true, userInvocable: true } },
  { name: 'build', path: 'C:/b/SKILL.md', rank: 60, invocation: { modelInvocable: true, userInvocable: false } },
]
const projected = projectSkillCandidates(candidates, ['review'])
assert.equal(projected.length, 2)
assert.equal(projected[0].rank, 40 - MANAGED_SKILL_RANK_OFFSET)
assert.deepEqual(projected[0].invocation, { modelInvocable: false, userInvocable: false })
assert.equal(projected[1].rank, 60 - MANAGED_SKILL_RANK_OFFSET)
assert.equal(projected[1].invocation, candidates[1].invocation)
console.log('policy tests passed')
