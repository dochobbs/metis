import { describe, expect, it } from 'vitest'
import {
  getAuthHeaders,
  getServiceApiPath,
  getServiceAppPath,
  serviceConfigs,
} from './metisApi'

describe('metis API gateway helpers', () => {
  it('builds same-origin API paths for service health checks', () => {
    expect(getServiceApiPath('athena', '/health')).toBe('/api/athena/health')
    expect(getServiceApiPath('echo', '/health')).toBe('/api/echo/health')
    expect(getServiceApiPath('oread', '/')).toBe('/api/oread/')
  })

  it('builds same-origin app paths for embedded tools', () => {
    expect(getServiceAppPath('mneme')).toBe('/apps/mneme/')
    expect(getServiceAppPath('echo')).toBe('/apps/echo/')
    expect(serviceConfigs.echo.uiPort).toBe(9101)
  })

  it('adds bearer authorization when a Supabase session is present', () => {
    const headers = getAuthHeaders({
      access_token: 'jwt-token',
      user: { id: 'user-123' },
    })

    expect(headers.Authorization).toBe('Bearer jwt-token')
    expect(headers['X-Metis-User']).toBe('user-123')
  })

  it('does not add authorization headers without a session', () => {
    expect(getAuthHeaders(null)).toEqual({})
  })
})
