import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

  // NOTE: If VITE_ env vars are not set (e.g. not passed from Vite),
  // we might need to rely on standard process.env if injected or just assume they are available.
  // For Docker/Node environment without window injection, we can fallback to window.env

  return createBrowserClient(
    supabaseUrl || (window as any).env?.SUPABASE_URL,
    supabaseKey || (window as any).env?.SUPABASE_ANON_KEY
  )
}
