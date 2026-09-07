import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

/** Confirms before proceeding with a known-crowded destination. */
export default function DeclineButton({ onDecline, requestedName = 'this destination' }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="flex flex-col items-center gap-1.5 pt-4">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Keep my original plan
        </Button>
        <p className="text-xs text-slate-400">Continue with {requestedName} without switching</p>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Continue with the crowded date?">
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p><strong>{requestedName}</strong> is showing high demand for these dates — expect more crowds and less room availability than usual.</p>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>Go back</Button>
          <Button variant="danger" fullWidth onClick={() => { setOpen(false); onDecline?.() }}>Continue anyway</Button>
        </div>
      </Modal>
    </>
  )
}
