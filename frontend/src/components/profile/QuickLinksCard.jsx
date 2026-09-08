import { Link } from 'react-router-dom'
import {
  Route as RouteIcon, Activity, Store, MapPinned, Tag, ShieldCheck,
  TriangleAlert, Phone, Wrench, Landmark, ChevronRight,
} from 'lucide-react'
import Card from '../ui/Card'

// One row per role rather than one giant shared list -- an operator doesn't
// want to scroll past traveller-only shortcuts (Community, Offers) to find
// their console, and vice versa. Keeping this as a plain data table (not
// logic scattered through JSX) makes it cheap to add a role later.
const LINKS_BY_ROLE = {
  traveller: [
    { to: '/trips', label: 'My trips', icon: RouteIcon },
    { to: '/explore', label: 'Explore pressure map', icon: Activity },
    { to: '/businesses', label: 'Local businesses', icon: Store },
    { to: '/community', label: 'Suggest a place', icon: MapPinned },
    { to: '/offers', label: 'Offers & waitlist', icon: Tag },
    { to: '/visits', label: 'Verify a visit', icon: ShieldCheck },
    { to: '/alerts', label: 'Travel alerts', icon: TriangleAlert },
    { to: '/safety', label: 'Safety', icon: Phone },
  ],
  operator: [
    { to: '/operator', label: 'Operator console', icon: Wrench },
    { to: '/businesses', label: 'Local businesses', icon: Store },
    { to: '/explore', label: 'Pressure map', icon: Activity },
    { to: '/visits', label: 'Verify a visit', icon: ShieldCheck },
  ],
  authority: [
    { to: '/authority', label: 'Authority dashboard', icon: Landmark },
    { to: '/explore', label: 'Pressure map', icon: Activity },
    { to: '/community', label: 'Community review', icon: MapPinned },
    { to: '/alerts', label: 'Travel alerts', icon: TriangleAlert },
  ],
}

export default function QuickLinksCard({ role }) {
  const links = LINKS_BY_ROLE[role] || LINKS_BY_ROLE.traveller

  return (
    <Card className="mb-4" padding="p-0">
      <h2 className="px-5 pt-4 pb-1 text-sm font-semibold text-ink">Quick links</h2>
      <nav className="divide-y divide-paper-dim">
        {links.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center justify-between gap-2 px-5 py-3 text-sm text-ink transition hover:bg-paper-dim/40">
            <span className="flex items-center gap-2.5">
              <Icon size={16} className="text-ash" aria-hidden="true" />
              {label}
            </span>
            <ChevronRight size={15} className="text-ash" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </Card>
  )
}
