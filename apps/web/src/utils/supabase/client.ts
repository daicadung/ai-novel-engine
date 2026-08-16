import { createBrowserClient } from '@supabase/ssr'
import { getEnv } from '@ai-novel-engine/config'

export function createClient() {
  const env = getEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
}
