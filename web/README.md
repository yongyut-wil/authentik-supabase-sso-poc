# Web App

เว็บ React Router v7 SSR สำหรับทดสอบอีเมลกับรหัสผ่านและ Authentik SSO ผ่าน Supabase Auth ใช้ Node.js 22 และ npm ตาม [Dockerfile](Dockerfile)

เริ่ม Supabase และ Authentik แล้วตั้งค่า Provider ตาม [README หลัก](../README.md) ดูวิธีรันบนพอร์ต `5173` ที่ [Local Development](../README.md#local-development)

## คำสั่ง

รันจากโฟลเดอร์ `web`

| คำสั่ง | หน้าที่ |
| --- | --- |
| `npm ci` | ติดตั้ง dependencies ตาม `package-lock.json` |
| `npm run dev -- --port 5173 --strictPort` | เปิด dev server ที่ `http://localhost:5173` และโหลด `.env` จาก root ของ repo |
| `npm run typecheck` | สร้าง route types แล้วตรวจ TypeScript |
| `npm run build` | สร้าง client และ server bundles ใน `build/` |
| `npm start` | เสิร์ฟ build ผ่าน `react-router-serve` ด้วย env ของ Node process |

เพื่อทดสอบ build แบบเดียวกับ Compose ให้รัน `docker compose up -d --build web` จาก root ของ repo แล้วเปิด `http://localhost:3000` Compose ส่ง URL ของ Kong และ anon key เข้า container ให้เว็บ [docker-compose.yml](../docker-compose.yml)
