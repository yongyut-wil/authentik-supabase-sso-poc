# Authentik + Supabase SSO POC (Minimal & Self-hosted)

โปรเจกต์นี้คือ Proof of Concept (POC) สำหรับการใช้งาน Supabase (GoTrue) ร่วมกับ Authentik เป็น Identity Provider (IdP) แบบ Self-hosted อย่างสมบูรณ์ผ่าน Single Sign-On (SSO) โดยไม่ต้องเชื่อมต่อกับระบบภายนอกอื่นๆ

เนื่องจาก GoTrue v2 ไม่มี "authentik" provider อยู่ในตัวเอง โปรเจกต์นี้จึงใช้ Workaround โดยใช้ Keycloak provider ของ GoTrue แทน และใช้ **Caddy** เป็น Reverse Proxy (`oidc-proxy`) เพื่อทำการเปลี่ยน Paths (Rewrite paths) จาก Keycloak format ไปยัง Authentik format ได้อย่างยืดหยุ่นและปลอดภัย

## สถาปัตยกรรม (Architecture)
โปรเจกต์นี้ใช้ Docker Compose ในการรัน Services หลักดังนี้:
1. **Authentik**: IdP (PostgreSQL, Redis, Server, Worker)
2. **Supabase**: Auth, Database, Rest API, Kong Gateway
3. **Caddy oidc-proxy**: แปลง HTTP Requests ของ OIDC จาก `/protocol/openid-connect/*` ไปเป็น `/application/o/*` ของ Authentik
4. **Web App**: React Router v7 SSR สำหรับการทำ Frontend

---

## Prerequisites (สิ่งที่ต้องมี)
- **Docker และ Docker Compose** (เช่น Docker Desktop, OrbStack หรือ Docker Engine บน Linux)
- **Node.js (v18 หรือ v20 ขึ้นไป)** (ในกรณีที่คุณต้องการรัน Web App สำหรับการแก้ไขโค้ดเพิ่มเติมภายนอก Docker แต่ปกติ Docker จะจัดการให้ทั้งหมดแล้ว)
- **Git** สำหรับ Clone โปรเจกต์

---

## ขั้นตอนการติดตั้งและการใช้งานแบบละเอียด (Step-by-Step Instructions)

### 1. การเริ่มต้นโปรเจกต์ (Clone & Start)

1. ทำการ Clone โปรเจกต์ และเข้าไปในโฟลเดอร์:
   ```bash
   git clone <repository_url>
   cd authentik-supabase-sso-poc
   ```

2. เนื่องจากรหัส JWT Secret และ Anon Keys ถูกจัดเตรียมไว้ในไฟล์ `.env.example` ให้ทำการคัดลอกเป็นไฟล์ `.env`:
   ```bash
   cp .env.example .env
   ```

3. เริ่มต้นทุก Services ด้วย Docker Compose:
   ```bash
   docker compose up -d
   ```
   > ⏳ **หมายเหตุ**: อาจใช้เวลาประมาณ 1-3 นาทีในการดาวน์โหลด Image และรอให้ Container เริ่มทำงาน โดยเฉพาะ `authentik-postgresql` และ `authentik-redis` ที่ต้องรอให้ Healthcheck ผ่านเสียก่อน

4. ตรวจสอบสถานะการทำงานด้วยคำสั่ง:
   ```bash
   docker compose ps
   ```
   รอจนกว่าทุก Container จะขึ้นสถานะ `healthy` หรือ `Up`

### 2. ตั้งค่า Authentik เริ่มต้น (Initial Setup)

เนื่องจาก POC นี้เป็นการรัน Authentik ใหม่ทั้งหมด คุณจำเป็นต้องทำการตั้งค่า Admin เริ่มต้นบนเบราว์เซอร์:

1. เปิด Browser ไปที่ `http://localhost:9000/if/flow/initial-setup/`
2. ระบบจะแจ้งให้คุณสร้างรหัสผ่านสำหรับบัญชีผู้ดูแลระบบ (Username คือ `akadmin` ส่วนอีเมลให้ใส่อะไรก็ได้ เช่น `admin@example.com`)
3. หลังจากตั้งรหัสผ่านเสร็จ คุณจะถูกพากลับมาที่หน้า Home ให้คลิกปุ่ม **"Admin Interface"** ที่มุมขวาบน เพื่อเข้าสู่หน้าจัดการ

### 3. สร้าง Application และ OIDC Provider บน Authentik

นี่คือขั้นตอนที่สำคัญที่สุดในการเชื่อม Authentik เข้ากับ Supabase (GoTrue) ผ่านการจำลองเป็น Keycloak:

1. ในเมนูฝั่งซ้ายของ Admin Interface ไปที่ **Applications > Providers**
2. คลิกปุ่ม **Create** เลือก **OAuth2/OpenID Provider** แล้วกด Next
   - **Name**: กรอก `poc-provider`
   - **Authorization flow**: เลือก `default-provider-authorization-explicit-consent`
   - **Client Type**: เปลี่ยนจาก `Public` เป็น `Confidential`
   - **Client ID**: (คัดลอกค่านี้เก็บไว้ชั่วคราว)
   - **Client Secret**: (คัดลอกค่านี้เก็บไว้ชั่วคราว)
   - **Redirect URIs/Origins (RegEx)**: สำคัญมาก! ให้ระบุเป็น `http://localhost:8000/auth/v1/callback`
   - ขยายเมนู **Advanced protocol settings** เลื่อนลงมาที่ Scopes กดเลือก: `email`, `openid`, และ `profile`
   - กด **Finish** เพื่อบันทึก
3. ไปที่เมนู **Applications > Applications**
   - คลิกปุ่ม **Create**
   - **Name**: กรอก `POC App`
   - **Slug**: กรอก `poc`  *(❗ สำคัญมาก: ต้องใช้ชื่อนี้เท่านั้น เนื่องจาก Caddy ถูกเขียนให้เชื่อมโยงดึงค่า JWKS certs จาก URL `/application/o/poc/jwks/`)*
   - **Provider**: เลือก `poc-provider` ที่เราเพิ่งสร้างขึ้น
   - กด **Create**

### 4. อัพเดท Credentials กลับเข้าสู่ระบบ

เมื่อได้รหัสจาก Authentik มาแล้ว ต้องนำมาใส่ให้ GoTrue รู้จัก:

1. เปิดไฟล์ `.env` ด้วย Text Editor
2. นำ Client ID และ Client Secret มาใส่ให้ครบถ้วน:
   ```env
   AUTHENTIK_CLIENT_ID=กรอกค่า_Client_ID_ที่ก๊อปปี้มา
   AUTHENTIK_CLIENT_SECRET=กรอกค่า_Client_Secret_ที่ก๊อปปี้มา
   ```
3. บังคับให้ GoTrue (Supabase Auth) เริ่มทำงานใหม่เพื่อให้มันอ่านไฟล์ `.env` ล่าสุด:
   ```bash
   docker compose up -d --force-recreate supabase-auth
   ```

### 5. ทดสอบการเข้าสู่ระบบผ่าน Web App

เมื่อระบบพร้อมหมดแล้ว ทดสอบ Frontend Application:

1. เปิด Browser ไปที่ `http://localhost:3000`
2. ระบบตรวจสอบว่ายังไม่ได้ล็อกอิน จึง Redirect ไปที่ `http://localhost:3000/auth/login`
3. ในหน้านี้จะมีสองตัวเลือก:
   - **ทดสอบ Email/Password ปกติ**: ลองกรอกอีเมล/รหัสผ่าน แล้วกด **"Sign Up"** จากนั้นจะล็อกอินอัตโนมัติ (เนื่องจากตั้งค่าไว้เป็น Autoconfirm)
   - **ทดสอบ SSO**: คลิกปุ่ม **"Login with Authentik SSO"** สีส้มด้านล่าง
4. เมื่อกด SSO เบราว์เซอร์จะพาไปที่หน้าของ Authentik (พอร์ต 9000) ให้ล็อกอินด้วยผู้ใช้ `akadmin` (และรหัสผ่านที่คุณตั้งไว้)
5. กดปุ่ม `Continue` เพื่อกดยอมรับ Consent
6. หลังจากสำเร็จ ระบบจะ Redirect กลับมาที่ `http://localhost:3000` (หน้า Dashboard) พร้อมแสดงอีเมลของคุณ
7. ลองกดปุ่ม **Logout** เพื่อลบ Session

---

## ข้อมูลเพิ่มเติมสำหรับนักพัฒนา (Developer Notes)

### 1. การทำงานของ Caddy (Reverse Proxy สำหรับ OIDC)

Supabase (GoTrue) ฝัง Hardcode มาว่าเมื่อใช้งาน Provider ชนิด Keycloak จะต้องเรียกใช้ Endpoint ในรูปแบบ `/protocol/openid-connect/*` เสมอ ซึ่งต่างจาก Authentik ที่ใช้ URL เริ่มต้นด้วย `/application/o/*` เราจึงแก้ปัญหานี้โดยการใช้ **Caddy** (Service: `oidc-proxy`) ทำหน้าที่รับ Request และแปลง Path ให้ถูกต้อง:

- **OIDC Discovery (`/.well-known/openid-configuration`)**: Caddy จะจับ Request นี้และทำการ Rewrite ให้ชี้ไปยัง Discovery URL ของแอปพลิเคชัน Authentik ที่ชื่อว่า `poc`
- **Authorization Endpoint (`/protocol/openid-connect/auth`)**: เมื่อมีการร้องขอให้ล็อกอิน Caddy จะแทรก Scopes `openid profile email` เข้าไปใน Request แล้วสั่งให้เบราว์เซอร์ **Redirect (302)** ไปยังหน้าล็อกอินของ Authentik แทน
- **Token & UserInfo Endpoints**: Caddy จะรับ Request (POST/GET) แล้ว Rewrite ส่งผ่าน (Proxy Pass) ไปให้ Authentik โดยซ่อนกระบวนการทั้งหมดไว้เบื้องหลัง (GoTrue จะไม่ทราบเลยว่ากำลังคุยกับ Authentik)
- **Certs (JWKS)**: เมื่อ GoTrue ขอ Public Keys สำหรับยืนยัน Token (`/protocol/openid-connect/certs`) Caddy จะแปลง Path กลับไปที่ `/application/o/poc/jwks/` เพื่อให้สามารถตรวจสอบความถูกต้องของลายเซ็นได้อย่างสมบูรณ์

### 2. Server-Side URL Rewrite (Web App)

- เนื่องจาก `oidc-proxy` และ `supabase-kong` เป็น Hostname ที่ใช้เฉพาะในการสื่อสารภายในเครือข่าย Docker เท่านั้น Browser ของฝั่งผู้ใช้ไม่สามารถ Resolve ชื่อโฮสต์เหล่านี้ได้
- ปุ่ม **Sign in with Authentik** จึง POST ไปยัง server action ของ `app/routes/auth.login.tsx` (intent=`sso`) แทนการเรียก `signInWithOAuth` ฝั่ง browser ตรงๆ ขั้นตอนภายในเป็นดังนี้:
  1. เรียก `supabase.auth.signInWithOAuth({ provider: "keycloak", skipBrowserRedirect: true })` ฝั่ง server เพื่อให้ supabase-js สร้าง PKCE `code_verifier` และเก็บลง cookie ผ่าน adapter ของ `@supabase/ssr`
  2. Server `fetch(data.url, { redirect: "manual" })` ไปยัง GoTrue authorize endpoint แล้วอ่าน `Location` header (ซึ่งจะชี้ไปที่ `http://oidc-proxy/protocol/openid-connect/auth?...` พร้อม `state`)
  3. แทนที่ host `http://oidc-proxy/protocol/openid-connect/auth` ด้วย `process.env.AUTHENTIK_AUTHORIZE_URL` (default `http://localhost:9000/application/o/authorize/`) โดยคง query string เดิมไว้
  4. `throw redirect(target, { headers })` — Browser จะได้ 302 พร้อม `Set-Cookie` ของ PKCE verifier ใน response เดียวกัน
- เมื่อผู้ใช้ login ที่ Authentik สำเร็จ Authentik จะ redirect กลับไป `http://localhost:8000/auth/v1/callback` (Kong → GoTrue) → GoTrue แลก code กับ Authentik ผ่าน `oidc-proxy` token endpoint → redirect กลับ `http://localhost:3000/auth/callback?code=...` → `auth.callback.tsx` เรียก `exchangeCodeForSession` ซึ่งอ่าน `code_verifier` จาก cookie

---

### 3. การพัฒนา Web App (Local Development)

คอนเทนเนอร์ `web` ใน `docker-compose.yml` รัน production build (`react-router-serve`) บน port 3000 — เหมาะกับการ demo end-to-end ไม่เหมาะกับการแก้ UI เพราะต้อง rebuild ทุกครั้ง

สำหรับการพัฒนาให้รัน Vite dev server บนเครื่อง host:

1. หยุดคอนเทนเนอร์ `web` เพื่อปลด port:
   ```bash
   docker compose stop web
   ```
2. สร้างไฟล์ `web/.env` (ไม่ถูก commit) ใส่ค่าทั้ง 4 ตัว — root `.env` ใช้เฉพาะกับ Docker เท่านั้น Vite ไม่อ่าน
   ```env
   SUPABASE_URL=http://localhost:8000
   SUPABASE_ANON_KEY=<ค่าจาก root .env>
   AUTHENTIK_AUTHORIZE_URL=http://localhost:9000/application/o/authorize/
   VITE_SUPABASE_URL=http://localhost:8000
   VITE_SUPABASE_ANON_KEY=<ค่าจาก root .env>
   ```
   > URL ใช้ `localhost:8000` ซึ่งเป็น published port ของ Kong ไม่ใช่ `supabase-kong:8000` (DNS นั้น resolve ได้เฉพาะใน Docker network) ส่วนตัวแปรที่ขึ้นต้นด้วย `VITE_` จำเป็นสำหรับ browser bundle เพราะ Vite จะเปิดเผยเฉพาะตัวที่ขึ้นต้นด้วย `VITE_` ไปยังฝั่ง client
3. รัน dev server บน port 3000 (ตรงกับ `GOTRUE_URI_ALLOW_LIST`):
   ```bash
   cd web
   npm run dev -- --port 3000
   ```

## การแก้ไขปัญหาเบื้องต้น (Troubleshooting)

- **Browser ขึ้น Error `ERR_NAME_NOT_RESOLVED oidc-proxy` หรือ `supabase-kong`**:
  - แสดงว่า Server-Side Rewrite ใน `app/routes/auth.login.tsx` (intent=`sso`) ไม่ได้ทำงาน หรือโค้ดที่รันอยู่ในคอนเทนเนอร์ `web` เป็น build เก่า ลอง rebuild (`docker compose build web && docker compose up -d web`) หรือสลับมาใช้ dev server (`cd web && npm run dev -- --port 3000`) — สังเกต: Vite เปิด port 5173 เป็น default แต่ `GOTRUE_URI_ALLOW_LIST` อนุญาตเฉพาะ `localhost:3000` ต้องเปลี่ยน port ให้ตรงกัน
- **`pkce_code_verifier_not_found` ตอน `/auth/callback`** (ผ่าน Authentik แล้วแต่ login ไม่จบ):
  - เกิดจาก cookie `sb-…-code-verifier` ไม่ถูก persist ตรวจสอบเรียงตามนี้
    1. `web/app/utils/supabase.server.ts` ใช้ adapter shape ตรงกับเวอร์ชัน `@supabase/ssr` ที่ติดตั้งจริง (v0.3 ใช้ `get`/`set`/`remove` ทีละ cookie ไม่ใช่ `getAll`/`setAll`)
    2. SSO action ส่ง `headers` เข้า `redirect(target, { headers })` ครบ — ขาดตัวนี้ Set-Cookie จะหาย
    3. ผู้ใช้ไม่ได้ลบ cookies ของ `localhost` กลางคัน
- **`Unable to exchange external code` ใน supabase-auth log** (HTTP 500 ฝั่ง GoTrue):
  - GoTrue แลก code จาก Authentik ไม่ผ่าน มักเกิดจาก
    - `AUTHENTIK_CLIENT_SECRET` ใน `.env` ไม่ตรงกับใน Authentik และยังไม่ได้ `docker compose up -d --force-recreate supabase-auth`
    - Redirect URI ในผู้ให้บริการของ Authentik ต้องเป็น `http://localhost:8000/auth/v1/callback` ตรงๆ
    - Code เดิมถูกใช้ซ้ำ (เช่นกดปุ่ม SSO รัวๆ)
- **GoTrue แจ้งเตือน Mailer error ใน Log ของ Docker**:
  - โปรเจกต์นี้ตั้งค่า `GOTRUE_MAILER_AUTOCONFIRM=true` ไว้ การสมัครสมาชิกจึงทำได้เลยโดยไม่ต้องส่งอีเมล แต่หากมีการล็อกอินผิด หรือ Request password reset มันจะพยายามต่อ SMTP และเกิด Error ซึ่งเป็นเรื่องปกติสำหรับการทำ POC ระดับโลคอล
- **ล็อกอิน Authentik ผ่านแล้ว แต่พอกลับมา Supabase เกิด Error เกี่ยวกับ JWKS**:
  - ตรวจสอบว่าในขั้นตอนสร้าง Application บน Authentik คุณได้ตั้งค่า Slug ให้เป็น `poc` หรือไม่ หากเป็นชื่ออื่น Caddy จะไม่สามารถดึง JWKS Certs ไป Validate Token ให้กับ GoTrue ได้

### 3. กลไกเบื้องหลังของ Supabase (ทำไมรันแล้วใช้ได้เลย)

คุณอาจจะสงสัยว่าทำไมในคู่มือจึงไม่มีขั้นตอนการ Setup หรือรัน Migration สำหรับ Supabase นั่นเป็นเพราะว่า:

- **ฐานข้อมูลสำเร็จรูป**: เราใช้ Docker Image พิเศษของ Supabase คือ `supabase/postgres` ซึ่งเป็น Image ที่เตรียมโครงสร้าง Schema หลัก (เช่น Schema `auth` สำหรับ GoTrue, และ Role ต่างๆ เช่น `authenticator`, `anon`, `service_role`) เอาไว้เรียบร้อยแล้ว ทำให้ GoTrue และ PostgREST สามารถเชื่อมต่อและใช้งานได้ทันที
- **การจัดการ Authentication**: สำหรับระบบ Login ด้วย OIDC การตั้งค่าที่จำเป็นที่สุดคือการป้อน Client ID และ Client Secret ผ่าน Environment Variables (`AUTHENTIK_CLIENT_ID` และ `AUTHENTIK_CLIENT_SECRET`) เข้าไปใน Container `supabase-auth` เมื่อ Container ทำงาน มันจะโหลดค่าเหล่านี้และเปิดใช้งาน SSO ทันที
- **Kong Gateway**: เราผูก `kong.yml` เข้ากับ `anon` และ `service_role` keys แบบ Static (คีย์ถูก Random ไว้ในไฟล์ `.env.example`) เพื่อให้ API Gateway ยอมรับ Request ได้เลยโดยไม่ต้องไปตั้งค่าฐานข้อมูลเพิ่มเติม

ดังนั้น หากคุณต้องการนำไปใช้งานจริง (Production) สิ่งที่คุณต้องเปลี่ยนคือการสร้าง JWT Keys (JWT Secret, Anon Key, Service Role Key) ใหม่ทั้งหมด เพื่อความปลอดภัย แต่สำหรับ POC นี้ ทุกอย่างพร้อมรันได้เลยผ่าน Docker Compose
