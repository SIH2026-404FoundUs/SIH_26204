// Shared "N units ago" formatter -- used anywhere a relative timestamp
// shows up (the header's notification dropdown, Community Forum posts and
// comments). Coarsest matching unit only (e.g. "3d ago", never "3d 4h ago"),
// which is all a compact feed/list row needs.
export function timeAgo(dateString) {
  if (!dateString) return ''
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  const units = [['y', 31536000], ['mo', 2592000], ['d', 86400], ['h', 3600], ['m', 60]]
  for (const [label, secs] of units) {
    const value = Math.floor(seconds / secs)
    if (value >= 1) return `${value}${label} ago`
  }
  return 'just now'
}
