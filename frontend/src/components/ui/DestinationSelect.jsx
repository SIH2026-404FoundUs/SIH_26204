import { useDestinationGroups } from '../../lib/destinations'
import { inputClass } from './FormField'

// Replaces every "type the destId slug and hope you spelled it right" text
// input with a real picker grouped by state -- the same list SwapPage always
// used, now shared everywhere a destination needs picking.
//
// allowAll: for a FILTER on a list (e.g. "gigs near you"), not a required
// field -- makes the blank option a real, selectable "all destinations"
// choice instead of a disabled placeholder. Without this, a filter that
// ever gets pre-set to a specific destId has no way back to "show
// everything": a disabled placeholder can never be re-selected in a native
// <select>, which silently traps the list on whatever destId it started
// with (see WorkerConsole.jsx's gig browse tab, the bug this was added for).
export default function DestinationSelect({ value, onChange, className = '', allowAll = false, allLabel = 'All destinations', ...props }) {
  const groups = useDestinationGroups()
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} ${className}`}
      {...props}
    >
      <option value="" disabled={!allowAll}>{allowAll ? allLabel : 'Choose a destination'}</option>
      {groups.map((group) => (
        <optgroup key={group.state} label={group.state}>
          {group.destinations.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
