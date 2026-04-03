import { useState, useEffect, useCallback } from 'react'
import { Session } from '@supabase/supabase-js'
import {
  User, Mic, FileText, MessageCircle, Send, RefreshCw,
  Sparkles, ArrowRight, ExternalLink, Loader2, CheckCircle2,
  AlertCircle, Baby, Stethoscope, ClipboardList
} from 'lucide-react'

interface DashboardProps {
  session: Session | null
}

interface ServiceStatus {
  name: string
  id: string
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

const services: Omit<ServiceStatus, 'status'>[] = [
  { name: 'Oread', id: 'oread', port: 8004, color: 'emerald' },
  { name: 'Syrinx', id: 'syrinx', port: 8003, color: 'violet' },
  { name: 'Mneme', id: 'mneme', port: 8002, color: 'amber' },
  { name: 'Echo', id: 'echo', port: 8001, color: 'cyan' },
]

export default function Dashboard({ session }: DashboardProps) {
  // Service status
  const [statuses, setStatuses] = useState<ServiceStatus[]>(
    services.map(s => ({ ...s, status: 'checking' }))
  )

  // Patient generation
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPatient, setGeneratedPatient] = useState<GeneratedPatient | null>(null)
  const [patientAge, setPatientAge] = useState('24') // months
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Echo chat
  const [echoMessages, setEchoMessages] = useState<EchoMessage[]>([])
  const [echoInput, setEchoInput] = useState('')
  const [isEchoLoading, setIsEchoLoading] = useState(false)

  // Status checking
  const checkStatuses = useCallback(async () => {
    const updated = await Promise.all(
      services.map(async (service) => {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 2000)
          const res = await fetch(`http://localhost:${service.port}/health`, {
            signal: controller.signal,
          }).catch(() => fetch(`http://localhost:${service.port}/`))
          clearTimeout(timeout)
          return { ...service, status: res?.ok ? 'online' : 'offline' } as ServiceStatus
        } catch {
          return { ...service, status: 'offline' } as ServiceStatus
        }
      })
    )
    setStatuses(updated)
  }, [])

  useEffect(() => {
    checkStatuses()
    const interval = setInterval(checkStatuses, 10000)
    return () => clearInterval(interval)
  }, [checkStatuses])

  // Generate patient via Oread's synchronous endpoint (proxied through Vite)
  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerateError(null)
    setGeneratedPatient(null)
    setEchoMessages([])

    try {
      const ageMonths = parseInt(patientAge)
      const res = await fetch('/api/oread/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ age_months: ageMonths }),
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

  // Send to Mneme: fetch full patient JSON from Oread, POST to Mneme import
  const [isSendingMneme, setIsSendingMneme] = useState(false)
  const [isSendingSyrinx, setIsSendingSyrinx] = useState(false)

  const sendToMneme = async () => {
    if (!generatedPatient) return
    setIsSendingMneme(true)
    try {
      // Fetch full patient record from Oread
      const patientRes = await fetch(`/api/oread/patients/${generatedPatient.patient_id}?format=json`)
      if (!patientRes.ok) throw new Error('Failed to fetch patient from Oread')
      const patientData = await patientRes.json()

      // POST to Mneme's JSON import endpoint
      const importRes = await fetch('/api/mneme/import/oread/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData),
      })

      if (importRes.ok) {
        const result = await importRes.json()
        const mnemePatientId = result.details?.patient_id
        window.open(
          mnemePatientId
            ? `http://localhost:5173/patients/${mnemePatientId}`
            : 'http://localhost:5173',
          '_blank'
        )
      } else {
        // Fallback: open Mneme import page
        window.open('http://localhost:5173/import', '_blank')
      }
    } catch {
      window.open('http://localhost:5173/import', '_blank')
    } finally {
      setIsSendingMneme(false)
    }
  }

  // Send to Syrinx: fetch full patient JSON from Oread, POST to Syrinx import
  const sendToSyrinx = async () => {
    if (!generatedPatient) return
    setIsSendingSyrinx(true)
    try {
      // Fetch full patient record from Oread
      const patientRes = await fetch(`/api/oread/patients/${generatedPatient.patient_id}?format=json`)
      if (!patientRes.ok) throw new Error('Failed to fetch patient from Oread')
      const patientData = await patientRes.json()

      // POST to Syrinx's import endpoint
      const importRes = await fetch('/api/syrinx/patients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData),
      })

      if (importRes.ok) {
        window.open('http://localhost:9103', '_blank')
      } else {
        window.open('http://localhost:9103', '_blank')
      }
    } catch {
      window.open('http://localhost:9103', '_blank')
    } finally {
      setIsSendingSyrinx(false)
    }
  }

  // Echo chat: fetch PatientContext from Oread and send to Echo /question
  const sendToEcho = async () => {
    if (!echoInput.trim()) return

    const userMessage = echoInput.trim()
    setEchoMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setEchoInput('')
    setIsEchoLoading(true)

    try {
      const payload: Record<string, unknown> = {
        learner_question: userMessage,
        learner_level: 'student',
      }

      // Fetch full PatientContext from Oread's /context endpoint
      if (generatedPatient) {
        try {
          const ctxRes = await fetch(`/api/oread/patients/${generatedPatient.patient_id}/context`)
          if (ctxRes.ok) {
            payload.patient = await ctxRes.json()
          }
        } catch {
          // Fallback: build minimal context from local data
          payload.patient = {
            patient_id: generatedPatient.patient_id,
            source: 'oread',
            name: generatedPatient.name,
            age_months: generatedPatient.age_months,
            sex: generatedPatient.sex,
            problem_list: generatedPatient.conditions?.map(c => ({ display_name: c, is_active: true })) || [],
          }
        }
      }

      const res = await fetch('/api/echo/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Echo request failed')

      const data = await res.json()
      setEchoMessages(prev => [...prev, {
        role: 'assistant',
        content: data.question || data.response || data.feedback || 'I received your question.',
      }])
    } catch {
      setEchoMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I couldn\'t process that. Make sure Echo is running on port 8001.',
      }])
    } finally {
      setIsEchoLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    if (status === 'online') return 'bg-green-500'
    if (status === 'offline') return 'bg-red-500'
    return 'bg-gray-400 animate-pulse'
  }

  const isOreadOnline = statuses.find(s => s.id === 'oread')?.status === 'online'
  const isEchoOnline = statuses.find(s => s.id === 'echo')?.status === 'online'

  return (
    <div className="space-y-8">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">MedEd Platform</h1>
          <p className="mt-1 text-gray-600">
            {session ? 'Welcome back!' : 'Generate patients, practice, and learn.'}
          </p>
        </div>
        <button
          onClick={checkStatuses}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Service Status Bar */}
      <div className="flex items-center gap-6 p-4 bg-white rounded-lg border border-gray-200">
        <span className="text-sm font-medium text-gray-700">Services:</span>
        {statuses.map(service => (
          <a
            key={service.id}
            href={`http://localhost:${service.id === 'mneme' ? 5173 : service.port}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <span className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`} />
            {service.name}
            <ExternalLink className="w-3 h-3 opacity-50" />
          </a>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Generator */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Generate Patient</h2>
                <p className="text-sm text-gray-600">Create a synthetic patient with Oread</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {!isOreadOnline ? (
              <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">Oread is offline. Start it on port 8004.</span>
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Patient Age (months)
                    </label>
                    <input
                      type="number"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="24"
                      min="0"
                      max="216"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Generate
                    </button>
                  </div>
                </div>

                {generateError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    {generateError}
                  </div>
                )}

                {generatedPatient && (
                  <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-gray-900">Patient Generated</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Name:</span>
                        <span className="ml-2 font-medium">{generatedPatient.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Age:</span>
                        <span className="ml-2 font-medium">{generatedPatient.age}</span>
                      </div>
                      {generatedPatient.chief_complaint && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Chief Complaint:</span>
                          <span className="ml-2 font-medium">{generatedPatient.chief_complaint}</span>
                        </div>
                      )}
                      {generatedPatient.conditions && generatedPatient.conditions.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Conditions:</span>
                          <span className="ml-2 font-medium">{generatedPatient.conditions.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={sendToMneme}
                        disabled={isSendingMneme}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50"
                      >
                        {isSendingMneme ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        Open in Mneme
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={sendToSyrinx}
                        disabled={isSendingSyrinx}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 disabled:opacity-50"
                      >
                        {isSendingSyrinx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                        Send to Syrinx
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Echo Chat */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 bg-cyan-50 border-b border-cyan-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <MessageCircle className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Ask Echo</h2>
                <p className="text-sm text-gray-600">Socratic guidance on clinical decisions</p>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-3 min-h-[200px] max-h-[300px] overflow-y-auto bg-gray-50">
            {!isEchoOnline ? (
              <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">Echo is offline. Start it on port 8001.</span>
              </div>
            ) : echoMessages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Ask Echo about clinical reasoning, differential diagnosis, or treatment plans.</p>
                {generatedPatient && (
                  <p className="text-xs mt-2 text-cyan-600">Patient context will be included automatically.</p>
                )}
              </div>
            ) : (
              echoMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-cyan-100 text-cyan-900 ml-8'
                      : 'bg-white border border-gray-200 mr-8'
                  }`}
                >
                  {msg.content}
                </div>
              ))
            )}
            {isEchoLoading && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Echo is thinking...
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={echoInput}
                onChange={(e) => setEchoInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendToEcho()}
                placeholder={isEchoOnline ? "What should I consider for this patient?" : "Echo is offline"}
                disabled={!isEchoOnline}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100"
              />
              <button
                onClick={sendToEcho}
                disabled={!isEchoOnline || !echoInput.trim()}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="http://localhost:9104"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-emerald-100 rounded-lg">
            <Baby className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Full Oread UI</h3>
            <p className="text-sm text-gray-500">Advanced patient generation</p>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
        </a>

        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-amber-100 rounded-lg">
            <ClipboardList className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Mneme EMR</h3>
            <p className="text-sm text-gray-500">Review patient charts</p>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
        </a>

        <a
          href="http://localhost:9103"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-violet-300 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-violet-100 rounded-lg">
            <Mic className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Syrinx Voice</h3>
            <p className="text-sm text-gray-500">Generate encounter scripts</p>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
        </a>
      </div>
    </div>
  )
}
