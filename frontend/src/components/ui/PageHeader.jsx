// Every page starts the same way: an icon, a Fraunces headline, one line
// saying what the page is for. No eyebrow labels, no marketing subheads
// (UI/UX doc §1.2 -- ALL-CAPS tracked-out eyebrows are explicitly rejected).
export default function PageHeader({ icon: Icon, title, description }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 text-ink">
        {Icon && <Icon size={22} className="text-pressure" aria-hidden="true" />}
        <h1 className="font-display text-2xl tracking-tight">{title}</h1>
      </div>
      {description && <p className="mt-2 text-sm text-ink/60">{description}</p>}
    </div>
  )
}
