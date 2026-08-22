import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import {
  User, Mic, FileText, MessageCircle,
  ArrowLeft, ExternalLink, RefreshCw,
  CircleDot, LucideIcon
} from 'lucide-react'
import {
  getAuthHeaders,
  getServiceApiPath,
  getServiceAppPath,
  serviceConfigs,
  type ServiceConfig,
  type ServiceId,
} from '../lib/metisApi'

interface ToolConfig extends ServiceConfig {
  id: Exclude<ServiceId, 'athena'>
  icon: LucideIcon
}

interface ToolEmbedProps {
  session: Session | null
}

const toolConfigs: Record<Exclude<ServiceId, 'athena'>, ToolConfig> = {
  oread: {
    ...serviceConfigs.oread,
    id: 'oread',
    icon: User,
  },
  syrinx: {
    ...serviceConfigs.syrinx,
    id: 'syrinx',
    icon: Mic,
  },
  mneme: {
    ...serviceConfigs.mneme,
    id: 'mneme',
    icon: FileText,
  },
  echo: {
    ...serviceConfigs.echo,
    id: 'echo',
    icon: MessageCircle,
  },
}

export default function ToolEmbed({ session }: ToolEmbedProps) {
  const { toolId } = useParams<{ toolId: string }>()
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [iframeKey, setIframeKey] = useState(0)

  const tool = toolId && isToolId(toolId) ? toolConfigs[toolId] : null

  useEffect(() => {
    if (!tool) return

    const checkStatus = async () => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)

        // Try /health first, then fallback to root
        const response = await fetch(getServiceApiPath(tool.id, '/health'), {
          method: 'GET',
          headers: getAuthHeaders(session),
          signal: controller.signal,
        }).catch(() =>
          fetch(getServiceApiPath(tool.id, '/'), {
            method: 'GET',
            headers: getAuthHeaders(session),
            signal: controller.signal,
          })
        )

        clearTimeout(timeout)
        setStatus(response && response.ok ? 'online' : 'offline')
      } catch {
        setStatus('offline')
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 15000)
    return () => clearInterval(interval)
  }, [session, tool])

  if (!tool) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Tool not found</h1>
        <Link to="/" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
      violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
      cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
    }
    return colors[color] || colors.emerald
  }

  const colors = getColorClasses(tool.color)
  const Icon = tool.icon
  const appPath = getServiceAppPath(tool.id)

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1)
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      {/* Tool Header */}
      <div className={`${colors.bg} ${colors.border} border rounded-lg p-4 mb-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-3">
              <Icon className={`w-6 h-6 ${colors.text}`} />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{tool.name}</h1>
                <p className="text-sm text-gray-500">{tool.description}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className="flex items-center gap-2 text-sm">
              <CircleDot className={`w-4 h-4 ${
                status === 'online' ? 'text-green-500' :
                status === 'offline' ? 'text-red-500' : 'text-gray-400 animate-pulse'
              }`} />
              <span className="text-gray-600 capitalize">{status}</span>
              <span className="text-gray-400">:{tool.port}</span>
            </div>
            {/* Actions */}
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
            <a
              href={appPath}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4 text-gray-600" />
            </a>
          </div>
        </div>
      </div>

      {/* Iframe or Offline Message */}
      {status === 'offline' ? (
        <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-center">
            <Icon className={`w-16 h-16 ${colors.text} mx-auto mb-4 opacity-50`} />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{tool.name} is offline</h2>
            <p className="text-gray-600 mb-4">Start the service to use it here</p>
            <code className="bg-gray-100 px-3 py-2 rounded text-sm">
              cd {tool.greekName === 'synchart' ? 'synchart/backend' : tool.greekName} && python server.py
            </code>
          </div>
        </div>
      ) : (
        <iframe
          key={iframeKey}
          src={`http://localhost:${tool.uiPort}`}
          className="w-full h-full rounded-lg border border-gray-200"
          title={tool.name}
          sandbox="allow-scripts allow-forms allow-popups allow-downloads"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  )
}

function isToolId(toolId: string): toolId is Exclude<ServiceId, 'athena'> {
  return toolId === 'oread' || toolId === 'syrinx' || toolId === 'mneme' || toolId === 'echo'
}
