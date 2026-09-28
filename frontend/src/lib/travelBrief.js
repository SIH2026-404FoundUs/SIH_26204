import { aiApi, getErrorMessage } from './api'

export async function downloadTravelBrief(request, trip) {
  let blob
  try {
    ;({ data: blob } = await aiApi.post('/internal/travel-brief/pdf', { request: request || {}, trip }, { responseType: 'blob' }))
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Travel brief is temporarily unavailable'), { cause: error })
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'sahyatri-travel-brief.pdf'
  anchor.click()
  URL.revokeObjectURL(url)
}
