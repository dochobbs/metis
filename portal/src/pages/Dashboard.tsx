import { useState, useEffect, useCallback, useRef } from 'react'
import { Session } from '@supabase/supabase-js'
import { RefreshCw, Loader2 } from 'lucide-react'
import {
  getAuthHeaders,
  getJsonHeaders,
  getServiceApiPath,
  getServiceAppPath,
  orderedServices,
  type ServiceConfig,
  type ServiceId,
} from '../lib/metisApi'

interface DashboardProps {
  session: Session | null
}

interface ServiceStatus {
  name: string
  id: ServiceId
  port: number
  status: 'online' | 'offline' | 'checking'
  color: string
}

interface GeneratedPatient {
  patient_id: string
  name: string
  age: string
  age_months?: number
  sex?: string
  chief_complaint?: string
  conditions?: string[]
}

interface EchoMessage {
  role: 'user' | 'assistant'
  content: string
}

const services: ServiceConfig[] = orderedServices

type Specialty = 'pediatrics' | 'internal_medicine' | 'family_practice'

const specialtyConfig = {
  pediatrics: {
    label: 'PEDS',
    count: '46',
    accent: 'text-teal-700',
    accentBg: 'bg-teal-700',
    accentLight: 'bg-teal-50',
    accentBorder: 'border-teal-300',
    dotColor: 'bg-teal-500',
  },
  internal_medicine: {
    label: 'IM',
    count: '181',
    accent: 'text-indigo-700',
    accentBg: 'bg-indigo-700',
    accentLight: 'bg-indigo-50',
    accentBorder: 'border-indigo-300',
    dotColor: 'bg-indigo-500',
  },
  family_practice: {
    label: 'FP',
    count: '213',
    accent: 'text-amber-700',
    accentBg: 'bg-amber-700',
    accentLight: 'bg-amber-50',
    accentBorder: 'border-amber-300',
    dotColor: 'bg-amber-500',
  },
}

export default function Dashboard({ session }: DashboardProps) {
  const [statuses, setStatuses] = useState<ServiceStatus[]>(
    services.map(s => ({ ...s, status: 'checking' }))
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPatient, setGeneratedPatient] = useState<GeneratedPatient | null>(null)
  const [patientAge, setPatientAge] = useState('24')
  const [specialty, setSpecialty] = useState<Specialty>('pediatrics')
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [mnemeError, setMnemeError] = useState<string | null>(null)
  const [syrinxError, setSyrinxError] = useState<string | null>(null)
  const [echoMessages, setEchoMessages] = useState<EchoMessage[]>([])
  const [echoInput, setEchoInput] = useState('')
  const [isEchoLoading, setIsEchoLoading] = useState(false)
  const [isSendingMneme, setIsSendingMneme] = useState(false)
  const [isSendingSyrinx, setIsSendingSyrinx] = useState(false)
  const [athenaStats, setAthenaStats] = useState({ conditions: 0, frameworks: 0, disease_arcs: 0, learner_tracks: 0 })
  const [athenaOnline, setAthenaOnline] = useState<boolean | null>(null)
  const [learnerLevel, setLearnerLevel] = useState<'student' | 'resident' | 'np_student'>('student')
  const echoEndRef = useRef<HTMLDivElement>(null)

  // Fetch Athena knowledge stats
  useEffect(() => {
    fetch(getServiceApiPath('athena', '/health'), {
      headers: getAuthHeaders(session),
    })
      .then(r => {
        if (!r.ok) throw new Error(`Athena health ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (data?.knowledge) setAthenaStats(data.knowledge)
        setAthenaOnline(true)
      })
      .catch(() => setAthenaOnline(false))
  }, [session])

  // Update specialty condition counts from Athena
  useEffect(() => {
    fetch(`${getServiceApiPath('athena', '/conditions')}?specialty=${specialty}`, {
      headers: getAuthHeaders(session),
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          specialtyConfig[specialty].count = String(data.length)
        }
      })
      .catch(() => {
        // Athena offline indicator already set by health check
      })
  }, [session, specialty])

  const checkStatuses = useCallback(async () => {
    // Per-service 2s timeout AND overall 3s budget — prevents one hung service
    // from stalling the whole poll.
    const overallBudget = new Promise<ServiceStatus[]>((resolve) =>
      setTimeout(() => resolve(services.map(s => ({ ...s, status: 'offline' } as ServiceStatus))), 3000)
    )
    const probes = Promise.all(
      services.map(async (service) => {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 2000)
          const res = await fetch(getServiceApiPath(service.id, '/health'), {
            headers: getAuthHeaders(session),
            signal: controller.signal,
          }).catch(() => fetch(getServiceApiPath(service.id, '/'), {
            headers: getAuthHeaders(session),
            signal: controller.signal,
          }))
          clearTimeout(timeout)
          return { ...service, status: res?.ok ? 'online' : 'offline' } as ServiceStatus
        } catch {
          return { ...service, status: 'offline' } as ServiceStatus
        }
      })
    )
    const updated = await Promise.race([probes, overallBudget])
    setStatuses(updated)
  }, [session])

  useEffect(() => {
    checkStatuses()
    const interval = setInterval(checkStatuses, 10000)
    return () => clearInterval(interval)
  }, [checkStatuses])

  useEffect(() => {
    echoEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [echoMessages])

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerateError(null)
    setGeneratedPatient(null)
    setEchoMessages([])
    try {
      const ageMonths = parseInt(patientAge)
      const res = await fetch('/api/oread/generate', {
        method: 'POST',
        headers: getJsonHeaders(session),
        body: JSON.stringify({ age_months: ageMonths, specialty }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      setGeneratedPatient({
        patient_id: data.id,
        name: data.name,
        age: `${data.age_years}y` + (data.age_years < 3 ? ` (${ageMonths}mo)` : ''),
        age_months: ageMonths,
        sex: data.sex,
        chief_complaint: data.active_conditions?.[0],
        conditions: data.active_conditions || [],
      })
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate patient')
    } finally {
      setIsGenerating(false)
    }
  }

  const sendToMneme = async () => {
    if (!generatedPatient) return
    setIsSendingMneme(true)
    setMnemeError(null)
    try {
      const patientRes = await fetch(
        `${getServiceApiPath('oread', `/patients/${generatedPatient.patient_id}`)}?format=json`,
        { headers: getAuthHeaders(session) }
      )
      if (!patientRes.ok) throw new Error(`Oread fetch failed (${patientRes.status})`)
      const patientData = await patientRes.json()
      const importRes = await fetch(getServiceApiPath('mneme', '/import/oread/json'), {
        method: 'POST',
        headers: getJsonHeaders(session),
        body: JSON.stringify(patientData),
      })
      if (!importRes.ok) {
        const detail = await importRes.text().catch(() => '')
        throw new Error(`Mneme import failed (${importRes.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`)
      }
      const result = await importRes.json()
      const mnemePatientId = result.details?.patient_id
      window.open(mnemePatientId ? getServiceAppPath('mneme', `/patients/${mnemePatientId}`) : getServiceAppPath('mneme'), '_blank')
    } catch (err) {
      setMnemeError(err instanceof Error ? err.message : 'Mneme import failed')
    } finally {
      setIsSendingMneme(false)
    }
  }

  const sendToSyrinx = async () => {
    if (!generatedPatient) return
    setIsSendingSyrinx(true)
    setSyrinxError(null)
    try {
      const patientRes = await fetch(
        `${getServiceApiPath('oread', `/patients/${generatedPatient.patient_id}`)}?format=json`,
        { headers: getAuthHeaders(session) }
      )
      if (!patientRes.ok) throw new Error(`Oread fetch failed (${patientRes.status})`)
      const patientData = await patientRes.json()
      const importRes = await fetch(getServiceApiPath('syrinx', '/patients/import'), {
        method: 'POST',
        headers: getJsonHeaders(session),
        body: JSON.stringify(patientData),
      })
      if (!importRes.ok) {
        const detail = await importRes.text().catch(() => '')
        throw new Error(`Syrinx import failed (${importRes.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`)
      }
      window.open(getServiceAppPath('syrinx'), '_blank')
    } catch (err) {
      setSyrinxError(err instanceof Error ? err.message : 'Syrinx send failed')
    } finally {
      setIsSendingSyrinx(false)
    }
  }

  const sendToEcho = async () => {
    if (!echoInput.trim()) return
    const userMessage = echoInput.trim()
    setEchoMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setEchoInput('')
    setIsEchoLoading(true)
    try {
      const payload: Record<string, unknown> = { learner_question: userMessage, learner_level: learnerLevel }
      if (generatedPatient) {
        try {
          const ctxRes = await fetch(
            getServiceApiPath('oread', `/patients/${generatedPatient.patient_id}/context`),
            { headers: getAuthHeaders(session) }
          )
          if (ctxRes.ok) { payload.patient = await ctxRes.json() }
        } catch {
          payload.patient = {
            patient_id: generatedPatient.patient_id, source: 'oread',
            name: generatedPatient.name, age_months: generatedPatient.age_months, sex: generatedPatient.sex,
            problem_list: generatedPatient.conditions?.map(c => ({ display_name: c, is_active: true })) || [],
          }
        }
      }
      const res = await fetch(getServiceApiPath('echo', '/question'), {
        method: 'POST', headers: getJsonHeaders(session), body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Echo request failed')
      const data = await res.json()
      setEchoMessages(prev => [...prev, {
        role: 'assistant', content: data.question || data.response || data.feedback || 'I received your question.',
      }])
    } catch {
      setEchoMessages(prev => [...prev, { role: 'assistant', content: 'Echo offline — start on port 9101.' }])
    } finally { setIsEchoLoading(false) }
  }

  const isOreadOnline = statuses.find(s => s.id === 'oread')?.status === 'online'
  const isEchoOnline = statuses.find(s => s.id === 'echo')?.status === 'online'
  const sc = specialtyConfig[specialty]

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-5">

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between pb-3 mb-5 border-b border-stone-300">
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] font-semibold tracking-[0.12em] uppercase text-stone-800">MEDED</span>
          <span className="text-[10px] text-stone-400 tracking-widest">v2</span>
        </div>
        <div className="flex items-center gap-4">
          {statuses.map(s => (
            <a key={s.id}
              href={s.id === 'athena' ? getServiceApiPath('athena', '/health') : getServiceAppPath(s.id)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 group"
            >
              <span className={`w-[6px] h-[6px] rounded-full ${
                s.status === 'online' ? 'bg-stone-800' : 'bg-stone-300'
              }`} />
              <span className="text-[10px] text-stone-400 group-hover:text-stone-700 transition-colors tracking-wider uppercase">
                {s.name}
              </span>
            </a>
          ))}
          <button onClick={checkStatuses} className="ml-1 text-stone-300 hover:text-stone-600 transition-colors">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Specialty ── */}
      <div className="flex items-center gap-0 mb-6">
        {(Object.entries(specialtyConfig) as [Specialty, typeof sc][]).map(([key, config]) => (
          <button
            key={key}
            onClick={() => {
              setSpecialty(key)
              if (key === 'internal_medicine' && parseInt(patientAge) < 216) setPatientAge('360')
              if (key === 'pediatrics' && parseInt(patientAge) > 216) setPatientAge('60')
            }}
            className={`px-4 py-2 text-[11px] font-semibold tracking-[0.15em] uppercase border transition-all duration-150 -ml-px first:ml-0 ${
              specialty === key
                ? `${config.accentLight} ${config.accent} ${config.accentBorder}`
                : 'bg-white text-stone-400 border-stone-200 hover:text-stone-600 hover:border-stone-300'
            }`}
          >
            {config.label}
            <span className="ml-2 text-[10px] font-normal opacity-60">{config.count}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-0">
          {(['student', 'resident', 'np_student'] as const).map(level => (
            <button
              key={level}
              onClick={() => setLearnerLevel(level)}
              className={`px-3 py-1.5 text-[10px] tracking-wider uppercase border -ml-px first:ml-0 transition-all ${
                learnerLevel === level
                  ? 'bg-stone-800 text-stone-100 border-stone-800'
                  : 'bg-white text-stone-400 border-stone-200 hover:text-stone-600'
              }`}
            >
              {level === 'np_student' ? 'NP' : level === 'student' ? 'MS' : 'PGY'}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2×2 Grid ── */}
      <div className="grid grid-cols-2 gap-[1px] bg-stone-300 border border-stone-300">

        {/* GENERATE */}
        <div className="bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-stone-400">Generate</span>
            <span className={`text-[10px] tracking-widest uppercase ${sc.accent}`}>Oread</span>
          </div>
          {!isOreadOnline ? (
            <p className="text-[11px] text-stone-400">Oread offline — port 9104</p>
          ) : (
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-[10px] text-stone-400 tracking-wider uppercase mb-1">Age (mo)</label>
                <input
                  type="number" value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  className="w-24 px-3 py-2 bg-stone-50 border border-stone-200 text-stone-800 text-[13px]
                    focus:outline-none focus:border-stone-400 placeholder:text-stone-300"
                  min="0" max={specialty === 'pediatrics' ? '216' : '1200'}
                />
              </div>
              <button
                onClick={handleGenerate} disabled={isGenerating}
                className={`px-5 py-2 ${sc.accentBg} text-white text-[11px] font-semibold tracking-[0.15em] uppercase
                  hover:brightness-110 disabled:opacity-40 transition-all`}
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'GEN'}
              </button>
            </div>
          )}
          {generateError && <p className="mt-3 text-[11px] text-red-600">{generateError}</p>}
        </div>

        {/* PATIENT */}
        <div className="bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-stone-400">Patient</span>
            {generatedPatient && (
              <span className="text-[10px] text-stone-300">{generatedPatient.patient_id.slice(0,8)}</span>
            )}
          </div>
          {generatedPatient ? (
            <>
              <p className="text-[17px] font-semibold text-stone-900 tracking-tight">{generatedPatient.name}</p>
              <p className="text-[12px] text-stone-500 mt-1">
                {generatedPatient.age}{generatedPatient.sex && ` · ${generatedPatient.sex}`}
              </p>
              {generatedPatient.conditions && generatedPatient.conditions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {generatedPatient.conditions.map((c, i) => (
                    <span key={i} className={`text-[10px] tracking-wide px-2 py-0.5 ${sc.accentLight} ${sc.accent}`}>{c}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-5 mt-4 pt-3 border-t border-stone-100">
                <button onClick={sendToMneme} disabled={isSendingMneme}
                  className="text-[10px] text-stone-400 hover:text-stone-700 tracking-[0.15em] uppercase transition-colors disabled:opacity-40">
                  {isSendingMneme ? '...' : 'CHART →'}
                </button>
                <button onClick={sendToSyrinx} disabled={isSendingSyrinx}
                  className="text-[10px] text-stone-400 hover:text-stone-700 tracking-[0.15em] uppercase transition-colors disabled:opacity-40">
                  {isSendingSyrinx ? '...' : 'VOICE →'}
                </button>
                <a href={getServiceAppPath('oread', `/patients/${generatedPatient.patient_id}`)}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-stone-400 hover:text-stone-700 tracking-[0.15em] uppercase transition-colors">
                  EXPORT →
                </a>
              </div>
              {mnemeError && (
                <p className="mt-2 text-[10px] text-red-600">
                  CHART: {mnemeError}{' '}
                  <button onClick={() => setMnemeError(null)} className="underline ml-1">dismiss</button>
                </p>
              )}
              {syrinxError && (
                <p className="mt-1 text-[10px] text-red-600">
                  VOICE: {syrinxError}{' '}
                  <button onClick={() => setSyrinxError(null)} className="underline ml-1">dismiss</button>
                </p>
              )}
            </>
          ) : (
            <p className="text-[12px] text-stone-300 font-prose">No patient.</p>
          )}
        </div>

        {/* ECHO — full width */}
        <div className="col-span-2 bg-white flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-stone-400">Echo</span>
            <span className="text-[10px] text-stone-300 tracking-widest uppercase">Socratic</span>
          </div>
          <div className="flex-1 min-h-[120px] max-h-[260px] overflow-y-auto px-5 py-4 space-y-3">
            {!isEchoOnline ? (
              <p className="text-[11px] text-stone-400">Echo offline — port 9101</p>
            ) : echoMessages.length === 0 ? (
              <p className="text-[12px] text-stone-400 font-prose">
                Ask about clinical reasoning, differentials, or management.
                {generatedPatient && <span className={`ml-1 ${sc.accent}`}>Patient context attached.</span>}
              </p>
            ) : (
              echoMessages.map((msg, i) => (
                <div key={i} className={`text-[13px] leading-relaxed font-prose ${
                  msg.role === 'user'
                    ? 'text-stone-700 ml-12'
                    : `text-stone-600 border-l-2 ${sc.accentBorder} pl-4`
                }`}>
                  {msg.content}
                </div>
              ))
            )}
            {isEchoLoading && (
              <div className="flex items-center gap-2 text-[11px] text-stone-400">
                <Loader2 className="w-3 h-3 animate-spin" /> thinking...
              </div>
            )}
            <div ref={echoEndRef} />
          </div>
          <div className="px-5 py-3 border-t border-stone-100">
            <div className="flex gap-2">
              <input
                type="text" value={echoInput}
                onChange={(e) => setEchoInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendToEcho()}
                placeholder={isEchoOnline ? 'ask echo...' : 'offline'}
                disabled={!isEchoOnline}
                className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 text-stone-700 text-[13px] font-prose
                  placeholder:text-stone-300 focus:outline-none focus:border-stone-400 disabled:opacity-40"
              />
              <button onClick={sendToEcho} disabled={!isEchoOnline || !echoInput.trim()}
                className={`px-4 py-2 ${sc.accentLight} ${sc.accent} text-[12px] font-semibold
                  hover:brightness-95 disabled:opacity-30 transition-all border ${sc.accentBorder}`}
              >↵</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer Stats ── */}
      <div className="flex items-center gap-6 mt-3 text-[10px] text-stone-400 tracking-wider">
        <span><span className="text-stone-600">{athenaStats.conditions || '—'}</span> conditions</span>
        <span><span className="text-stone-600">{athenaStats.frameworks || '—'}</span> frameworks</span>
        <span><span className="text-stone-600">{athenaStats.disease_arcs || '—'}</span> arcs</span>
        <span><span className="text-stone-600">{athenaStats.learner_tracks || '—'}</span> tracks</span>
        {athenaOnline === false && (
          <span className="text-red-600">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
            Athena offline
          </span>
        )}
        <span className="ml-auto">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${sc.dotColor} mr-1.5`} />
          {sc.label} · {learnerLevel === 'np_student' ? 'NP' : learnerLevel === 'student' ? 'MS' : 'PGY'}
        </span>
      </div>
    </div>
  )
}
