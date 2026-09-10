import { DESTINATION_GROUPS } from '../../lib/destinations'
import { inputClass } from './FormField'

// Replaces every "type the destId slug and hope you spelled it right" text
// input with a real picker grouped by state -- the same list SwapPage always
// used, now shared everywhere a destination needs picking.
export default function DestinationSelect({ value, onChange, className = '', ...props }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} ${className}`}
      {...props}
    >
      <option value="" disabled>Choose a destination</option>
      {DESTINATION_GROUPS.map((group) => (
        <optgroup key={group.state} label={group.state}>
          {group.destinations.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
