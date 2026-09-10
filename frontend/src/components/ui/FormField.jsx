// Consistent label + input wrapper. Wraps whatever control you pass as a
// child (input/select/textarea) so every form field looks the same without
// each page reinventing the label markup.
export default function FormField({ label, optional = false, hint, error, children }) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink/80">{label}</span>
        {optional && <span className="text-xs text-ash">Optional</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ash">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-pressure">{error}</span>}
    </label>
  )
}

// Shared input classes so a bare <input>/<select>/<textarea> inside
// FormField still matches every other field in the app.
export const inputClass =
  'w-full rounded-lg border border-paper-dim bg-white px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-ash focus:border-ink/40 focus:ring-4 focus:ring-ink/10'
