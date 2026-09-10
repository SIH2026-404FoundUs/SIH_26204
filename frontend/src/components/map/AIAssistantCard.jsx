import { useEffect, useState } from 'react'
import { Lightbulb, Loader2, MessageCircle, Sparkles, Wind } from 'lucide-react'
import AskAIChat from './AskAIChat'

export default function AIAssistantCard({ request, trip, onDownloadBrief }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    if (!trip) return undefined
    let active = true
    fetch(`${import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000'}/internal/ai/travel-brief`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: request || {}, trip }),
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active && data) setBrief(data) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request, trip])

  if (!trip) return null

  return (
    <aside className="absolute right-4 top-24 z-20 w-[min(350px,calc(100%-2rem))] animate-in slide-in-from-right-3 fade-in rounded-[20px] border border-white/50 bg-white/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,.08)] backdrop-blur-2xl duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6C63FF] text-white shadow-sm"><Sparkles size={17} /></div>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6C63FF]">AI assistant</p><h2 className="text-sm font-extrabold text-slate-950">Your trip is ready</h2></div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Live insight</span>
      </div>
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500"><Loader2 size={14} className="animate-spin text-[#6C63FF]" /> Generating AI insights...</div>
      ) : (
        <>
          <p className="mt-4 text-sm leading-5 text-slate-700">{brief?.explanation || trip.summary || 'Your verified trip data is ready to explore.'}</p>
          {brief?.weatherAdvice?.[0] && <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-2.5 text-xs leading-5 text-slate-600"><Wind size={14} className="mt-0.5 shrink-0 text-[#6C63FF]" />{brief.weatherAdvice[0]}</p>}
          {brief?.hiddenGems?.[0] && <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-2.5 text-xs leading-5 text-amber-900"><Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-500" />Hidden gem: {brief.hiddenGems[0]}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onDownloadBrief} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#6C63FF] px-3 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#5b52e6]"><Sparkles size={13} /> Travel brief</button>
            <button type="button" onClick={() => setChatOpen((open) => !open)} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-bold text-slate-700 transition hover:-translate-y-0.5"><MessageCircle size={13} /> {chatOpen ? 'Close chat' : 'Ask AI'}</button>
          </div>
          {chatOpen && <AskAIChat request={request} trip={trip} onClose={() => setChatOpen(false)} />}
        </>
      )}
    </aside>
  )
}
