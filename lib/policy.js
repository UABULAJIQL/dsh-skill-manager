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

/** Filter provider candidates whose skill name is disabled in the settings page. */
export function filterSkillCandidates(candidates, disabled) {
  const disabledNames = new Set(disabled)
  return candidates.filter(candidate => !disabledNames.has(candidate.name))
}
