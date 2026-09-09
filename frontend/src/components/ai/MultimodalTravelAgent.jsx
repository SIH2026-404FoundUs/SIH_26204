import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bot, CalendarDays, Image, Loader2, Map, Mic, RotateCcw, Send, Sparkles, Video, X } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { useAuthStore } from '../../store/useAuthStore'

const AI_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000'
const MAX_MESSAGE_CHARS = 500
const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'te', label: 'తెలుగు' }, { value: 'hi', label: 'हिंदी' }]
const STARTERS = ['Plan a 3-day Hyderabad trip under ₹10,000', 'Show places near Charminar', 'Find hotels near Nagarjuna Sagar']

function errorMessage(data, fallback) { return data?.detail || data?.message || fallback }

function placePhoto(place) {
  if (place?.photoUrl) return place.photoUrl
  if (!place?.photoName) return null
  return `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/places/photo?name=${encodeURIComponent(place.photoName)}`
}

function ResultCard({ item, kind }) {
  const photo = placePhoto(item)
  return <div className="overflow-hidden rounded-xl border border-paper-dim bg-white">{photo ? <img src={photo} alt="" className="h-28 w-full object-cover" /> : <div className="flex h-20 items-center justify-center bg-paper text-ink/25">{kind === 'hotel' ? <Map size={22} /> : <Sparkles size={22} />}</div>}<div className="p-3"><p className="truncate text-sm font-semibold text-ink">{item?.name || item?.displayName || 'Unnamed place'}</p><div className="mt-1 flex items-center justify-between gap-2 text-xs text-ash"><span>{kind === 'hotel' ? 'Hotel' : 'Attraction'}</span>{item?.rating != null && <span>★ {item.rating}</span>}</div>{item?.placeId && <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-relief hover:underline" href={`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(item.placeId)}`} target="_blank" rel="noreferrer">Open in Maps <ArrowRight size={12} /></a>}</div></div>
}

function ResultsStrip({ results }) {
  const hotels = results?.hotels || []
  const places = results?.places || []
  if (!hotels.length && !places.length) return null
  return <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{hotels.slice(0, 3).map((item, index) => <ResultCard key={`hotel-${item.placeId || index}`} item={item} kind="hotel" />)}{places.slice(0, 3).map((item, index) => <ResultCard key={`place-${item.placeId || index}`} item={item} kind="place" />)}</div>
}

export default function MultimodalTravelAgent() {
  const authUser = useAuthStore((state) => state.authUser)
  const [language, setLanguage] = useState('en')
  const [mode, setMode] = useState('chat')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState('')
  const [lastResults, setLastResults] = useState(null)
  const endRef = useRef(null)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    recognitionRef.current?.stop()
  }, [])

  const clearChat = () => {
    if (isSending || isRecording || isTranscribing) return
    setMessages([])
    setLastResults(null)
    setError('')
    setMessage('')
  }

  const send = async (event, starter = null, overrideText = null) => {
    event?.preventDefault()
    const text = (overrideText || starter || message).trim()
    if (!text || isSending) return
    const userMessage = { role: 'user', content: text.slice(0, MAX_MESSAGE_CHARS) }
    const history = messages.slice(-8).map(({ role, content }) => ({ role, content }))
    setMessages((current) => [...current, userMessage])
    setMessage('')
    setError('')
    setIsSending(true)
    try {
      const response = await fetch(`${AI_URL}/api/multimodal/chat`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMessage.content, language, role: authUser?.role || 'traveller', history, context: {} }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(errorMessage(data, 'The tourism agent is temporarily unavailable.'))
      setMessages((current) => [...current, { role: 'assistant', content: data.answer || 'The agent returned an empty answer.' }])
      setLastResults(data.results || null)
    } catch (sendError) {
      setError(sendError.message || 'The tourism agent is temporarily unavailable.')
    } finally {
      setIsSending(false)
    }
  }

  const toggleRecording = async () => {
    if (isRecording) {
      recognitionRef.current?.stop()
      recorderRef.current?.stop()
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.lang = language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-IN'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.onresult = async (event) => {
        const transcript = Array.from(event.results).map((result) => result[0]?.transcript || '').join(' ').trim()
        setIsRecording(false)
        if (!transcript) {
          setError('No speech was detected. Please try again.')
          return
        }
        await send(null, null, transcript)
      }
      recognition.onerror = (event) => {
        setIsRecording(false)
        setError(event.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Could not understand that recording.')
      }
      recognition.onend = () => setIsRecording(false)
      recognitionRef.current = recognition
      setError('')
      recognition.start()
      setIsRecording(true)
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Voice recording is not supported by this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      const chunks = []
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setIsRecording(false)
        setIsTranscribing(true)
        setError('')
        try {
          const formData = new FormData()
          formData.append('audio', new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), 'voice.webm')
          const response = await fetch(`${AI_URL}/api/multimodal/transcribe`, { method: 'POST', credentials: 'include', body: formData })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(errorMessage(data, 'Voice transcription is temporarily unavailable.'))
          if (!data.transcript) throw new Error('No speech was detected. Please try again.')
          await send(null, null, data.transcript)
        } catch (voiceError) {
          setError(voiceError.message || 'Voice transcription is temporarily unavailable.')
        } finally {
          setIsTranscribing(false)
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (voiceError) {
      setError(voiceError.name === 'NotAllowedError' ? 'Microphone permission was denied.' : 'Could not start voice recording.')
    }
  }

  return <div className="mx-auto max-w-6xl">
    <section className="relative overflow-hidden rounded-2xl bg-ink px-6 py-8 text-paper shadow-[0_20px_60px_rgba(16,25,43,0.14)] sm:px-10 sm:py-10"><div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full border-[30px] border-pressure/15" /><div className="relative max-w-3xl"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-paper/55"><Bot size={16} className="text-pressure" /> Sahyatri tourism agent</div><h1 className="font-display text-4xl tracking-tight sm:text-5xl">Plan naturally.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-paper/70 sm:text-base">Chat with the grounded tourism agent in English, Telugu or Hindi. Ask for a trip, a hotel or places worth seeing.</p></div></section>
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="overflow-hidden bg-white p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-dim px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-relief">Conversation</p><p className="mt-1 text-sm text-ash">Grounded in real places and pressure data</p></div><div className="flex items-center gap-2"><button type="button" onClick={clearChat} disabled={isSending || isRecording || isTranscribing} className="inline-flex items-center gap-1.5 rounded-lg border border-paper-dim bg-paper px-2.5 py-2 text-xs font-semibold text-ink/65 hover:bg-paper-dim disabled:opacity-50"><RotateCcw size={13} /> New chat</button><select value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-lg border border-paper-dim bg-paper px-2.5 py-2 text-xs font-semibold text-ink outline-none" aria-label="Response language">{LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><div className="flex rounded-lg border border-paper-dim p-1"><button type="button" onClick={() => setMode('chat')} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${mode === 'chat' ? 'bg-ink text-paper' : 'text-ash'}`}><Send size={12} className="mr-1 inline" />Chat</button><button type="button" onClick={() => setMode('voice')} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${mode === 'voice' ? 'bg-ink text-paper' : 'text-ash'}`}><Mic size={12} className="mr-1 inline" />Voice</button></div></div></div>
        {mode === 'voice' && <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-5 py-3 text-xs font-medium text-amber-900"><span>{isRecording ? 'Listening… click the microphone to finish.' : isTranscribing ? 'Transcribing your voice…' : 'Press the microphone and speak naturally.'}</span><button type="button" onClick={toggleRecording} disabled={isTranscribing || isSending} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold ${isRecording ? 'bg-pressure text-paper' : 'bg-ink text-paper'} disabled:opacity-50`}><Mic size={13} />{isRecording ? 'Stop' : 'Talk'}</button></div>}
        <div className="min-h-[360px] space-y-3 bg-paper/35 px-5 py-5" aria-live="polite">{messages.length === 0 && <div className="flex min-h-[290px] flex-col items-center justify-center text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-paper"><Bot size={26} /></div><h2 className="mt-4 font-display text-2xl">What would you like to explore?</h2><p className="mt-2 max-w-md text-sm leading-6 text-ash">Start with a trip idea, a destination, a budget or a place you want to discover.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{STARTERS.map((starter) => <button key={starter} type="button" onClick={() => send(null, starter)} className="rounded-full border border-paper-dim bg-white px-3 py-2 text-xs font-medium text-ink/70 transition hover:border-relief hover:text-relief">{starter}</button>)}</div></div>}{messages.map((item, index) => <div key={`${item.role}-${index}`} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}><p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === 'user' ? 'bg-ink text-paper' : 'border border-paper-dim bg-white text-ink/75'}`}>{item.content}</p></div>)}{isSending && <div className="flex items-center gap-2 text-xs font-semibold text-ash"><Loader2 size={14} className="animate-spin text-pressure" /> Checking real tourism data...</div>}<ResultsStrip results={lastResults} /><div ref={endRef} /></div>
        {error && <div className="flex items-center justify-between border-t border-rose-100 bg-rose-50 px-5 py-3 text-xs font-semibold text-rose-700">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={14} /></button></div>}
        <form onSubmit={send} className="flex items-end gap-2 border-t border-paper-dim p-4"><textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, MAX_MESSAGE_CHARS))} rows={2} placeholder={mode === 'voice' ? 'Use Talk above, or switch to Chat…' : 'Ask about a destination, hotel or trip...'} className="min-h-[48px] flex-1 resize-none rounded-xl border border-paper-dim bg-paper px-3 py-2.5 text-sm outline-none transition placeholder:text-ash focus:border-relief focus:ring-4 focus:ring-relief/10" /><Button type="submit" loading={isSending} icon={Send} disabled={!message.trim() || mode === 'voice'}>Send</Button></form>
      </Card>
      <aside className="space-y-4"><Card className="bg-white"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-relief">Available now</p><div className="mt-4 space-y-3"><div className="flex gap-3"><Bot size={17} className="mt-0.5 text-pressure" /><p className="text-sm leading-5 text-ink/70">Natural trip planning and follow-up questions.</p></div><div className="flex gap-3"><Map size={17} className="mt-0.5 text-relief" /><p className="text-sm leading-5 text-ink/70">Real hotels and tourist places with map links.</p></div><div className="flex gap-3"><CalendarDays size={17} className="mt-0.5 text-ink/55" /><p className="text-sm leading-5 text-ink/70">Pressure-aware alternatives when data supports them.</p></div></div></Card><Card className="border-dashed border-ink/20 bg-paper/40"><div className="flex items-center gap-2 text-sm font-semibold"><Image size={16} className="text-pressure" /> Multimodal inputs</div><p className="mt-2 text-xs leading-5 text-ash">Photo, video and voice-note understanding will be added after the chat foundation is stable.</p><div className="mt-3 flex gap-2 text-ink/40"><Image size={16} /><Mic size={16} /><Video size={16} /></div></Card></aside>
    </div>
  </div>
}
