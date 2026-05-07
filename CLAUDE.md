# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

POC integrating self-hosted **Authentik** (IdP) with **Supabase GoTrue** via OIDC SSO. GoTrue v2 has no native `authentik` provider, so the project uses GoTrue's hardcoded `keycloak` provider and a **Caddy reverse proxy** (`oidc-proxy`) translates Keycloak-shaped paths (`/protocol/openid-connect/*`) into Authentik-shaped paths (`/application/o/*`). The frontend is a React Router v7 SSR app.

## Common Commands

Docker stack (run from repo root):
```bash
docker compose up -d                               # start all services
docker compose ps                                  # check health
docker compose up -d --force-recreate supabase-auth # reload GoTrue after .env changes
docker compose logs -f <service>                   # tail logs
```

Web app (run from `./web/`):
```bash
npm run dev        # Vite dev server (HMR)
npm run build      # production build
npm run start      # serve built app via @react-router/serve
npm run typecheck  # react-router typegen + tsc
```

There is no test runner configured in this repo.

## Service Topology (docker-compose.yml)

| Service | Port | Role |
|---|---|---|
| `authentik-server` / `-worker` / `-postgresql` / `-redis` | `9000`, `9443` | IdP — admin UI, OIDC endpoints |
| `supabase-db` | `5432` | Postgres with Supabase-prepared schemas (`auth`, roles `anon`/`service_role`/`authenticator`) |
| `supabase-auth` (GoTrue) | internal `9999` | Auth — configured with `GOTRUE_EXTERNAL_KEYCLOAK_*` pointing at `http://oidc-proxy` |
| `supabase-rest` (PostgREST) | internal `3000` | REST API |
| `supabase-kong` | `8000` | API Gateway, declarative config in `volumes/supabase/kong.yml` |
| `oidc-proxy` (Caddy) | internal `80` | Keycloak↔Authentik path rewriter |
| `web` | `3000` | React Router v7 SSR frontend |

GoTrue believes it is talking to Keycloak at `http://oidc-proxy`. Caddy intercepts each well-known Keycloak path and rewrites/proxies/redirects to Authentik. See `volumes/oidc-proxy/Caddyfile` for the exact mappings.

## Critical Constraints

These are tight couplings — breaking any of them silently breaks SSO:

1. **Authentik application slug MUST be `poc`.** `Caddyfile` hardcodes `/application/o/poc/.well-known/openid-configuration` and `/application/o/poc/jwks/`. If you rename the slug, update the Caddyfile too.
2. **Authentik OIDC provider redirect URI MUST be `http://localhost:8000/auth/v1/callback`** (the Kong gateway, not the web app).
3. **JWT keys in `.env` must match `volumes/supabase/kong.yml`.** Kong has the `anon` key declaratively pinned. Rotating `JWT_SECRET`/`SUPABASE_ANON_KEY` requires editing `kong.yml` in lockstep.
4. **`AUTHENTIK_CLIENT_ID` / `AUTHENTIK_CLIENT_SECRET` are populated by hand** after creating the provider in the Authentik UI; then `supabase-auth` must be force-recreated so it picks up new env vars.
5. **The `oidc-proxy` hostname only resolves inside the Docker network.** The browser cannot reach it. The redirect URL GoTrue returns to the browser may need rewriting to `http://localhost:9000/...` — see the SSR redirect handling in `web/app/routes/auth.login.tsx`.

## Web App Architecture (`web/`)

React Router v7 in **SSR mode** (`react-router.config.ts` → `ssr: true`). Routes are declared in `app/routes.ts` (file-based but explicit, not auto-discovered).

Auth flow files:
- `app/routes/auth.login.tsx` — email/password forms (server `action`) + SSO button (calls `signInWithOAuth({ provider: "keycloak" })` from the browser client).
- `app/routes/auth.callback.tsx` — receives `?code=...` from Authentik via Kong, calls `exchangeCodeForSession`.
- `app/routes/auth.logout.tsx` — `signOut()` and redirect.
- `app/routes/home.tsx` — gated loader; redirects unauthenticated users to `/auth/login`.

Supabase clients:
- `app/utils/supabase.server.ts` — SSR client. Reads `SUPABASE_URL` / `SUPABASE_ANON_KEY` from `process.env`. Uses hand-rolled cookie parse/serialize helpers because of the import quirk below.
- `app/utils/supabase.client.ts` — browser client. Reads `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

### `@supabase/ssr` 0.3 cookie adapter API

This project pins **`@supabase/ssr@^0.3.0`**, which uses the legacy per-cookie adapter (`get(name)` / `set(name, value, options)` / `remove(name, options)`) — not the `getAll`/`setAll` API introduced in 0.5+. Using the wrong shape silently no-ops: `signInWithOAuth` succeeds and returns a URL, but PKCE `code_verifier` is never written to cookies, so `exchangeCodeForSession` later fails with `pkce_code_verifier_not_found`.

If you bump the dependency to 0.5+, swap the adapter in `app/utils/supabase.server.ts` to `getAll`/`setAll`.

### `@supabase/ssr` import quirk

Vite SSR's CJS interop misbehaves with named imports from `@supabase/ssr`. Always use the namespace pattern with a `.default` fallback:

```ts
import * as supabaseSsr from '@supabase/ssr'
const supabaseSsrModule = supabaseSsr as any;
const createServerClient = supabaseSsrModule.createServerClient || supabaseSsrModule.default?.createServerClient;
```

Do not switch to `import { createServerClient } from '@supabase/ssr'` — it throws at runtime.

## Manual Setup Required Before SSO Works

The Authentik side is intentionally not pre-seeded. After `docker compose up -d`:

1. Visit `http://localhost:9000/if/flow/initial-setup/` to create the `akadmin` user.
2. Create an **OAuth2/OpenID Provider** named `poc-provider`, Client Type `Confidential`, Redirect URI `http://localhost:8000/auth/v1/callback`, scopes `email openid profile`.
3. Create an **Application** with slug `poc` bound to that provider.
4. Copy the generated Client ID/Secret into `.env` as `AUTHENTIK_CLIENT_ID` / `AUTHENTIK_CLIENT_SECRET`.
5. `docker compose up -d --force-recreate supabase-auth` to reload env.

Web app reachable at `http://localhost:3000`; Kong/auth at `http://localhost:8000`; Authentik UI at `http://localhost:9000`.

## Local Dev Environment Variables

The root `.env` is consumed by Docker Compose only. When running `npm run dev` from `web/`, Vite loads `web/.env` (which is gitignored and not committed). It needs **both** prefixed and unprefixed copies:

```
SUPABASE_URL=http://localhost:8000          # used by supabase.server.ts (process.env)
SUPABASE_ANON_KEY=<same as root .env>
VITE_SUPABASE_URL=http://localhost:8000     # used by supabase.client.ts (import.meta.env)
VITE_SUPABASE_ANON_KEY=<same as root .env>
```

Note the URL is `http://localhost:8000` (Kong's published port), not `http://supabase-kong:8000` (only resolvable inside Docker network).

## Dev Server Port Gotcha

`npm run dev` defaults to Vite's **port 5173**, but `GOTRUE_URI_ALLOW_LIST` in `docker-compose.yml` only whitelists `http://localhost:3000/**`. SSO from a dev server on 5173 fails because GoTrue rejects the `redirectTo`.

Either run the `web` Docker service (serves on 3000), start dev with `npm run dev -- --port 3000`, or extend `GOTRUE_URI_ALLOW_LIST` to include `http://localhost:5173/**` and force-recreate `supabase-auth`. The Docker `web` service uses `react-router-serve` (production) on 3000 — it does not run Vite/HMR.

## Known Failure Modes

- **GoTrue startup error `relation "flow_state" does not exist`** — migration `20221208132122` fails on newer Postgres due to UUID/text type comparison. Workaround: `INSERT INTO auth.schema_migrations (version) VALUES ('20221208132122');` inside `supabase-db`.
- **Authentik Postgres `exists but is not empty`** — `volumes/authentik/database/` was partially deleted (missing `postgresql.conf` / `PG_VERSION`). Empty the directory fully to allow `initdb` to re-run; this loses Authentik state.
- **Browser error `DNS Not Found oidc-proxy`** — the SSR redirect rewrite in `auth.login.tsx` failed; the browser was handed an internal Docker hostname.
- **Mailer SMTP errors in `supabase-auth` logs** — expected. `GOTRUE_MAILER_AUTOCONFIRM=true` is set, but failed login / password reset paths still try SMTP.
- **JWKS validation failure after Authentik login** — Authentik application slug isn't `poc`, so Caddy's `/application/o/poc/jwks/` rewrite returns 404.
- **`pkce_code_verifier_not_found` on `/auth/callback`** — IdP login succeeded but the verifier cookie was never set or never returned. Most common cause: cookie adapter shape doesn't match the installed `@supabase/ssr` version (see "0.3 cookie adapter API" above). Less common: the SSO action forgot to pass `headers` into `redirect(target, { headers })`, or the user cleared cookies mid-flow.
- **`Unable to exchange external code` (GoTrue 500)** — Authentik rejected the token exchange. Check `AUTHENTIK_CLIENT_SECRET` in `.env`, that `supabase-auth` was force-recreated after editing it, and that the Authentik provider's redirect URI is exactly `http://localhost:8000/auth/v1/callback`.
