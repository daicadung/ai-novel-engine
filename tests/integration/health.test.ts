import { describe, it, expect, vi } from 'vitest'
import { GET } from '../../apps/web/src/app/api/health/route'
import { getEnv, resetEnv } from '@ai-novel-engine/config'
import * as serverUtils from '../../apps/web/src/utils/supabase/server'

// Mock environment and Supabase client
vi.mock('@ai-novel-engine/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-novel-engine/config')>()
  return {
    ...actual,
    getEnv: vi.fn(),
  }
})

vi.mock('../../apps/web/src/utils/supabase/server', () => {
  return {
    createClient: vi.fn(),
  }
})

import { NextRequest } from 'next/server'

describe('Health Endpoint', () => {
  it('returns ok, assigns request id, and does not expose secrets', async () => {
    vi.mocked(getEnv).mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'pub-key',
      SUPABASE_SERVICE_ROLE_KEY: 'secret',
    } as any)

    vi.mocked(serverUtils.createClient).mockResolvedValue({
      from: () => ({
        select: () => ({
          limit: () => ({ error: null })
        })
      })
    } as any)

    const req = new NextRequest('http://localhost/api/health', {
      headers: new Headers({ 'x-request-id': 'test-req-123' })
    })

    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('test-req-123')
    expect(data.status).toBe('ok')
    expect(data.dbStatus).toBe('up')
    expect(data.env.SUPABASE_URL_CONFIGURED).toBe(true)
    expect(data.env.SERVICE_KEY_CONFIGURED).toBe(true)
    // Ensure secrets are not in the response payload directly
    expect(data.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined()
  })

  it('generates a new request id if none is provided', async () => {
    vi.mocked(getEnv).mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'pub-key',
      SUPABASE_SERVICE_ROLE_KEY: 'secret',
    } as any)

    vi.mocked(serverUtils.createClient).mockResolvedValue({
      from: () => ({
        select: () => ({
          limit: () => ({ error: null })
        })
      })
    } as any)

    const req = new NextRequest('http://localhost/api/health')
    const response = await GET(req)
    
    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBeDefined()
    expect(response.headers.get('x-request-id')?.length).toBeGreaterThan(0)
  })
})
