# Supabase Project Setup Guide

คู่มือนี้สำหรับวิธีการตั้งค่าโปรเจกต์ Supabase ใหม่ เพื่อรองรับระบบ **OEE Manufacturing Dashboard**

## 1. สร้าง Supabase Project ใหม่
1. ไปที่ [Supabase Dashboard](https://supabase.com/dashboard)
2. กด **New Project** → เลือก Organization ของคุณ
3. ตั้งชื่อโปรเจกต์ เช่น `OEE Manufacturing`
4. เลือก Region เป็น **Singapore (ap-southeast-1)** เพื่อความเร็วที่ดีที่สุดในไทย
5. ตั้ง **Database Password** ที่แข็งแรง และ **บันทึกรหัสผ่านนี้ไว้ให้ดี**
6. รอประมาณ 2 นาทีเพื่อให้โปรเจกต์พร้อมใช้งาน

## 2. เก็บ Credentials และเอามาใส่ `.env`
ไปที่ **Project Settings → API** ในเมนูด้านซ้าย และจดค่าเหล่านี้มา:
- `Project URL` (เอามาใส่ `VITE_SUPABASE_URL`)
- `anon public key` (เอามาใส่ `VITE_SUPABASE_ANON_KEY`)
- `service_role secret` (เอามาใส่ `SUPABASE_SERVICE_ROLE_KEY` - **ระวัง ห้ามให้หลุดไปใน Frontend เด็ดขาด**)
- `JWT Secret` (เอามาใส่ `SUPABASE_JWT_SECRET`)

ไปที่ **Project Settings → Database** และจด Connection String:
- `Direct Connection` (เอามาใส่ `DATABASE_URL`)
- `Connection Pooling` (เอามาใส่ `DATABASE_URL_POOLING`)

> 🚨 นำค่าทั้งหมดนี้ไปสร้างไฟล์ `.env` ใน folder นอกสุดของโปรเจกต์ (มีไฟล์ `.env.example` เตรียมให้แล้ว ลอง copy มาใช้งานได้เลย)

## 3. รัน Database Migration Scripts
ใน Supabase Dashboard ไปที่เมนู **SQL Editor** ซ้ายมือ:
1. กดที่ **New query**
2. copy โค้ดในโฟลเดอร์ `supabase/setup/` ของโปรเจกต์เรา มารันทีละอันตามลำดับ:
   - `01_schema.sql`
   - `02_rls.sql`
   - `03_functions.sql`

*(หมายเหตุ: ต้องรันให้ครบแล้วเช็คว่ามีตารางขึ้นครบในเมนู **Table Editor**)*

## 4. ตั้งค่า Authentication
ไปที่ **Authentication** (icon รูปคน) ในเมนูด้านซ้าย:

### 4.1 URL Configuration
- ไปที่ **URL Configuration**
- **Site URL**: `http://localhost:5173`
- **Redirect URLs**: เพิ่มค่าต่อไปนี้ `http://localhost:5173/**`, `http://localhost:5173/auth/callback`, `http://localhost:5173/auth/reset-password`

### 4.2 Providers (Email)
- ไปที่ **Providers → Email**
- Enable Email Provider: เปิด ✅
- (เฉพาะ Development) Confirm email: ปิด (เพื่อความง่ายในการ test) ❌
- Secure email change: เปิด ✅

## 5. การ Generate Database Types
เพื่อให้ TypeScript ของเรารู้จัก Schema ใหม่ตลอดเวลา:
```bash
# เนื่องจากมีการติดตั้งแต่ supabase ในโปรเจกต์แล้ว (ผ่าน npm install -D supabase)
# เราสามารถใช้งานผ่าน npx ได้เลย ไม่ต้องลง global 

# Login (ถ้ายังไม่ได้ล็อกอิน)
npx supabase login

# ดึง Type ล่าสุดมาเซฟในโปรเจกต์ (แทนค่า PROJECT_REF ด้วย ID จาก URL Dashboard)
npx supabase gen types typescript --project-id YOUR_PROJECT_REF --schema public > src/lib/database.types.ts
```

เราตั้ง Command ไว้ใน `package.json` แล้วคือ `npm run gen:types` ใช้งานได้เลย

## 6. ตั้งค่าและ Deploy Edge Functions (จำเป็นสำหรับการเพิ่มผู้ใช้)
ระบบต้องการ Edge Functions ในการทำคำสั่งที่ต้องการสิทธิ์ระดับสูง เช่น การสร้างผู้ใช้ใหม่ หรือ การรีเซ็ตรหัสผ่าน

1. คัดลอก **Reference ID** ของโปรเจกต์ (ได้จาก URL ของ Supabase Dashboard เช่น `https://supabase.com/dashboard/project/abcdefghijk` ค่า ID คือ `abcdefghijk`)
2. รันคำสั่งต่อไปนี้ใน Terminal เพื่อเชื่อมต่อและ Deploy:
   ```bash
   # ล็อกอิน (ถ้ายังไม่ได้ทำ)
   npx supabase login

   # เชื่อมต่อกับโปรเจกต์ (เปลี่ยน YOUR_PROJECT_REF เป็น ID จริง)
   npx supabase link --project-ref YOUR_PROJECT_REF

   # ฝังฟังก์ชันขึ้นคลาวด์
   npx supabase functions deploy
   ```

## 6. โครงสร้างไฟล์ในโปรเจกต์ (แนะนำ)
จัดการ Source Code ใน Frontend ของคุณตามนี้:
```
your-project/
├── .env                        ← ค่าจริง (ห้าม commit)
├── .env.example                ← template (commit ได้)
├── .gitignore                  ← ต้องมี .env
├── vite.config.ts
├── package.json
└── src/
    ├── lib/
    │   ├── supabase.ts         ← Supabase client สำหรับเชื่อมต่อ
    │   ├── database.types.ts   ← Types จากคำสั่ง generate
    │   └── testConnection.ts   ← สคริปต์เทสระบบ
    ├── hooks/
    │   ├── useAuth.ts          ← ระบบ User Role
    │   └── useOEE.ts           
    ...
```

เมื่อตั้งค่าทั้งหมดนี้เสร็จ คุณสามารถรันแอปด้วยคำสั่ง `npm run dev` ได้เลย!
