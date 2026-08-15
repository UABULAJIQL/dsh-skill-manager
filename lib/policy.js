/** Normalize the persisted Skill Manager section without changing its shape. */
export function normalizeSkillManagerSettings(value) {
  const input = value && typeof value === 'object' ? value : {}
  return {
    includeDefaultRoots: input.includeDefaultRoots !== false,
    paths: uniqueStrings(input.paths),
    disabled: uniqueStrings(input.disabled),
  }
}

/** Remove empty entries and preserve user order while deduplicating. */
function uniqueStrings(value) {
  if (!Array.isArray(value)) return []
  const result = []
  const seen = new Set()
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const normalized = entry.trim()
    if (normalized.length === 0 || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

/** Rank managed candidates ahead of preset filesystem discovery in the same agent scope. */
export const MANAGED_SKILL_RANK_OFFSET = 1000

/**
 * Preserve one candidate for every discovered name so a disabled entry shadows
 * lower-scope providers instead of falling through to their same-name skill.
 */
export function projectSkillCandidates(candidates, disabled) {
  const disabledNames = new Set(disabled)
  return candidates.map(candidate => ({
    ...candidate,
    rank: candidate.rank - MANAGED_SKILL_RANK_OFFSET,
    ...(disabledNames.has(candidate.name) ? {
      invocation: { modelInvocable: false, userInvocable: false },
    } : {}),
  }))
}
