# Authentik + Supabase SSO POC (Minimal & Self-hosted)

โปรเจกต์นี้คือ Proof of Concept (POC) สำหรับการใช้งาน Supabase (GoTrue) ร่วมกับ Authentik เป็น Identity Provider (IdP) แบบ Self-hosted อย่างสมบูรณ์ผ่าน Single Sign-On (SSO) โดยไม่ต้องเชื่อมต่อกับระบบภายนอกอื่นๆ

เนื่องจาก GoTrue v2 ไม่มี "authentik" provider อยู่ในตัวเอง โปรเจกต์นี้จึงใช้ Workaround โดยใช้ Keycloak provider ของ GoTrue แทน และใช้ Nginx เป็น `oidc-proxy` เพื่อทำการเปลี่ยน Paths (Rewrite paths) จาก Keycloak format ไปยัง Authentik format

## สถาปัตยกรรม (Architecture)
โปรเจกต์นี้ใช้ Docker Compose ในการรัน Services หลักดังนี้:
1. **Authentik**: IdP (PostgreSQL, Redis, Server, Worker)
2. **Supabase**: Auth, Database, Rest API, Kong Gateway
3. **Nginx oidc-proxy**: แปลง `/protocol/openid-connect/*` ไปเป็น `/application/o/*` ของ Authentik
4. **Web App**: React Router v7 SSR สำหรับการทำ Frontend

---

## Prerequisites (สิ่งที่ต้องมี)
- Docker และ Docker Compose (Docker Desktop หรือ Docker Engine)
- Node.js (v18 หรือ v20 ขึ้นไป) เพื่อใช้ในฝั่ง Web App หากต้องการรันภายนอก (แต่ในนี้เราก็มี Docker Image ให้แล้ว)

---

## ขั้นตอนการติดตั้งและการใช้งาน (Setup Instructions)

### 1. การเริ่มต้นโปรเจกต์ (Start the project)

Clone repository นี้ จากนั้นให้เริ่มระบบพื้นฐานด้วยคำสั่ง:
```bash
docker compose up -d
```
จากนั้นรอประมาณ 1-2 นาทีเพื่อให้ทุก Services สร้างขึ้นและขึ้นสถานะ Healthy (โดยเฉพาะ PostgreSQL และ Redis)

### 2. ตั้งค่า Authentik เริ่มต้น (Initial Setup)

1. เปิด Browser ไปที่ http://localhost:9000/if/flow/initial-setup/
2. ระบบจะบังคับให้คุณตั้งรหัสผ่านสำหรับผู้ใช้งาน `akadmin` (และกรอกอีเมล)
3. เมื่อเสร็จสิ้น คุณจะเข้าสู่หน้า Authentik Admin Interface

### 3. สร้าง Application และ OIDC Provider

เนื่องจาก GoTrue ถูกจำกัดให้ใช้ Keycloak เราจึงต้องสร้าง Provider แบบ OIDC เพื่อให้รองรับ

1. ในเมนูด้านซ้าย ไปที่ **Applications > Providers**
2. คลิก **Create > OAuth2/OpenID Provider**
   - **Name**: `poc-provider`
   - **Authorization flow**: `default-provider-authorization-explicit-consent`
   - **Client Type**: `Confidential`
   - **Client ID**: (คัดลอกค่านี้เก็บไว้)
   - **Client Secret**: (คัดลอกค่านี้เก็บไว้)
   - **Redirect URIs/Origins (RegEx)**: `http://localhost:8000/auth/v1/callback`
   - **Advanced protocol settings** > กดเลือก scopes: `email`, `openid`, `profile`
   - กด **Finish** เพื่อบันทึก
3. ไปที่ **Applications > Applications**
   - คลิก **Create**
   - **Name**: `POC App`
   - **Slug**: `poc` (สำคัญมาก! ต้องใช้ slug เป็น `poc` เพราะ Nginx ถูกคอนฟิกให้ดึง JWKS certs จาก URL: `/application/o/poc/jwks/`)
   - **Provider**: เลือก `poc-provider` ที่เพิ่งสร้างขึ้น
   - กด **Create**

### 4. อัพเดท Credentials และ รีสตาร์ท Supabase Auth

1. แก้ไขไฟล์ `.env` ในโฟลเดอร์หลักของโปรเจกต์ นำ Client ID และ Secret มาใส่:
   ```env
   AUTHENTIK_CLIENT_ID=ค่า_client_id_ที่ได้มา
   AUTHENTIK_CLIENT_SECRET=ค่า_client_secret_ที่ได้มา
   ```
2. ทำการบังคับสร้าง `supabase-auth` ใหม่เพื่อให้โหลดค่า Env vars ล่าสุด:
   ```bash
   docker compose up -d --force-recreate supabase-auth
   ```

### 5. ทดสอบใช้งาน Web App

1. เปิด Browser ไปที่ http://localhost:3000
2. ระบบจะ Redirect ไปที่หน้า `/auth/login` อัตโนมัติ เนื่องจากเป็น Protected Route
3. คุณสามารถทดสอบ **Sign Up / Login** แบบพื้นฐานด้วย Email/Password
4. หรือคลิกที่ปุ่ม **"Login with Authentik SSO"**
5. ระบบจะพาคุณไปยังหน้าของ Authentik ให้กรอกผู้ใช้ (เช่น `akadmin`) และกดยอมรับ Consent
6. หลังจากสำเร็จ จะถูก Redirect กลับมาที่ http://localhost:3000 พร้อมเห็นหน้า Dashboard ขึ้นอีเมลของคุณ
7. คุณสามารถกดปุ่ม **Logout** เพื่อล้าง Session ได้

---

## ข้อมูลที่น่าสนใจเกี่ยวกับการทำงานของ Workaround

1. **Path Translation**: Supabase พยายามเรียก Keycloak Endpoint แบบ `/protocol/openid-connect/auth` เราจึงใช้ Nginx คอยรับ Request จาก Host `oidc-proxy` (ในเครือข่าย Docker) แล้ว Proxy ส่งต่อไปยัง `/application/o/authorize/` ของ Authentik
2. **Server-Side URL Rewrite**: เนื่องจาก `oidc-proxy` เป็น Hostname ภายใน Docker Browser ไม่สามารถ Resolve ชื่อนี้ได้ ดังนั้นในหน้า `/auth/login` (ในไฟล์ `auth.login.tsx`) ระบบ Web App จึงทำการ `fetch()` แบบ `manual` ไปยัง URL เพื่อดักจับ Header `Location` แล้วแก้ไขชื่อ Host ให้เป็น `http://localhost:9000` ก่อนค่อย Redirect Browser ไปจริงๆ

---

## การแก้ไขปัญหาเบื้องต้น (Troubleshooting)

- **Browser เข้าหน้า OIDC ไม่ได้ (DNS Not Found `oidc-proxy`)**:
  - เกิดจากการที่ฟังก์ชัน Server-Side Rewrite ในฝั่ง Web ไม่ทำงาน (กรณีไม่ผ่าน `auth.login.tsx`) ตรวจสอบว่าในไฟล์ `auth.login.tsx` มีฟังก์ชันดักจับ Header Location เปลี่ยน `oidc-proxy` เป็น `localhost:9000` แล้วหรือไม่
- **GoTrue แจ้งเตือน Mailer error (ไม่สามารถส่ง Email ได้)**:
  - ค่า `GOTRUE_MAILER_AUTOCONFIRM=true` ถูกเปิดอยู่ การลงทะเบียนผู้ใช้ใหม่จะใช้ได้โดยไม่ต้องส่งอีเมล แต่หากมีการล็อกอินผิด หรือ Request password reset มันอาจจะพยายามส่งอีเมลและมีแจ้งเตือน Error บน Logs ซึ่งเป็นเรื่องปกติสำหรับการทำ POC ที่ไม่มี SMTP Server
- **ผู้ใช้งานกลับเข้าสู่ระบบหลังจากที่ Authentik ร้องขอให้ Consent แล้วเกิด Error บน Supabase**:
  - ตรวจสอบว่า Slug ของ Application ใน Authentik ตั้งเป็น `poc` หรือไม่ หากเป็นชื่ออื่น `oidc-proxy` จะไม่สามารถเรียกหา JWKS URL `/application/o/poc/jwks/` เพื่อ Verify Token ได้
