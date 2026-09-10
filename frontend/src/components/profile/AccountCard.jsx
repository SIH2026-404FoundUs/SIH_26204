import { useState } from 'react'
import { LogOut, Mail, Pencil, ShieldCheck, UserRound } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import FormField, { inputClass } from '../ui/FormField'

// Basic details, now actually editable -- PUT /api/auth/update-profile
// (backend/src/controllers/auth.controller.js's updateProfile), reusing the
// exact store action (useAuthStore.updateProfile) that already existed but
// had no backend route wired to it. Email is deliberately not editable
// here: it's the login identifier, and with email verification removed
// from this app there's no re-verification safety net for a self-service
// change to it.
export default function AccountCard({ authUser, onLogout }) {
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ fullName: authUser.fullName, phone: authUser.phone || '' })
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    setFeedback(null)
    if (!form.fullName.trim()) {
      setFeedback({ tone: 'error', message: 'Name cannot be empty' })
      return
    }
    setIsSaving(true)
    const ok = await updateProfile({ fullName: form.fullName.trim(), phone: form.phone.trim() })
    setIsSaving(false)
    setFeedback({ tone: ok ? 'success' : 'error', message: ok ? 'Saved.' : useAuthStore.getState().error })
    if (ok) setEditing(false)
  }

  if (editing) {
    return (
      <Card className="mb-4">
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Name">
            <input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} required className={inputClass} />
          </FormField>
          <FormField label="Phone" optional>
            <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={inputClass} />
          </FormField>
          <FormField label="Email">
            <input value={authUser.email} disabled className={`${inputClass} cursor-not-allowed opacity-60`} />
          </FormField>
          {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={isSaving}>Save</Button>
            <Button type="button" variant="ghost" onClick={() => { setEditing(false); setFeedback(null) }}>Cancel</Button>
          </div>
        </form>
      </Card>
    )
  }

  return (
    <Card className="mb-4">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-paper">
          <UserRound size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-lg text-ink">{authUser.fullName}</p>
          <p className="flex items-center gap-1.5 text-sm text-ash"><Mail size={13} aria-hidden="true" /> {authUser.email}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge tone="info" icon={ShieldCheck}>{authUser.role}</Badge>
          {authUser.phone && <span className="text-xs text-ash">{authUser.phone}</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={onLogout}>Log out</Button>
        </div>
      </div>
    </Card>
  )
}
