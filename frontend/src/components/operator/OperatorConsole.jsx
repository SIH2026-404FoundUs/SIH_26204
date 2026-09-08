import { Wrench } from 'lucide-react'
import PageHeader from '../ui/PageHeader'
import EmptyState from '../ui/EmptyState'
import Card from '../ui/Card'

// Frontend sitemap doc, Page 10: BLOCKED. POST /api/availability/:id was
// specified in the original work docs but was never confirmed as a built
// route (re-verified live during this project's curl-testing pass -- it
// 404s). Per §55: do not fabricate its data or pretend it's functional --
// state plainly what's coming and why it isn't here yet.
export default function OperatorConsole() {
  return (
    <div>
      <PageHeader icon={Wrench} title="Operator console" description="Manage your listing's availability, discounts, and growth ranking." />
      <Card padding="p-0">
        <EmptyState
          icon={Wrench}
          title="Coming soon"
          description="This console needs a declared-availability endpoint (POST /api/availability/:id) that hasn't been built yet, plus a way to link your account to your business listing. Nothing here is faked in the meantime."
        />
      </Card>
    </div>
  )
}
