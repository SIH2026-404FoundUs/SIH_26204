// Every page starts the same way: an icon, a title, one line saying what the
// page is for. No eyebrow labels, no marketing subheads.
export default function PageHeader({ icon: Icon, title, description }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 text-slate-900">
        {Icon && <Icon size={22} className="text-indigo-600" aria-hidden="true" />}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
    </div>
  )
}
