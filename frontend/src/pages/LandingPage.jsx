import { Link } from 'react-router-dom'
import {
  Flame, ArrowLeftRight, ShieldCheck, MapPinned, Landmark, Wrench,
  TriangleAlert, Tag, Compass, CheckCircle2,
} from 'lucide-react'

// The public landing page at "/" -- separate from the sign-in form
// (AuthScreen still owns /signin and /signup on its own). Describes what
// Sahyatri actually is before asking for an account, per the "comprehensive
// home page" requirement -- every claim made here names a real, working
// feature elsewhere in this app (pressure heatmap, redistribution,
// verified visits/businesses, Suggest a Place, alerts/safety, offers &
// waitlist, authority dashboard), nothing invented for marketing copy.
const FEATURES = [
  {
    icon: Flame,
    title: 'See crowding before you book',
    body: 'A live pressure heatmap across every destination, so you know how busy a place actually is before you commit -- not after you arrive.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Get redirected to a better option',
    body: 'When your first choice is over capacity, we offer a real alternative -- a calmer destination or a different date -- and show you the tradeoff honestly.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified businesses, verified visits',
    body: 'Drivers, guides, and guesthouses are onboarded directly through the platform. Travellers confirm a real visit with a code the business shows in person.',
  },
  {
    icon: MapPinned,
    title: 'Suggest a place worth visiting',
    body: 'Know somewhere that isn’t on the map yet? Suggest it with a location and a photo. A tourism authority reviews it before it appears for anyone else.',
  },
  {
    icon: TriangleAlert,
    title: 'Notifications that matter to your trip',
    body: 'Verified weather, road, and policy alerts -- filtered to the destination and dates you actually have planned, not a firehose of every advisory everywhere.',
  },
  {
    icon: Tag,
    title: 'Offers & waitlist',
    body: 'Claim a flash discount from a local business right now, or join the waitlist to hear the moment one opens up.',
  },
]

const AUDIENCES = [
  {
    icon: Compass,
    role: 'Travellers',
    body: 'Plan a trip against real crowding data, discover verified local businesses, and get notified about what actually affects your itinerary.',
  },
  {
    icon: Wrench,
    role: 'Local businesses',
    body: 'Drivers, guides, guesthouses, and homestays get listed, get discovered by destination, and can run flash offers directly through the platform.',
  },
  {
    icon: Landmark,
    role: 'Tourism authorities',
    body: 'A dashboard for destination pressure, capacity gaps, redistribution impact, and acceptance rate -- plus a moderation queue for community-suggested places.',
  },
]

export default function LandingPage() {
  return (
    <div>
      {/* Hero -- the one screen in the product where centred alignment is
          correct (UI/UX doc §3.3): there's no trip data yet to give a
          layout hierarchy to. */}
      <div className="isobar-canvas px-4 py-24 text-center sm:px-6">
        <p className="font-display text-4xl text-paper sm:text-5xl">Sahyatri</p>
        <p className="mx-auto mt-4 max-w-xl text-lg text-paper/80">Tourism, redistributed.</p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-paper/60">
          We check how crowded a destination will be before you book it -- and if it's over capacity, we offer you a real alternative instead of just saying no.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/signup"
            className="rounded-lg bg-paper px-6 py-3 text-sm font-semibold text-ink transition hover:bg-white"
          >
            Get started
          </Link>
          <Link
            to="/signin"
            className="rounded-lg border border-paper/30 px-6 py-3 text-sm font-semibold text-paper transition hover:bg-paper/10"
          >
            Sign in
          </Link>
        </div>
      </div>

      {/* What Sahyatri does */}
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl text-ink">What Sahyatri does</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink/60">
            Everything below is a real, working part of the platform -- not a promise for later.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-paper-dim bg-white p-5">
              <f.icon size={22} className="text-pressure" aria-hidden="true" />
              <h3 className="mt-3 font-display text-lg text-ink">{f.title}</h3>
              <p className="mt-1.5 text-sm text-ink/60">{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Who it's built for */}
      <div className="border-t border-paper-dim bg-paper-dim/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl text-ink">Built for everyone in the loop</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div key={a.role} className="rounded-lg border border-paper-dim bg-white p-6 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper">
                  <a.icon size={20} aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-display text-lg text-ink">{a.role}</h3>
                <p className="mt-1.5 text-sm text-ink/60">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it actually works, in order */}
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl text-ink">How it works</h2>
        </div>
        <ol className="space-y-6">
          {[
            'Tell us where you want to go and when.',
            'We check real pressure data for that destination on those dates.',
            'If it’s over capacity, we offer a genuine alternative -- a calmer place or a different date -- and you decide, honestly informed either way.',
            'Verified local businesses, safety alerts, and community-suggested places are there the whole way through your trip.',
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-sm font-semibold text-paper">
                {i + 1}
              </span>
              <p className="mt-1 text-sm text-ink/80">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Final CTA */}
      <div className="isobar-canvas px-4 py-16 text-center sm:px-6">
        <CheckCircle2 size={28} className="mx-auto text-relief" aria-hidden="true" />
        <h2 className="mt-3 font-display text-2xl text-paper">Plan your next trip with real numbers, not guesswork.</h2>
        <Link
          to="/signup"
          className="mt-6 inline-block rounded-lg bg-paper px-6 py-3 text-sm font-semibold text-ink transition hover:bg-white"
        >
          Create your free account
        </Link>
      </div>
    </div>
  )
}
