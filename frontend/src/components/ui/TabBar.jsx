/** Segmented tab strip. `tabs` items are { key | type, label, icon? }. */
export default function TabBar({ tabs, active, onChange, className = 'mb-6 flex flex-wrap', activeClass = 'bg-ink text-paper' }) {
  return (
    <div className={`${className} gap-1.5 rounded-lg border border-paper-dim bg-white p-1`}>
      {tabs.map((tab) => {
        const id = tab.key ?? tab.type
        const Icon = tab.icon
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
              active === id ? activeClass : 'text-ink/70 hover:bg-ink/5'
            }`}
          >
            {Icon && <Icon size={15} aria-hidden="true" />}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
