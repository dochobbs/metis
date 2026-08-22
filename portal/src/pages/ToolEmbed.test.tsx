// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ToolEmbed from './ToolEmbed'

vi.mock('../lib/supabase', () => ({
  isAuthRequired: () => false,
  supabase: null,
}))

function renderTool(toolId: string) {
  return render(
    <MemoryRouter initialEntries={[`/tool/${toolId}`]}>
      <Routes>
        <Route path="/tool/:toolId" element={<ToolEmbed session={null} />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ToolEmbed iframe gateway regression', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true } as Response)
    )
  })

  it.each(['oread', 'syrinx', 'mneme', 'echo'])(
    'embeds %s through the same-origin /apps path, not localhost',
    async (toolId) => {
      const { container } = renderTool(toolId)
      await waitFor(() => {
        const iframe = container.querySelector('iframe')
        expect(iframe).not.toBeNull()
        expect(iframe?.getAttribute('src')).toBe(`/apps/${toolId}/`)
        expect(iframe?.getAttribute('src')).not.toContain('localhost')
      })
    }
  )
})
