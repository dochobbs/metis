export type ServiceId = 'athena' | 'oread' | 'syrinx' | 'mneme' | 'echo'

export interface AuthSession {
  access_token: string
  user: {
    id: string
  }
}

export interface ServiceConfig {
  name: string
  id: ServiceId
  greekName: string
  port: number
  uiPort: number
  color: string
  description: string
}

export const serviceConfigs: Record<ServiceId, ServiceConfig> = {
  athena: {
    name: 'Athena',
    id: 'athena',
    greekName: 'athena',
    port: 9105,
    uiPort: 9105,
    color: 'indigo',
    description: 'Curriculum & Knowledge',
  },
  oread: {
    name: 'Oread',
    id: 'oread',
    greekName: 'synpat',
    port: 9104,
    uiPort: 9104,
    color: 'emerald',
    description: 'Synthetic Patient Generator',
  },
  syrinx: {
    name: 'Syrinx',
    id: 'syrinx',
    greekName: 'synvoice',
    port: 9103,
    uiPort: 9103,
    color: 'violet',
    description: 'Encounter Script Generator',
  },
  mneme: {
    name: 'Mneme',
    id: 'mneme',
    greekName: 'synchart',
    port: 9102,
    uiPort: 5173,
    color: 'amber',
    description: 'EMR Chart Review',
  },
  echo: {
    name: 'Echo',
    id: 'echo',
    greekName: 'echo',
    port: 9101,
    uiPort: 9101,
    color: 'cyan',
    description: 'AI Attending Tutor',
  },
}

export const orderedServices: ServiceConfig[] = [
  serviceConfigs.athena,
  serviceConfigs.oread,
  serviceConfigs.syrinx,
  serviceConfigs.mneme,
  serviceConfigs.echo,
]

export function getServiceApiPath(serviceId: ServiceId, path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `/api/${serviceId}${normalizedPath}`
}

export function getServiceAppPath(serviceId: Exclude<ServiceId, 'athena'>, path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `/apps/${serviceId}${normalizedPath}`
}

export function getAuthHeaders(session: AuthSession | null): Record<string, string> {
  if (!session?.access_token) return {}

  return {
    Authorization: `Bearer ${session.access_token}`,
    'X-Metis-User': session.user.id,
  }
}

export function getJsonHeaders(session: AuthSession | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...getAuthHeaders(session),
  }
}
