// Shared list-endpoint pagination: a `?limit=&skip=` pair, clamped so no
// endpoint can accidentally return "everything" just because a caller left
// the params off. One helper instead of every controller re-deriving the
// same clamp logic slightly differently.
export function parsePagination(query = {}, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const rawLimit = Number(query.limit);
  const rawSkip = Number(query.skip);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), maxLimit) : defaultLimit;
  const skip = Number.isFinite(rawSkip) && rawSkip > 0 ? Math.floor(rawSkip) : 0;
  return { limit, skip };
}
