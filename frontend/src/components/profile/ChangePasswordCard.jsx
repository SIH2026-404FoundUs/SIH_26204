import { useState } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { isPasswordValid } from '../../lib/passwordPolicy'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import FormField from '../ui/FormField'
import PasswordField from '../auth/PasswordField'
import PasswordStrengthChecklist from '../auth/PasswordStrengthChecklist'

// auth spec §16: requires the current password, same strong policy as
// signup/reset. On success the backend re-issues this session's own cookie
// under the new tokenVersion (so this tab keeps working) while silently
// invalidating any other device's older session.
export default function ChangePasswordCard() {
  const changePassword = useAuthStore((state) => state.changePassword)
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
  const [touched, setTouched] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setFeedback(null)

    if (!isPasswordValid(form.newPassword)) {
      setFeedback({ tone: 'error', message: 'New password does not meet the requirements below' })
      return
    }
    if (form.newPassword !== form.confirmNewPassword) {
      setFeedback({ tone: 'error', message: 'New passwords do not match' })
      return
    }

    setIsSubmitting(true)
    const result = await changePassword(form)
    setIsSubmitting(false)
    setFeedback({ tone: result.ok ? 'success' : 'error', message: result.message })
    if (result.ok) {
      setForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
      setTouched(false)
    }
  }

  return (
    <Card className="mb-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">Change password</h2>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField label="Current password">
          <PasswordField value={form.currentPassword} onChange={set('currentPassword')} required />
        </FormField>
        <FormField label="New password">
          <PasswordField value={form.newPassword} onChange={set('newPassword')} onFocus={() => setTouched(true)} required />
        </FormField>
        <PasswordStrengthChecklist password={form.newPassword} touched={touched} />
        <FormField label="Confirm new password" error={form.confirmNewPassword && form.newPassword !== form.confirmNewPassword ? 'Passwords do not match' : undefined}>
          <PasswordField value={form.confirmNewPassword} onChange={set('confirmNewPassword')} required />
        </FormField>

        {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}

        <Button type="submit" variant="outline" loading={isSubmitting}>Change password</Button>
      </form>
    </Card>
  )
}
