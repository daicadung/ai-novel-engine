import { NextRequest, NextResponse } from 'next/server'
import { getEnv, logger } from '@ai-novel-engine/config'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  logger.info('Health check requested', { requestId })

  let env;
  try {
    env = getEnv()
  } catch {
    const response = NextResponse.json({
      status: 'degraded',
      message: 'Environment configuration missing',
      dbStatus: 'down',
      env: {
        SUPABASE_URL_CONFIGURED: false,
        SUPABASE_PUBKEY_CONFIGURED: false,
        SERVICE_KEY_CONFIGURED: false,
      }
    }, { status: 200 })
    response.headers.set('x-request-id', requestId)
    return response
  }

  try {
    const supabase = await createClient()

    // Test DB connection
    const { error } = await supabase.from('profiles').select('id').limit(1)
    
    const dbStatus = error ? 'down' : 'up'

    const response = NextResponse.json({
      status: 'ok',
      dbStatus,
      env: {
        SUPABASE_URL_CONFIGURED: !!env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_PUBKEY_CONFIGURED: !!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        SERVICE_KEY_CONFIGURED: !!(env as Record<string, string>).SUPABASE_SERVICE_ROLE_KEY, // internal validation check
      }
    })
    response.headers.set('x-request-id', requestId)
    return response
  } catch (err) {
    logger.error('Health check failed', { 
      error: err instanceof Error ? err.message : String(err),
      requestId 
    })
    const response = NextResponse.json({ status: 'error', message: 'Service unavailable' }, { status: 503 })
    response.headers.set('x-request-id', requestId)
    return response
  }
}
