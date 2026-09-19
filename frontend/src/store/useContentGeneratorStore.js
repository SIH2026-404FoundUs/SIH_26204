import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

// Tourism Publicity Generator (operator-only Content Generator tab).
// Backend does the real work (fact extraction, Groq primary / Mistral
// fallback, Whisper large-v3 transcription) -- this store is just the
// request/response boundary plus enough state to support "Regenerate"
// (re-running the exact same request) without the component needing to
// remember its own last-submitted form.
export const useContentGeneratorStore = create((set, get) => ({
  isTranscribing: false,
  transcribeError: null,

  transcribeAudio: async (blob) => {
    set({ isTranscribing: true, transcribeError: null })
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      const res = await api.post('/v1/content/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data // { transcript, detectedLanguage }
    } catch (error) {
      set({ transcribeError: getErrorMessage(error, 'Could not transcribe your recording') })
      return null
    } finally {
      set({ isTranscribing: false })
    }
  },

  isGenerating: false,
  generateError: null,
  result: null, // { variants, provider, warnings }
  lastRequest: null,

  generateContent: async (payload) => {
    set({ isGenerating: true, generateError: null })
    try {
      const res = await api.post('/v1/content/generate', payload)
      set({ result: res.data, lastRequest: payload })
      return res.data
    } catch (error) {
      set({ generateError: getErrorMessage(error, 'Could not generate content right now') })
      return null
    } finally {
      set({ isGenerating: false })
    }
  },

  // Regenerate re-sends the exact same request -- a fresh call, not a
  // client-side reshuffle, since the whole point is a genuinely new set of
  // variants from the model.
  regenerate: async () => {
    const { lastRequest, generateContent } = get()
    if (!lastRequest) return null
    return generateContent(lastRequest)
  },

  reset: () => set({ result: null, generateError: null, lastRequest: null }),
}))
