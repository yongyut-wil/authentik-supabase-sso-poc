const DEFAULT_SUPABASE_URL = 'http://localhost:8000'

export function getSupabaseServerEnv() {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    DEFAULT_SUPABASE_URL

  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseAnonKey) {
    throw new Error(
      'Missing Supabase anon key. Set SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY) before starting the web app.'
    )
  }

  return {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
  }
}
