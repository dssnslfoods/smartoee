# PNF OEE System (Overall Equipment Effectiveness)

Dashboard แสดงผลสัมฤทธิ์ของเครื่องจักรในสายการผลิตแบบ Real-Time (OEE) 
เป็นระบบที่ใช้ติดตามประสิทธิภาพการทำงานของเครื่องจักร, ควบคุม, วิจัยสาเหตุการหยุดทำงาน และเพิ่มประสิทธิภาพของการผลิตโดยรวมอย่างยั่งยืน

## Project Details
- **Project Name:** PNF OEE System (Manufacturing Dashboard)
- **Version:** 1.0.0
- **Author & Lead Developer:** Arnon Arpaket
- **Technology Stack:** React, TypeScript, Vite, Tailwind CSS, Supabase

---

## 🔒 License and Copyright
**Copyright © 2026 Arnon Arpaket. All Rights Reserved.**

ระบบ **PNF OEE System** (รวมถึง Source Code, รูปแบบฐานข้อมูล, ดีไซน์ Layout และตรรกะทั้งหมดที่ปรากฏในโปรเจกต์นี้) 
เป็นทรัพย์สินทางปัญญาและมีลิขสิทธิ์ผูกขาดหรือเป็นสิทธิ์ขาดของ **Arnon Arpaket** แต่เพียงผู้เดียว โดยได้รับการปกป้องภายใต้กฎหมายลิขสิทธิ์แห่งราชอาณาจักรไทยและนานาชาติ

### Terms of Use (ข้อตกลงการใช้งาน)
1. ห้ามมิให้ผู้ใดคัดลอก, ทำซ้ำ, ดัดแปลง, แจกจ่าย, วางขาย หรือนำโค้ดในโปรเจกต์นี้ทั้งหมดหรือบางส่วน ไม่ว่าส่วนหนึ่งส่วนใดไปใช้ในทางอื่นใด เว้นแต่จะได้รับ **การอนุญาตเป็นลายลักษณ์อักษร** จากเจ้าของลิขสิทธิ์ (Arnon Arpaket) อย่างเป็นทางการเท่านั้น
2. รูปแบบโครงสร้าง (Structure), ฐานข้อมูล (Database Schema) ตลอดจนฟังก์ชันการคำนวณ OEE ถูกสร้างและออกแบบโดยตั้งใจเพื่อนำมาใช้งานเป็นการเฉพาะ ห้ามนำไปวิศวกรรมย้อนกลับ (Reverse Engineer) หรือแสวงหาผลประโยชน์ทางการค้าโดยเด็ดขาด
3. หากฝ่าฝืน ผู้ละเมิดอาจถูกดำเนินการตามกฎหมายทรัพย์สินทางปัญญาสูงสุด

*(If you require any special licensing or partnership, please contact the author directly.)*

---

## Features (ฟังก์ชันการทำงานหลัก)
- **Real-Time Monitoring:** ติดตามสายการผลิตแบบเรียลไทม์ (Running, Idle, Stopped, Maintenance)
- **OEE Calculation:** คำนวณค่า OEE (Availability × Performance × Quality) ผ่าน Formula แบบมาตรฐานอุตสาหกรรม
- **Multi-Role Access Control (RBAC):** ระบบจำกัดสิทธิ์ผู้ใช้ ตั้งแต่ Admin, Executive, MANAGER, SUPERVISOR, OPERATOR จนถึง VIEWER
- **Audit Logs:** บันทึกทุกความเคลื่อนไหว (Insert, Update, Delete) ไว้ในฐานข้อมูล เพื่อการตรวจสอบย้อนหลังที่แม่นยำ
- **Shopfloor Interface:** ออกแบบหน้าจอให้พนักงานหน้าเครื่องจักรหรือ Tablet ใช้งานได้ง่ายที่สุด
- **Data Export & Reports:** สร้างรายงานสรุปประสิทธิภาพรายสัปดาห์ / รายเดือน

---

## Getting Started (การรันระบบ)

### Requirements
- Node.js (v18 หรือสูงกว่า)
- npm หรือ yarn หรือ pnpm
- Supabase Project (Database)

### Installation
1. ติดตั้ง Dependencies
   ```bash
   npm install
   ```
2. คัดลอกไฟล์ Environment Variables
   ```bash
   cp .env.example .env
   ```
   *และเข้าไปใส่ค่า Credentials จาก Supabase ของคุณลงไปในไฟล์ .env*

3. สั่งเริ่มต้นเซิร์ฟเวอร์แบบ Local
   ```bash
   npm run dev
   ```
4. เข้าชมผ่านเว็บบราวเซอร์ที่: `http://localhost:8080` (หรือพอร์ตอื่นที่ระบุใน Terminal)

---

> **Note:** การเข้าใช้ Environment ของ Production เพื่อดูฐานข้อมูลจริง ต้องได้รับการจัดการจากทางทีม Admin โดยตรงเท่านั้น
