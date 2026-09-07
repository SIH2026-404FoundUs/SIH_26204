// Consistent label + input wrapper. Wraps whatever control you pass as a
// child (input/select/textarea) so every form field looks the same without
// each page reinventing the label markup.
export default function FormField({ label, optional = false, hint, error, children }) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {optional && <span className="text-xs text-slate-400">Optional</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  )
}

// Shared input classes so a bare <input>/<select>/<textarea> inside
// FormField still matches every other field in the app.
export const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'
