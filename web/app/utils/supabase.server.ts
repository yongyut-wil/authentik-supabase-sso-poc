import * as supabaseSsr from '@supabase/ssr'
import { getSupabaseServerEnv } from './supabase.env.server'

// Handle CommonJS / ESM default export interop for Vite SSR
const supabaseSsrModule = supabaseSsr as any
const createServerClient =
  supabaseSsrModule.createServerClient ||
  supabaseSsrModule.default?.createServerClient

function parseCookies(cookieHeader: string) {
  if (!cookieHeader) {
    return [] as { name: string; value: string }[]
  }

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf('=')

      if (separatorIndex < 0) {
        return { name: part, value: '' }
      }

      const name = decodeURIComponent(part.slice(0, separatorIndex).trim())
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim())

      return { name, value }
    })
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    domain?: string
    expires?: string | Date
    httpOnly?: boolean
    maxAge?: number
    path?: string
    sameSite?: 'lax' | 'strict' | 'none' | boolean
    secure?: boolean
  } = {}
) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`]

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`)
  }

  parts.push(`Path=${options.path ?? '/'}`)

  if (options.expires) {
    const expires =
      options.expires instanceof Date
        ? options.expires.toUTCString()
        : options.expires
    parts.push(`Expires=${expires}`)
  }

  if (options.httpOnly) {
    parts.push('HttpOnly')
  }

  if (options.secure) {
    parts.push('Secure')
  }

  if (options.sameSite) {
    const sameSite =
      options.sameSite === true
        ? 'Lax'
        : `${options.sameSite}`.charAt(0).toUpperCase() +
          `${options.sameSite}`.slice(1)
    parts.push(`SameSite=${sameSite}`)
  }

  return parts.join('; ')
}

export function createSupabaseServerClient(request: Request) {
  const headers = new Headers()
  const { SUPABASE_URL: supabaseUrl, SUPABASE_ANON_KEY: supabaseKey } =
    getSupabaseServerEnv()

  // @supabase/ssr v0.3 uses the per-cookie adapter, not getAll/setAll.
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        const cookies = parseCookies(request.headers.get('Cookie') ?? '')
        return cookies.find((cookie) => cookie.name === name)?.value
      },
      set(name: string, value: string, options: any) {
        headers.append('Set-Cookie', serializeCookie(name, value, options))
      },
      remove(name: string, options: any) {
        headers.append(
          'Set-Cookie',
          serializeCookie(name, '', { ...options, maxAge: 0 })
        )
      },
    },
  })

  return { supabase, headers }
}
