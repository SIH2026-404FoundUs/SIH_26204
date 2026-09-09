export async function downloadTravelBrief(request, trip) {
  const response = await fetch(`${import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000'}/internal/travel-brief/pdf`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request: request || {}, trip }),
  })
  if (!response.ok) throw new Error('Travel brief is temporarily unavailable')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'sahyatri-travel-brief.pdf'
  anchor.click()
  URL.revokeObjectURL(url)
}
