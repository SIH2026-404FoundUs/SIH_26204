import { useEffect, useRef, useState } from 'react'
import { Megaphone, Mic, Square, Type, Wand2, Copy, Check, Share2, RefreshCw, Sparkles, Languages, Layers } from 'lucide-react'
import { useContentGeneratorStore } from '../../store/useContentGeneratorStore'
import { useOperatorStore } from '../../store/useOperatorStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import FormField, { inputClass } from '../ui/FormField'

// Keep in sync with backend/src/services/content/contentGeneratorService.js
// (LANGUAGES/PLATFORMS/TONES) -- duplicated here only as display labels +
// select option order; the backend is the actual source of truth and
// re-validates everything server-side regardless of what this sends.
const LANGUAGES = [
  ['en', 'English'], ['hi', 'Hindi'], ['te', 'Telugu'], ['gu', 'Gujarati'], ['bn', 'Bengali'], ['as', 'Assamese'],
  ['hi-en', 'Hinglish (English + Hindi)'], ['te-en', 'Telugish (English + Telugu)'],
  ['gu-en', 'Gujlish (English + Gujarati)'], ['bn-en', 'Banglish (English + Bengali)'], ['as-en', 'Asmish (English + Assamese)'],
]
const PLATFORMS = [
  ['instagram', 'Instagram'], ['twitter', 'X / Twitter'], ['facebook', 'Facebook'],
  ['whatsapp', 'WhatsApp Broadcast/Status'], ['general', 'General Promotional Post'],
]
const TONES = [
  ['professional', 'Professional'], ['friendly', 'Friendly'], ['exciting', 'Exciting'], ['premium', 'Premium'],
  ['local-cultural', 'Local Cultural'], ['storytelling', 'Storytelling'], ['minimal', 'Minimal'], ['ai-decides', 'AI Decides'],
]
const SAMPLE_PROMPTS = [
  'Our homestay near Manali has 2 rooms open this weekend with a discount for early booking.',
  'New guided sunrise trek launching next month -- small groups of 6, all gear included.',
  'Fresh local Himachali thali served every evening at our restaurant, made with produce from our own farm.',
  'Festival season special on our guesthouse rooms this week -- limited dates available.',
]

// Live bar-style waveform driven by an AnalyserNode -- gives real-time
// feedback that the mic is actually picking up sound while recording,
// rather than a recorder that looks frozen for the whole duration.
function Waveform({ analyser }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)

  useEffect(() => {
    if (!analyser) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const data = new Uint8Array(analyser.frequencyBinCount)

    function draw() {
      frameRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(data)
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      const barCount = 40
      const step = Math.floor(data.length / barCount)
      for (let i = 0; i < barCount; i++) {
        const value = Math.abs(data[i * step] - 128) / 128 // 0..1
        const barHeight = Math.max(3, value * height)
        ctx.fillStyle = '#c2410c' // pressure token's approximate hex, canvas can't read CSS vars directly
        ctx.fillRect(i * (width / barCount), (height - barHeight) / 2, (width / barCount) * 0.6, barHeight)
      }
    }
    draw()
    return () => cancelAnimationFrame(frameRef.current)
  }, [analyser])

  return <canvas ref={canvasRef} width={280} height={48} className="w-full rounded-lg bg-paper-dim/40" />
}

// Text or voice input for what the operator wants promoted. Voice records
// in-browser (MediaRecorder), then hands the raw audio to
// useContentGeneratorStore.transcribeAudio (Whisper large-v3 via Groq) --
// the resulting transcript lands in an editable textarea, same as the text
// tab, so a transcription slip can be fixed by hand before generating.
function InputPanel({ rawText, setRawText }) {
  const [mode, setMode] = useState('text') // 'text' | 'voice'
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [analyser, setAnalyser] = useState(null)
  const [detectedLanguage, setDetectedLanguage] = useState(null)
  const { isTranscribing, transcribeError, transcribeAudio } = useContentGeneratorStore()

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => () => {
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  async function startRecording() {
    setDetectedLanguage(null)
    setAudioUrl(null)
    chunksRef.current = []
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyserNode = audioCtx.createAnalyser()
    analyserNode.fftSize = 256
    source.connect(analyserNode)
    setAnalyser(analyserNode)

    const recorder = new MediaRecorder(stream)
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      setAudioUrl(URL.createObjectURL(blob))
      stream.getTracks().forEach((t) => t.stop())
      audioCtx.close()
    }
    recorder.start()
    mediaRecorderRef.current = recorder

    setRecording(true)
    setDuration(0)
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    clearInterval(timerRef.current)
    setRecording(false)
    setAnalyser(null)
  }

  async function handleTranscribe() {
    if (!chunksRef.current.length) return
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const result = await transcribeAudio(blob)
    if (result) {
      setRawText(result.transcript)
      setDetectedLanguage(result.detectedLanguage)
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-paper-dim/50 p-1">
        <button type="button" onClick={() => setMode('text')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold transition ${mode === 'text' ? 'bg-white text-ink shadow-sm' : 'text-ink/60'}`}>
          <Type size={15} aria-hidden="true" /> Text
        </button>
        <button type="button" onClick={() => setMode('voice')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold transition ${mode === 'voice' ? 'bg-white text-ink shadow-sm' : 'text-ink/60'}`}>
          <Mic size={15} aria-hidden="true" /> Voice
        </button>
      </div>

      {mode === 'text' ? (
        <>
          <FormField label="What do you want to promote?">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={4}
              placeholder="Tell us what's on offer -- rooms, a new package, a seasonal special..."
              className={inputClass}
            />
          </FormField>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setRawText(p)}
                className="rounded-full border border-paper-dim px-2.5 py-1 text-xs text-ink/60 transition hover:border-ink/30 hover:text-ink"
              >
                {p.slice(0, 32)}…
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {recording ? (
            <>
              <Waveform analyser={analyser} />
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-ink/70">{String(Math.floor(duration / 60)).padStart(2, '0')}:{String(duration % 60).padStart(2, '0')}</span>
                <Button type="button" variant="danger" size="sm" icon={Square} onClick={stopRecording}>Stop</Button>
              </div>
            </>
          ) : (
            <Button type="button" variant="secondary" icon={Mic} onClick={startRecording} fullWidth>
              {audioUrl ? 'Record again' : 'Start recording'}
            </Button>
          )}

          {audioUrl && !recording && (
            <div className="space-y-2 rounded-lg border border-paper-dim p-3">
              <audio src={audioUrl} controls className="w-full" />
              <Button type="button" variant="primary" size="sm" icon={Wand2} loading={isTranscribing} onClick={handleTranscribe} fullWidth>
                Transcribe with Whisper
              </Button>
            </div>
          )}

          {transcribeError && <Alert tone="error">{transcribeError}</Alert>}

          {rawText && (
            <FormField label="Transcript" hint={detectedLanguage ? `Detected language: ${detectedLanguage}` : 'Edit if anything was misheard'}>
              <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={4} className={inputClass} />
            </FormField>
          )}
        </div>
      )}
    </Card>
  )
}

// One generated variant: body copy, hashtag pills, and the four 1-click
// actions (spec: Copy Body, Copy Hashtags, Copy Everything, Share to
// WhatsApp). Regenerate lives one level up since it re-runs the whole
// batch, not a single variant.
function VariantCard({ variant, index }) {
  const [copied, setCopied] = useState(null) // 'body' | 'hashtags' | 'all' | null

  const hashtagText = variant.hashtags.map((h) => `#${h}`).join(' ')
  const fullText = hashtagText ? `${variant.body}\n\n${hashtagText}` : variant.body

  async function copy(key, text) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // clipboard permission denied -- nothing more to do, the text is still visible to select manually
    }
  }

  function shareToWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, '_blank', 'noopener')
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <Badge tone="info">Variant {index + 1}</Badge>
      </div>
      <p className="whitespace-pre-wrap text-sm text-ink">{variant.body}</p>
      {variant.hashtags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {variant.hashtags.map((h) => (
            <span key={h} className="rounded-full bg-pressure/10 px-2 py-0.5 text-xs font-medium text-pressure">#{h}</span>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-paper-dim pt-3">
        <Button size="sm" variant="secondary" icon={copied === 'body' ? Check : Copy} onClick={() => copy('body', variant.body)}>
          {copied === 'body' ? 'Copied' : 'Copy body'}
        </Button>
        {variant.hashtags.length > 0 && (
          <Button size="sm" variant="secondary" icon={copied === 'hashtags' ? Check : Copy} onClick={() => copy('hashtags', hashtagText)}>
            {copied === 'hashtags' ? 'Copied' : 'Copy hashtags'}
          </Button>
        )}
        <Button size="sm" variant="secondary" icon={copied === 'all' ? Check : Copy} onClick={() => copy('all', fullText)}>
          {copied === 'all' ? 'Copied' : 'Copy everything'}
        </Button>
        <Button size="sm" variant="secondary" icon={Share2} onClick={shareToWhatsApp}>WhatsApp</Button>
      </div>
    </Card>
  )
}

// Tourism Publicity Generator -- operator-only. Text or voice input (Whisper
// large-v3 via Groq) -> optional grounding against one of the operator's
// own registered businesses (real name/price/discount/amenities, so the
// anti-hallucination engine has verified facts to work from, not just
// whatever the operator typed) -> N marketing copy variants across 5
// platforms / 11 languages / 8 tones, generated by Groq with an automatic
// Mistral fallback (backend/src/services/content/contentGeneratorService.js
// owns all of that; this component is the form + results view around it).
export default function ContentGenerator() {
  const { myBusinesses, isLoadingBusinesses, fetchMyBusinesses } = useOperatorStore()
  const { isGenerating, generateError, result, generateContent, regenerate } = useContentGeneratorStore()

  const [rawText, setRawText] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [language, setLanguage] = useState('en')
  const [platform, setPlatform] = useState('instagram')
  const [tone, setTone] = useState('friendly')
  const [variantCount, setVariantCount] = useState(2)

  useEffect(() => { fetchMyBusinesses() }, [fetchMyBusinesses])

  async function handleGenerate(e) {
    e.preventDefault()
    await generateContent({ rawText, businessId: businessId || null, language, platform, tone, variantCount })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={Megaphone}
        title="Content generator"
        description="Turn what you'd tell a traveller in person into ready-to-post marketing copy -- typed or spoken, in the language your audience actually reads."
      />

      <InputPanel rawText={rawText} setRawText={setRawText} />

      <Card className="mt-4">
        <form onSubmit={handleGenerate} className="space-y-4">
          <FormField label="Ground this in one of your businesses" optional hint="Pulls real price, discount, and amenities so nothing gets fabricated">
            {isLoadingBusinesses ? (
              <p className="text-xs text-ash">Loading your businesses…</p>
            ) : (
              <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} className={inputClass}>
                <option value="">None -- use my text only</option>
                {myBusinesses.map((b) => <option key={b._id} value={b._id}>{b.name} · {b.destId}</option>)}
              </select>
            )}
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Language">
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass}>
                {LANGUAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </FormField>
            <FormField label="Platform">
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClass}>
                {PLATFORMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </FormField>
            <FormField label="Tone">
              <select value={tone} onChange={(e) => setTone(e.target.value)} className={inputClass}>
                {TONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </FormField>
            <FormField label="Variants">
              <div className="flex gap-1.5">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setVariantCount(n)}
                    className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition ${variantCount === n ? 'border-ink bg-ink text-paper' : 'border-paper-dim text-ink/70 hover:border-ink/30'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </FormField>
          </div>

          {generateError && <Alert tone="error">{generateError}</Alert>}

          <Button type="submit" variant="primary" icon={Sparkles} loading={isGenerating} disabled={!rawText.trim()} fullWidth>
            Generate
          </Button>
        </form>
      </Card>

      {isGenerating && !result && (
        <div className="mt-6"><LoadingState label="Writing your campaign…" /></div>
      )}

      {result && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-ash">
              <Languages size={13} aria-hidden="true" /> {LANGUAGES.find(([v]) => v === language)?.[1]}
              <span aria-hidden="true">·</span>
              <Layers size={13} aria-hidden="true" /> {PLATFORMS.find(([v]) => v === platform)?.[1]}
              <span aria-hidden="true">·</span>
              <Badge tone={result.provider === 'groq' ? 'success' : 'info'}>{result.provider === 'groq' ? 'Groq' : 'Mistral (fallback)'}</Badge>
            </div>
            <Button type="button" variant="outline" size="sm" icon={RefreshCw} loading={isGenerating} onClick={regenerate}>
              Regenerate
            </Button>
          </div>

          {result.warnings?.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {result.warnings.map((w) => <Alert key={w} tone="warning">{w}</Alert>)}
            </div>
          )}

          <div className="space-y-3">
            {result.variants.map((v, i) => <VariantCard key={i} variant={v} index={i} />)}
          </div>
        </div>
      )}
    </div>
  )
}
