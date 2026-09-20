// A generic pulsing placeholder block, sized by the caller to match the
// real content's actual dimensions -- the point is that nothing shifts
// when the real data arrives and replaces it, unlike a centered spinner
// (LoadingState) whose box is a different shape/size than what follows it.
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-paper-dim ${className}`} />
}

// Matches Card's own shape (rounded-lg border p-4/p-5) so a grid of these
// sits exactly where the real cards will render, at the same size.
export function SkeletonCard({ className = '', lines = 2 }) {
  return (
    <div className={`rounded-lg border border-paper-dim bg-paper p-4 ${className}`}>
      <Skeleton className="mb-2 h-4 w-2/3" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} className="mt-2 h-3 w-1/3" />
      ))}
    </div>
  )
}

export function SkeletonList({ rows = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}
