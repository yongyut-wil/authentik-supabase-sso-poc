# Authentik + Supabase SSO POC Agent Guide

This file provides architectural context and instructions for maintaining or expanding the `authentik-supabase-sso-poc` repository.

## Overview
This project is a Proof of Concept (POC) demonstrating how to use Authentik as a self-hosted Identity Provider (IdP) for Supabase GoTrue Auth. Since GoTrue v2 does not have a native "authentik" provider, we use the `keycloak` provider as a workaround.

## Key Components

1. **Authentik Setup**: Provides standard OpenID Connect (OIDC) capabilities. Runs via `authentik-server`, `authentik-worker`, `authentik-postgresql`, and `authentik-redis`.
2. **Supabase Setup**: Minimal deployment using `supabase-db` (Postgres), `supabase-auth` (GoTrue), `supabase-rest` (PostgREST), and `supabase-kong` (API Gateway).
3. **Caddy OIDC-Proxy (`oidc-proxy`)**: The critical translation layer. GoTrue's Keycloak provider hardcodes paths like `/protocol/openid-connect/*`. The proxy catches these and forwards them to Authentik's `/application/o/*` paths.
4. **React Router v7 Web App (`web`)**: A custom frontend application. It handles the manual redirect hack: GoTrue initially redirects to the docker-internal `http://oidc-proxy/...` URL, which the browser cannot resolve. The SSR backend intercepts this, replaces the hostname with `localhost:9000`, and then redirects the browser.

## Critical Constraints to Maintain

* **Caddy Routing Context (`volumes/oidc-proxy/caddy.conf`)**:
  - Do NOT modify the `/protocol/openid-connect/` path mappings unless Authentik changes its OIDC specification.
  - The `certs` block explicitly proxies to `/application/o/poc/jwks/`. This implies the Authentik application slug MUST be strictly named `poc`. If you change the application slug, you must update the Caddy configuration.
* **Kong JWT Credentials (`volumes/supabase/kong.yml`)**:
  - The API Gateway is configured with `anon` and `service_role` consumers mapped to the JWTs in the `.env` file. If the `.env` keys change, `kong.yml` must be updated to match, otherwise GoTrue and PostgREST will reject requests.
* **Web App Dependencies**:
  - The web application utilizes standard, stable versions of React Router v7 and Vite. Do not introduce experimental or hallucinated package versions.
  - The `@supabase/ssr` library handles cookie parsing and serialization for SSR.

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
