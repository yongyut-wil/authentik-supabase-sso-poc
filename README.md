# Authentik + Supabase SSO POC

POC ใช้ **Authentik** เป็น Identity Provider ให้กับ **Supabase Auth (GoTrue)** ผ่าน OIDC แบบ self-hosted ทั้งหมด ไม่พึ่งระบบ cloud ภายนอก

GoTrue v2 ไม่มี `authentik` provider ในตัว — โปรเจกต์นี้แก้โดยใช้ provider ชนิด `keycloak` ของ GoTrue และวาง **Caddy** (`oidc-proxy`) ไว้ตรงกลางเพื่อแปลง path จากรูปแบบ Keycloak ไปเป็นของ Authentik

## Architecture

```mermaid
flowchart TB
  B([Browser])
  W[web :3000]
  K[Kong + GoTrue :8000]
  A[Authentik :9000]

  B  -->|1. กด SSO| W
  W  -->|2. 302 + Set-Cookie<br/>rewrite host| B
  B  -->|3. /application/o/authorize| A
  A  -->|4. login + consent → 302| B
  B  -->|5. /auth/v1/callback?code| K
  K  -.6. token exchange<br/>via oidc-proxy.-> A
  K  -->|7. 302 → /auth/callback?code| B
  B  -->|8. GET /auth/callback (cookie)| W
  W  -->|9. exchangeCodeForSession| K
  K  -->|10. session| W
  W  -->|11. 302 → /| B
```

> Caddy `oidc-proxy` ทำหน้าที่เฉพาะแปลง path ระหว่าง GoTrue กับ Authentik (ขั้นที่ 6) ไม่ปรากฏในเส้นทางที่ browser มองเห็น

Services ทั้งหมดรันด้วย Docker Compose:

| Service | Port (host) | หน้าที่ |
| --- | --- | --- |
| `authentik-server` / `worker` / `postgresql` / `redis` | `9000` | IdP |
| `supabase-db` | `5432` | Postgres ที่มี schema `auth` พร้อมใช้ |
| `supabase-auth` (GoTrue) | — | Auth API |
| `supabase-rest` (PostgREST) | — | REST API |
| `supabase-kong` | `8000` | API Gateway |
| `oidc-proxy` (Caddy) | — | แปลง path Keycloak ↔ Authentik |
| `web` | `3000` | React Router v7 SSR |

## Prerequisites

- Docker + Docker Compose (Docker Desktop, OrbStack, หรือ Docker Engine)
- Git

> Node.js ต้องมีเฉพาะตอนพัฒนา UI ฝั่ง host (ดู [Local Development](#local-development)) — รัน POC end-to-end ใช้แค่ Docker

## Quick Start

### 1. เริ่มต้น services

```bash
git clone <repository_url>
cd authentik-supabase-sso-poc
cp .env.example .env
docker compose up -d
```

ครั้งแรกใช้เวลา 1–3 นาทีให้ image โหลด + healthcheck ผ่าน ตรวจสถานะด้วย `docker compose ps` รอจนทุกตัวขึ้น `healthy` หรือ `Up`

### 2. ตั้งค่า Authentik admin

1. เปิด `http://localhost:9000/if/flow/initial-setup/`
2. ตั้งรหัสผ่านให้ user `akadmin` (อีเมลใส่อะไรก็ได้)
3. หลัง redirect กลับ Home คลิก **Admin Interface** มุมขวาบน

### 3. สร้าง OIDC Provider + Application

ที่ Admin Interface → **Applications > Providers** → **Create** → **OAuth2/OpenID Provider**

- **Name**: `poc-provider`
- **Authorization flow**: `default-provider-authorization-explicit-consent`
- **Client Type**: `Confidential`
- **Client ID / Secret**: คัดลอกเก็บไว้
- **Redirect URIs/Origins (RegEx)**: `http://localhost:8000/auth/v1/callback` *(ต้องตรงเป๊ะ)*
- **Advanced protocol settings → Scopes**: เพิ่ม `email`, `openid`, `profile`

จากนั้น **Applications > Applications** → **Create**

- **Name**: `POC App`
- **Slug**: `poc` *(❗ ต้องเป็นชื่อนี้เท่านั้น — Caddy hardcode `/application/o/poc/jwks/` ไว้)*
- **Provider**: `poc-provider`

### 4. ใส่ credentials กลับเข้า GoTrue

แก้ `.env` ใส่ค่าที่ copy ไว้ในขั้นที่ 3:

```env
AUTHENTIK_CLIENT_ID=...
AUTHENTIK_CLIENT_SECRET=...
```

แล้ว recreate container เพื่อโหลด env ใหม่:

```bash
docker compose up -d --force-recreate supabase-auth
```

### 5. ทดสอบ

1. เปิด `http://localhost:3000` → ระบบจะ redirect ไป `/auth/login`
2. ทดสอบได้ 2 ทาง:
   - **Email/Password**: กรอกอีเมล + รหัสผ่าน กด **Create Account** (ตั้ง `GOTRUE_MAILER_AUTOCONFIRM=true` ไว้ login ทันทีโดยไม่ต้องยืนยันอีเมล)
   - **SSO**: คลิก **Sign in with Authentik** → login `akadmin` ที่ Authentik → กด **Continue** ยอมรับ consent → กลับมาที่ Dashboard
3. กด **Sign Out** เพื่อลบ session

## How It Works

### Caddy oidc-proxy แปลง path Keycloak ↔ Authentik

GoTrue hardcode ว่า provider ชนิด Keycloak ต้องคุยผ่าน `/protocol/openid-connect/*` ส่วน Authentik ใช้ `/application/o/*` เลยใส่ Caddy ขั้นกลางใน `volumes/oidc-proxy/Caddyfile`:

| Endpoint ที่ GoTrue ขอ | Caddy ทำอะไร |
| --- | --- |
| `/.well-known/openid-configuration` | rewrite → `/application/o/poc/.well-known/...` |
| `/protocol/openid-connect/auth` | redirect 302 → `/application/o/authorize/` (เติม scope ให้ครบ) |
| `/protocol/openid-connect/token` | rewrite → `/application/o/token/` |
| `/protocol/openid-connect/userinfo` | rewrite → `/application/o/userinfo/` |
| `/protocol/openid-connect/certs` | rewrite → `/application/o/poc/jwks/` |

### Server-side rewrite ฝั่ง web app

`oidc-proxy` และ `supabase-kong` เป็น hostname ภายในเครือข่าย Docker — browser ของ user resolve ไม่ออก ปุ่ม **Sign in with Authentik** จึง POST ไปยัง server action ของ `app/routes/auth.login.tsx` (intent=`sso`) แทนการเรียก `signInWithOAuth` ฝั่ง browser ตรงๆ ขั้นตอนภายใน:

1. เรียก `supabase.auth.signInWithOAuth({ provider: "keycloak", skipBrowserRedirect: true })` ฝั่ง server เพื่อให้ supabase-js สร้าง PKCE `code_verifier` และเก็บลง cookie ผ่าน adapter ของ `@supabase/ssr`
2. Server `fetch(data.url, { redirect: "manual" })` ไปยัง GoTrue authorize endpoint แล้วอ่าน `Location` header ที่ชี้ไปยัง `http://oidc-proxy/protocol/openid-connect/auth?...`
3. แทนที่ host ด้วย `process.env.AUTHENTIK_AUTHORIZE_URL` (default `http://localhost:9000/application/o/authorize/`) คง query string เดิมไว้
4. `throw redirect(target, { headers })` — Browser ได้ 302 พร้อม `Set-Cookie` PKCE verifier ใน response เดียวกัน

ขากลับ: Authentik → Kong (`/auth/v1/callback`) → GoTrue แลก token กับ Authentik ผ่าน `oidc-proxy` → redirect ไป `/auth/callback?code=...` → `auth.callback.tsx` เรียก `exchangeCodeForSession` อ่าน cookie → ได้ session

### ทำไม Supabase รันแล้วใช้ได้เลย

- **`supabase/postgres` image** มี schema `auth` (สำหรับ GoTrue) และ role `authenticator` / `anon` / `service_role` เตรียมไว้แล้ว — ไม่ต้องรัน migration เอง
- **Kong** ผูก `anon` / `service_role` keys แบบ static ใน `volumes/supabase/kong.yml` (คีย์ถูก random ไว้ใน `.env.example`) ไม่ต้องตั้ง DB เพิ่ม
- **OIDC SSO** ใช้แค่ env vars (`AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET`) เข้า container `supabase-auth` ก็เปิดใช้ได้

> ถ้าจะเอาไปใช้ production ต้องสร้าง JWT secret + anon/service-role keys ชุดใหม่เพื่อความปลอดภัย — สำหรับ POC ทุกอย่างพร้อมใช้

## Local Development

Container `web` ใน `docker-compose.yml` รัน production build (`react-router-serve`) บน port 3000 — เหมาะ demo ไม่เหมาะแก้ UI เพราะต้อง rebuild ทุกครั้ง

สำหรับการพัฒนาให้รัน Vite dev server บน host:

1. หยุด container `web` เพื่อปลด port:
   ```bash
   docker compose stop web
   ```
2. สร้างไฟล์ `web/.env` (gitignored — root `.env` ใช้กับ Docker เท่านั้น Vite ไม่อ่าน):
   ```env
   SUPABASE_URL=http://localhost:8000
   SUPABASE_ANON_KEY=<ค่าจาก root .env>
   AUTHENTIK_AUTHORIZE_URL=http://localhost:9000/application/o/authorize/
   VITE_SUPABASE_URL=http://localhost:8000
   VITE_SUPABASE_ANON_KEY=<ค่าจาก root .env>
   ```
   > URL ต้องเป็น `localhost:8000` (Kong's published port) ไม่ใช่ `supabase-kong:8000` (resolve ได้เฉพาะใน Docker network) ส่วน `VITE_` prefix จำเป็นเพราะ Vite expose ตัวที่ขึ้นต้นด้วย `VITE_` ไปฝั่ง browser เท่านั้น
3. รัน dev server บน port 3000 ให้ตรงกับ `GOTRUE_URI_ALLOW_LIST`:
   ```bash
   cd web
   npm run dev -- --port 3000
   ```

> รายละเอียด failure modes สำหรับนักพัฒนา (PKCE, cookie adapter mismatch, `Unable to exchange external code`) ดูที่ [`AGENT.md`](./AGENT.md) และ [`CLAUDE.md`](./CLAUDE.md)

## Troubleshooting

- **Authentik login ผ่าน แต่กลับมา Supabase แล้ว error เกี่ยว JWKS** — เช็คว่า application slug บน Authentik เป็น `poc` หรือไม่ (Caddy hardcode path `/application/o/poc/jwks/`)
- **Browser ขึ้น `ERR_NAME_NOT_RESOLVED oidc-proxy` หรือ `supabase-kong`** — Server-side rewrite ใน `app/routes/auth.login.tsx` ไม่ทำงาน หรือ container `web` รันโค้ดเก่า ลอง `docker compose build web && docker compose up -d web` หรือสลับมาใช้ dev server ตามขั้นตอน [Local Development](#local-development)
- **GoTrue แสดง Mailer error ใน docker log** — เป็น noise ปกติของ POC: `GOTRUE_MAILER_AUTOCONFIRM=true` ทำให้ signup ไม่ต้องส่งอีเมล แต่ login ผิด/reset password ยังพยายามต่อ SMTP และ fail
- **กด SSO แล้ว Authentik แจ้ง redirect URI ไม่ตรง** — Provider ใน Authentik ต้องตั้ง redirect URI เป็น `http://localhost:8000/auth/v1/callback` ตรงๆ และ web app ต้องเข้าผ่าน port 3000 (ทั้ง Docker และ dev server)
