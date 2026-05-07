import * as supabaseSsr from '@supabase/ssr'

// Handle CommonJS / ESM default export interop for Vite SSR
const createServerClient = supabaseSsr.createServerClient || (supabaseSsr as any).default?.createServerClient;
const parseCookieHeader = supabaseSsr.parseCookieHeader || (supabaseSsr as any).default?.parseCookieHeader;
const serializeCookieHeader = supabaseSsr.serializeCookieHeader || (supabaseSsr as any).default?.serializeCookieHeader;

export function createSupabaseServerClient(request: Request) {
  const headers = new Headers()

  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_ANON_KEY!

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        const cookies = parseCookieHeader(request.headers.get('Cookie') ?? '')
        return cookies.map((c: any) => ({ name: c.name, value: c.value ?? '' }))
      },
      setAll(cookiesToSet: any[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          headers.append('Set-Cookie', serializeCookieHeader(name, value, options))
        )
      },
    },
  })

  return { supabase, headers }
}
