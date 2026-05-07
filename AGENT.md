# Authentik + Supabase SSO POC Agent Guide

This file provides architectural context and instructions for maintaining or expanding the `authentik-supabase-sso-poc` repository.

## Overview
This project is a Proof of Concept (POC) demonstrating how to use Authentik as a self-hosted Identity Provider (IdP) for Supabase GoTrue Auth. Since GoTrue v2 does not have a native "authentik" provider, we use the `keycloak` provider as a workaround.

## Key Components

1. **Authentik Setup**: Provides standard OpenID Connect (OIDC) capabilities. Runs via `authentik-server`, `authentik-worker`, `authentik-postgresql`, and `authentik-redis`.
2. **Supabase Setup**: Minimal deployment using `supabase-db` (Postgres), `supabase-auth` (GoTrue), `supabase-rest` (PostgREST), and `supabase-kong` (API Gateway).
3. **Caddy OIDC-Proxy (`oidc-proxy`)**: The critical translation layer. GoTrue's Keycloak provider hardcodes paths like `/protocol/openid-connect/*`. The proxy catches these and forwards them to Authentik's `/application/o/*` paths.
4. **React Router v7 Web App (`web`)**: A custom frontend application. The SSO entry point is a **server action** (`intent=sso` in `app/routes/auth.login.tsx`):
   1. Calls `signInWithOAuth({ provider: "keycloak", skipBrowserRedirect: true })` server-side. This persists the PKCE `code_verifier` cookie via the SSR adapter.
   2. Server-side `fetch(data.url, { redirect: "manual" })` against GoTrue's authorize endpoint and reads the `Location` header. GoTrue tries to redirect the browser to the docker-internal `http://oidc-proxy/...` URL — we substitute the host for `process.env.AUTHENTIK_AUTHORIZE_URL` (defaults to `http://localhost:9000/application/o/authorize/`).
   3. Throws a `redirect(target, { headers })` so the browser receives a 302 with the IdP URL **and** the PKCE Set-Cookie header in the same response.
   4. After Authentik authenticates, the IdP redirects to `http://localhost:8000/auth/v1/callback` (Kong → GoTrue's external callback), GoTrue exchanges its code with Authentik via the `oidc-proxy` token endpoint, then redirects back to `http://localhost:3000/auth/callback?code=…`. `app/routes/auth.callback.tsx` calls `exchangeCodeForSession` which reads the verifier cookie.

## Critical Constraints to Maintain

* **Caddy Routing Context (`volumes/oidc-proxy/caddy.conf`)**:
  - Do NOT modify the `/protocol/openid-connect/` path mappings unless Authentik changes its OIDC specification.
  - The `certs` block explicitly proxies to `/application/o/poc/jwks/`. This implies the Authentik application slug MUST be strictly named `poc`. If you change the application slug, you must update the Caddy configuration.
* **Kong JWT Credentials (`volumes/supabase/kong.yml`)**:
  - The API Gateway is configured with `anon` and `service_role` consumers mapped to the JWTs in the `.env` file. If the `.env` keys change, `kong.yml` must be updated to match, otherwise GoTrue and PostgREST will reject requests.
* **Web App Dependencies**:
  - The web application utilizes standard, stable versions of React Router v7 and Vite. Do not introduce experimental or hallucinated package versions.
  - **`@supabase/ssr` is pinned at `^0.3.0`** in `web/package.json`. v0.3 expects the **legacy per-cookie adapter** (`get(name)` / `set(name, value, options)` / `remove(name, options)`). The `getAll` / `setAll` shape from v0.5+ silently no-ops on v0.3 — `signInWithOAuth` will succeed but never persist `code_verifier`, leading to `pkce_code_verifier_not_found` on the callback. If upgrading the library, switch the adapter shape in `app/utils/supabase.server.ts` at the same time.
  - **CJS/ESM interop quirk**: Vite SSR breaks named imports from `@supabase/ssr` at runtime. Always use namespace import (`import * as supabaseSsr from '@supabase/ssr'`) and fall back to `.default.createServerClient` if the named export is missing.
  - **The PKCE Set-Cookie must travel with the SSO redirect.** Always pass the `headers` returned by `createSupabaseServerClient` into the `redirect(target, { headers })` call in the SSO action — otherwise the browser never receives the verifier cookie and the callback fails.

## Known Quirks & Troubleshooting Insights

When debugging or extending the POC, keep these established behaviors in mind:

1. **GoTrue Migration Failure (`relation "flow_state" does not exist`)**:
   - Supabase GoTrue crashes during startup if it fails to run migrations. Migration `20221208132122` is known to fail when executed on newer Postgres versions due to UUID/text type comparison.
   - **Fix**: Manually bypass the migration using `INSERT INTO auth.schema_migrations (version) VALUES ('20221208132122');` inside the `supabase-db` container.
2. **Authentik Database Corruption (`exists but is not empty`)**:
   - If the `volumes/authentik/database` folder loses `postgresql.conf` or `PG_VERSION` (e.g., from cleanup scripts), `initdb` fails. The folder must be completely emptied to allow re-initialization. This results in the loss of the Authentik configuration.
3. **Authentik Admin Generation**:
   - The initial admin should be created via the web UI at `http://localhost:9000/if/flow/initial-setup/`.
   - Do NOT attempt to use non-existent commands like `ak add_admin_user`. If access is lost, generate a recovery link using: `docker exec -it ...authentik-worker-1 ak create_recovery_key 1 akadmin`.
4. **`pkce_code_verifier_not_found` on `/auth/callback`**:
   - The IdP login succeeded, but `exchangeCodeForSession` cannot find the verifier cookie. Check, in order: (a) the `@supabase/ssr` cookie adapter shape matches the installed version (see Web App Dependencies above); (b) the SSO action `throw redirect(target, { headers })` is passing the `headers` object — without it the Set-Cookie is dropped; (c) browser cookies for `localhost` weren't cleared mid-flow.
5. **`Unable to exchange external code` (GoTrue 500 in `supabase-auth` logs)**:
   - GoTrue couldn't swap Authentik's authorization code for a token. Usually means: (a) `AUTHENTIK_CLIENT_SECRET` in `.env` is stale and `supabase-auth` wasn't force-recreated; (b) Authentik provider's redirect URI is not exactly `http://localhost:8000/auth/v1/callback`; (c) the same code was reused (e.g., user double-clicked).
6. **Dev server port mismatch (`ERR_NAME_NOT_RESOLVED supabase-kong` or rejected redirect)**:
   - `npm run dev` defaults to port 5173, but `GOTRUE_URI_ALLOW_LIST` only whitelists `http://localhost:3000/**`. Run with `npm run dev -- --port 3000`, or stop the Docker `web` container if it conflicts. The Docker `web` container additionally has stale code until rebuilt — for active UI work, prefer the Vite dev server.
7. **Local dev needs `web/.env`**:
   - The root `.env` is consumed by Docker only. Vite reads `web/.env`. It must contain both `SUPABASE_URL` / `SUPABASE_ANON_KEY` (for `process.env` in `supabase.server.ts`) and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (for `import.meta.env` in `supabase.client.ts`). Use `http://localhost:8000` as the URL (Kong's published port), not `http://supabase-kong:8000` (only resolvable inside the Docker network).

## Additional Documentation

This project contains specific documentation files that should be updated as the system evolves:
- `README.md`: Setup instructions and architecture.

## Development Workflow

1. Start all services using `docker compose up -d`.
2. To test the frontend, you must first complete the manual Authentik setup (creating the provider and the application with the slug `poc`).
3. Add the generated `AUTHENTIK_CLIENT_ID` and `AUTHENTIK_CLIENT_SECRET` to the `.env` file.
4. Restart the auth service with `docker compose up -d --force-recreate supabase-auth`.
5. Access the Web App at `http://localhost:3000`.

## Testing the Changes
Ensure that you test:
1. Standard Email/Password Sign Up & Login.
2. The "Login with Authentik SSO" flow.
3. The successful redirect back to the `/` dashboard.
4. Logging out cleanly clears cookies.
