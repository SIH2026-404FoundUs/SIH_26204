import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, X } from 'lucide-react'

const AI_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000'
const MAX_MESSAGE_CHARS = 500

function errorMessage(response, fallback) {
  return response?.detail || response?.message || fallback
}

export default function AskAIChat({ request, trip, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Ask me anything about this trip, its timing, stays, weather, pressure, or budget.' },
  ])
  const [question, setQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  if (!trip) return null

  const send = async (event) => {
    event.preventDefault()
    const text = question.trim()
    if (!text || isSending) return

    const userMessage = { role: 'user', content: text.slice(0, MAX_MESSAGE_CHARS) }
    const history = messages.filter((item) => item.role === 'user' || item.role === 'assistant').slice(-8)
    setMessages((current) => [...current, userMessage])
    setQuestion('')
    setError('')
    setIsSending(true)

    try {
      const response = await fetch(`${AI_URL}/internal/ai/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: request || {}, trip, question: userMessage.content, history }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(errorMessage(data, 'Ask AI is temporarily unavailable.'))
      if (!data.answer) throw new Error('Ask AI returned an empty answer.')
      setMessages((current) => [...current, { role: 'assistant', content: data.answer }])
    } catch (sendError) {
      setError(sendError.message || 'Ask AI is temporarily unavailable.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <div>
          <p className="text-xs font-extrabold text-slate-900">Ask AI about this trip</p>
          <p className="text-[10px] text-slate-500">Answers use the loaded itinerary and trip data.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close Ask AI">
          <X size={14} />
        </button>
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <p className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-5 ${message.role === 'user' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {message.content}
            </p>
          </div>
        ))}
        {isSending && <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><Loader2 size={13} className="animate-spin text-[#6C63FF]" /> Thinking about your trip...</div>}
        <div ref={endRef} />
      </div>
      {error && <p className="border-t border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">{error}</p>}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-100 p-2">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value.slice(0, MAX_MESSAGE_CHARS))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          rows={2}
          maxLength={MAX_MESSAGE_CHARS}
          placeholder="e.g. Can I finish this in one day?"
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/15"
          aria-label="Ask a question about this trip"
        />
        <button type="submit" disabled={!question.trim() || isSending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#6C63FF] text-white transition hover:bg-[#5b52e6] disabled:cursor-not-allowed disabled:bg-slate-300" aria-label="Send question">
          {isSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </form>
    </div>
  )
}
