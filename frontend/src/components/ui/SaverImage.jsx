import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { useDataSaverStore } from '../../store/useDataSaverStore'

// Text always loads first, images are opt-in per-photo when Data Saver is
// on -- a tap reveals that one photo without switching the setting off for
// the rest of the session. Same <img loading="lazy"> either way once
// shown, so a revealed photo still only fetches when it scrolls into view.
export default function SaverImage({ src, alt = '', className = '', ...props }) {
  const enabled = useDataSaverStore((s) => s.enabled)
  const [revealed, setRevealed] = useState(false)

  if (enabled && !revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className={`flex flex-col items-center justify-center gap-1 bg-paper-dim text-ink/40 transition hover:text-ink/60 ${className}`}
      >
        <ImageOff size={18} aria-hidden="true" />
        <span className="text-[11px] font-medium">Tap to load photo</span>
      </button>
    )
  }

  return <img src={src} alt={alt} loading="lazy" className={className} {...props} />
}
