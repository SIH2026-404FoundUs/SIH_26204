import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import EmptyState from '../ui/EmptyState'
import { Lock } from 'lucide-react'

// Consistent page container so every route doesn't redeclare the same
// background/padding classes.
export function Page({ children, wide = false }) {
  return (
    <main className="flex-1 bg-paper px-4 py-10 sm:px-6">
      <div className={wide ? 'mx-auto max-w-6xl' : 'mx-auto max-w-3xl'}>{children}</div>
    </main>
  )
}

export function RequireAuth({ children, wide = false }) {
  const authUser = useAuthStore((state) => state.authUser)
  return authUser ? <Page wide={wide}>{children}</Page> : <Navigate to="/signin" replace />
}

// Same auth gate, but for the couple of pages (SwapPage, TripConfirmation)
// that already render their own <main> wrapper -- avoids nesting <main>
// inside <main>.
export function RequireAuthBare({ children }) {
  const authUser = useAuthStore((state) => state.authUser)
  return authUser ? children : <Navigate to="/signin" replace />
}

// Frontend role-hiding is UX only, never security (§56) -- the backend
// enforces the real authorization on every one of these routes' calls. This
// just keeps a traveller from landing on a page built for a role they don't
// have.
export function RequireRole({ role, children, wide = false }) {
  const authUser = useAuthStore((state) => state.authUser)
  if (!authUser) return <Navigate to="/signin" replace />
  if (authUser.role !== role) {
    return (
      <Page wide={wide}>
        <EmptyState
          icon={Lock}
          title="Not available for your account"
          description={`This page is for ${role} accounts. You're signed in as ${/^[aeiou]/i.test(authUser.role) ? 'an' : 'a'} ${authUser.role}.`}
        />
      </Page>
    )
  }
  return <Page wide={wide}>{children}</Page>
}
