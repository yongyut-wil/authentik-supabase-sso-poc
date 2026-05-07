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
   - **Slug**: กรอก `poc`  *(❗ สำคัญมาก: ต้องใช้ชื่อนี้เท่านั้น เนื่องจาก Nginx ถูกเขียนให้เชื่อมโยงดึงค่า JWKS certs จาก URL `/application/o/poc/jwks/`)*
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

1. **Path Translation (oidc-proxy)**:
   - Supabase (GoTrue) ฝัง Hardcode มาว่า Keycloak จะต้องใช้ Endpoint แบบ `/protocol/openid-connect/auth`
   - เราใช้ Nginx (Service `oidc-proxy`) สร้าง Server ภายใน Docker รับ Request และ Proxy ไปยัง `/application/o/authorize/` ของ Authentik
2. **Server-Side URL Rewrite (Web App)**:
   - เนื่องจาก `oidc-proxy` เป็น Hostname ที่รู้จักเฉพาะในเครือข่าย Docker เท่านั้น Browser ไม่สามารถเข้าถึงได้โดยตรง
   - ใน Web App (React Router SSR) ไฟล์ `app/routes/auth.login.tsx` มีโค้ดสำหรับการแก้ปัญหานี้ โดยเมื่อกด SSO Server Node.js จะทำการ `fetch()` แบบ manual ไปยัง Supabase เพื่อเอา URL `http://oidc-proxy/...` มา จากนั้นใช้ Regular Expression ดึงเอาค่า `?search=...` Parameters มาต่อท้ายกับ `http://localhost:9000/application/o/authorize/` แล้วสั่งให้ Browser ทำการ Redirect ไปแทน

---

## การแก้ไขปัญหาเบื้องต้น (Troubleshooting)

- **Browser ขึ้น Error 'DNS Not Found oidc-proxy'**:
  - เกิดจากการที่ฟังก์ชัน Server-Side Rewrite ในฝั่ง Web App ทำงานผิดพลาด ตรวจสอบในไฟล์ `auth.login.tsx` ว่ามีการ Fetch แล้ว Replace URL ให้กลายเป็น `http://localhost:9000` แล้วหรือไม่
- **GoTrue แจ้งเตือน Mailer error ใน Log ของ Docker**:
  - โปรเจกต์นี้ตั้งค่า `GOTRUE_MAILER_AUTOCONFIRM=true` ไว้ การสมัครสมาชิกจึงทำได้เลยโดยไม่ต้องส่งอีเมล แต่หากมีการล็อกอินผิด หรือ Request password reset มันจะพยายามต่อ SMTP และเกิด Error ซึ่งเป็นเรื่องปกติสำหรับการทำ POC ระดับโลคอล
- **ล็อกอิน Authentik ผ่านแล้ว แต่พอกลับมา Supabase เกิด Error**:
  - ตรวจสอบว่าในขั้นตอนสร้าง Application บน Authentik คุณได้ตั้งค่า Slug ให้เป็น `poc` หรือไม่ หากเป็นชื่ออื่น Nginx จะไม่สามารถดึง JWKS Certs ไป Validate Token ได้
