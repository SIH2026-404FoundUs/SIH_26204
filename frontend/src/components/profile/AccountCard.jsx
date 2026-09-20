import { useRef, useState } from 'react'
import { Camera, LogOut, Mail, Pencil, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import FormField, { inputClass } from '../ui/FormField'

// The one avatar used in both the read view and the editing view below --
// a real photo when one's set (POST /auth/profile-photo, same Cloudinary
// mechanism as community-submission photos, different folder), the generic
// icon otherwise. The camera button always shows: it both sets a photo for
// the first time and replaces an existing one, so there's one control, not
// a separate "add" vs "change" affordance.
function AvatarUpload({ authUser }) {
  const uploadProfilePhoto = useAuthStore((state) => state.uploadProfilePhoto)
  const removeProfilePhoto = useAuthStore((state) => state.removeProfilePhoto)
  const isUploadingPhoto = useAuthStore((state) => state.isUploadingPhoto)
  const fileInputRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (file) uploadProfilePhoto(file)
  }

  return (
    <div className="relative h-12 w-12 shrink-0">
      {authUser.profilePhoto ? (
        <img src={authUser.profilePhoto} alt="" className="h-12 w-12 rounded-full object-cover" />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-paper">
          <UserRound size={22} aria-hidden="true" />
        </span>
      )}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploadingPhoto}
        aria-label={authUser.profilePhoto ? 'Change profile photo' : 'Add profile photo'}
        className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper bg-ink text-paper transition hover:bg-ink-soft disabled:opacity-60"
      >
        <Camera size={12} aria-hidden="true" />
      </button>
      {authUser.profilePhoto && (
        <button
          type="button"
          onClick={() => removeProfilePhoto()}
          aria-label="Remove profile photo"
          className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-paper bg-pressure text-paper transition hover:brightness-110"
        >
          <Trash2 size={10} aria-hidden="true" />
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
    </div>
  )
}

// Basic details, now actually editable -- PUT /api/auth/update-profile
// (backend/src/controllers/auth.controller.js's updateProfile), reusing the
// exact store action (useAuthStore.updateProfile) that already existed but
// had no backend route wired to it. Email is deliberately not editable
// here: it's the login identifier, and with email verification removed
// from this app there's no re-verification safety net for a self-service
// change to it.
export default function AccountCard({ authUser, onLogout }) {
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const photoError = useAuthStore((state) => state.error)
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
          <AvatarUpload authUser={authUser} />
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
        <AvatarUpload authUser={authUser} />
        <div>
          <p className="font-display text-lg text-ink">{authUser.fullName}</p>
          <p className="flex items-center gap-1.5 text-sm text-ash"><Mail size={13} aria-hidden="true" /> {authUser.email}</p>
        </div>
      </div>
      {photoError && <div className="mt-3"><Alert tone="error">{photoError}</Alert></div>}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge tone="info" icon={ShieldCheck}>{authUser.role}</Badge>
          {authUser.phone && <span className="text-xs text-ash">{authUser.phone}</span>}
          {authUser.createdAt && (
            <span className="text-xs text-ash">Member since {new Date(authUser.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={onLogout}>Log out</Button>
        </div>
      </div>
    </Card>
  )
}
