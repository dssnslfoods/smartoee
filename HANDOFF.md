# SmartOEE — AI Agent Handoff Document

> **เป้าหมายของเอกสารนี้**: ให้ AI agent ที่เป็นผู้ช่วยส่วนตัวเข้าใจระบบ SmartOEE ได้ทันที  
> **เจ้าของ**: Arnon Arpaket (arpaket@gmail.com)  
> **อัปเดตล่าสุด**: 2026-05-15

---

## 1. ภาพรวมระบบ

**PNF OEE System** ("smartoee") คือ manufacturing dashboard สำหรับติดตาม **OEE (Overall Equipment Effectiveness)** ของเครื่องจักรในสายการผลิตแบบ real-time

**สูตร OEE**:
```
OEE = Availability × Performance × Quality
Availability = run_time / (planned_time - planned_downtime)
```

**ลูกค้าหลัก**: โรงงาน DSSN/PNF (บริษัทผลิตอาหาร มีหลาย plant)

---

## 2. Repository & Deployment

| รายการ | ค่า |
|--------|-----|
| **GitHub** | https://github.com/dssnslfoods/smartoee.git |
| **Branch หลัก** | `main` |
| **Local clone** | `/Users/golf/Desktop/Projects/smartoee` |
| **Production URL** | https://smartoee-490f8.web.app |
| **Supabase project** | `wqrbxdbsknzuvepifqxn` |
| **Supabase URL** | https://wqrbxdbsknzuvepifqxn.supabase.co |

---

## 3. Tech Stack

| Layer | เทคโนโลยี |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| **State/Fetch** | TanStack Query (React Query v5) |
| **Routing** | react-router-dom v6 |
| **Backend** | Supabase (PostgreSQL + RLS + Edge Functions) |
| **Deploy** | Firebase Hosting (`firebase deploy --only hosting --project smartoee-490f8`) |
| **DB migrations** | Supabase MCP (`apply_migration`) หรือ Supabase Dashboard |
| **Package manager** | `npm` (มี bun.lockb ด้วยแต่ใช้ npm เป็นหลัก) |
| **Timezone** | Asia/Bangkok (hardcoded ทั่วระบบ) |

### Commands สำคัญ
```bash
npm run dev          # local dev server
npm run build        # build to dist/
firebase deploy --only hosting --project smartoee-490f8  # deploy to Firebase
git push origin main # push to GitHub
```

---

## 4. โครงสร้างโปรเจกต์

```
smartoee/
├── src/
│   ├── pages/              # React pages (12 หน้า)
│   │   ├── Shopfloor.tsx   # พนักงานหน้าเครื่อง — start/stop RUN/downtime
│   │   ├── PendingCounts.tsx # บันทึกจำนวนผลิตที่ค้าง
│   │   ├── Supervisor.tsx  # Supervisor view + shift approval
│   │   ├── Monitor.tsx     # TV monitor — real-time machine status
│   │   ├── Executive.tsx   # KPI dashboard สำหรับผู้บริหาร
│   │   ├── Dashboard.tsx   # Overview
│   │   ├── Admin.tsx       # Admin settings
│   │   └── ...
│   ├── hooks/
│   │   ├── useAuth.tsx              # Auth context (user, company, role)
│   │   ├── useMonitorData.ts        # Real-time monitor data (15s polling)
│   │   ├── useExecutiveData.ts      # Executive dashboard data
│   │   └── usePendingCountsBadge.ts # Badge count สำหรับ sidebar
│   ├── services/
│   │   └── oeeApi.ts        # Supabase API calls (~1,250 บรรทัด — god service)
│   ├── lib/
│   │   └── fetchAllPages.ts # Auto-paginate helper (แก้ PostgREST 1000-row limit)
│   └── components/
│       ├── shopfloor/       # EventControls, AddCountsForm, EventTimeline
│       ├── supervisor/      # ShiftCard, PlannedTimeManager
│       ├── monitor/         # MonitorMachineCard, ShiftScheduleBanner
│       ├── executive/       # ExecSnapshot, ExecTrendChart, ExecLossPareto, ...
│       └── ui/              # shadcn/ui components
├── supabase/
│   ├── setup/
│   │   ├── 01_schema.sql    # DB schema (tables + indexes)
│   │   ├── 03_functions.sql # OEE calc (calculate_oee function)
│   │   └── 04_rpc_functions.sql  # RPC functions (initial)
│   ├── migrations/          # ~80 migration files (timestamp-prefixed)
│   └── functions/           # Edge Functions (Deno)
│       ├── auto-break-stop/
│       ├── auto-close-events/
│       ├── create-staff-user/
│       ├── generate-shift-calendar/
│       └── update-user-password/
└── HANDOFF.md               # เอกสารนี้
```

---

## 5. Database Schema

### ลำดับข้อมูล (Hierarchy)
```
companies → plants → lines → machines
                          → products/SKU
```

### ตารางหลัก

| ตาราง | ความหมาย |
|-------|----------|
| `companies` | บริษัท (multi-tenant) |
| `plants` | โรงงาน (1 company มีหลาย plant) |
| `lines` | สายการผลิต |
| `machines` | เครื่องจักร |
| `products` | สินค้า/SKU |
| `shifts` | กะทำงาน (ตาราง shift: เวลา, วันทำงาน, effective_from) |
| `shift_calendar` | ปฏิทินกะแต่ละวัน (สร้างอัตโนมัติ 14 วันล่วงหน้า) |
| `shift_approvals` | การอนุมัติกะ (DRAFT → APPROVED → LOCKED) |
| `planned_time_templates` | เทมเพลต break/meal/meeting ตัดจาก planned_time |
| `production_events` | event การผลิต (RUN / DOWNTIME / SETUP) |
| `production_counts` | จำนวนผลิต (good_qty, reject_qty) ผูกกับ event |
| `oee_snapshots` | ค่า OEE สรุปรายกะรายเครื่อง (คำนวณโดย calculate_oee) |
| `downtime_reasons` | เหตุผล downtime (PLANNED/UNPLANNED/BREAKDOWN/CHANGEOVER/SETUP) |
| `user_profiles` | โปรไฟล์ + role ของ user |
| `audit_logs` | log ทุก action (เก็บ 3 เดือน → archive อัตโนมัติ) |

### Event Types
```
production_events.event_type:
  RUN        — เดินเครื่องผลิต
  DOWNTIME   — หยุดเครื่อง (มี reason_id)
  SETUP      — เตรียมเครื่อง/setup
  IDLE       — รอ (auto-assigned เมื่อไม่มี event active)
```

### Downtime Categories (OEE impact)
| Category | กระทบ Availability |
|----------|--------------------|
| PLANNED | ❌ ไม่กระทบ (หักจาก planned_time ด้วย template) |
| CHANGEOVER | ❌ ไม่กระทบ (เว้นส่วนที่เกิน std_setup_time) |
| SETUP | ❌ ไม่กระทบ |
| UNPLANNED | ✅ กระทบ (ลด Availability) |
| BREAKDOWN | ✅ กระทบ (ลด Availability) |
| NULL | ✅ กระทบ (ลด Availability) |

---

## 6. Role System

```
ADMIN
  └── EXECUTIVE    (อ่านข้ามทุก company, ไม่มีสิทธิ์เขียน)
        └── MANAGER
              └── SUPERVISOR  (approve/lock กะ, จัดการ planned_time)
                    └── STAFF / OPERATOR  (บันทึก event, count ที่ตัวเองมีสิทธิ์)
                          └── VIEWER
```

**Permission model**:
- ADMIN: เห็นและแก้ไขได้ทุกอย่าง ทุก company
- EXECUTIVE: **SELECT-only ทุก company** (เปิดสิทธิ์ 2026-05-14)
- SUPERVISOR: จัดการได้ใน company ตัวเอง
- STAFF: เข้าถึงเฉพาะเครื่องที่ได้รับสิทธิ์ (machine_permission_groups)

---

## 7. Shift Workflow

```
Admin สร้าง shift → trigger auto-สร้าง shift_calendar 14 วัน
Supervisor ดู shift_calendar วันนี้
Supervisor อนุมัติ → status: APPROVED
Supervisor lock → status: LOCKED (calculate_oee trigger อัตโนมัติ)

เมื่อ LOCKED:
  - แก้ไข event/count ไม่ได้
  - OEE snapshot final
```

**planned_time chain**:
```
planned_time_templates (meal/meeting/break นาที)
  → trigger cascade → shift_calendar.planned_time_minutes
  → trigger → oee_snapshots recalc (ถ้าไม่ LOCKED)
```

---

## 8. OEE Calculation

ฟังก์ชัน `calculate_oee(shift_calendar_id)` ใน `supabase/setup/03_functions.sql`

```
planned_time_minutes = shift duration - break_templates
run_time = production_events ประเภท RUN (ในกะนั้น)
downtime_unplanned = DOWNTIME events ที่ category = UNPLANNED/BREAKDOWN
downtime_changeover_overage = MAX(actual - std_setup_time, 0) สำหรับ CHANGEOVER

Availability = run_time / (planned_time - planned_downtime)
Performance  = (good + reject) / (run_time × ideal_cycle_rate)
Quality      = good / (good + reject)
OEE          = A × P × Q
```

---

## 9. RPC Functions สำคัญ

| Function | ทำอะไร |
|---------|--------|
| `rpc_start_event(machine_id, event_type, ...)` | start RUN/DOWNTIME/SETUP — validate เวลากะก่อน |
| `rpc_stop_event(machine_id)` | stop event ปัจจุบัน |
| `rpc_add_counts(machine_id, good_qty, ...)` | บันทึกจำนวนผลิต real-time |
| `rpc_get_pending_run_events(company_id)` | ดึง RUN events ที่ยังไม่บันทึก count |
| `rpc_count_pending_run_events(company_id)` | นับสำหรับ badge sidebar |
| `rpc_recalc_oee_for_shift(shift_calendar_id)` | force recalc OEE กะที่ระบุ |
| `rpc_get_std_setup_time(machine_id, product_id)` | ดึงเวลา changeover มาตรฐาน |
| `ensure_shift_calendar(plant_id, date, time)` | หา shift_calendar ที่ตรงเวลา (return NULL ถ้านอกกะ) |
| `calculate_oee(shift_calendar_id)` | คำนวณ OEE เก็บใน oee_snapshots |

---

## 10. Migration History (2026-05-14 — ล่าสุด)

| ไฟล์ | เนื้อหา |
|------|---------|
| `20260514120000` | fix_planned_downtime_semantics — หัก break จาก planned_time |
| `20260514130000` | link_counts_to_run_event — rpc_add_counts auto-link event_id |
| `20260514140000` | add_rpc_get_pending_run_events — server-side pending filter |
| `20260514150000` | audit_logs_3month_retention — archive อัตโนมัติ via pg_cron |
| `20260514160000` | auto_recalc_oee_on_shift_approval — trigger recalc เมื่อ lock |
| `20260514180000` | classify_breakdown_changeover_in_oee — จัด category ครบ |
| `20260514190000` | smed_changeover_overage_logic — SMED split planned+overage |
| `20260514200000` | per_event_std_setup_time — column std_setup_time_seconds ใน events |
| `20260514210000` | drop_old_event_rpc_signatures — แก้ Postgres function overloading |
| `20260514220000` | auto_generate_shift_calendar — trigger สร้าง calendar เมื่อเพิ่ม shift |
| `20260514230000` | fix_template_edit_cascade_and_recalc — planned_time_manual_override flag |
| `20260514240000` | rpc_start_event_validate_shift_time — reject event นอกเวลากะ |
| `20260514250000` | executive_global_view_access — EXECUTIVE เห็นข้าม company |

---

## 11. Frontend Key Patterns

### บันทึก event นอกกะไม่ได้
`rpc_start_event` ใช้ `ensure_shift_calendar(plant, bkk_date, bkk_time)` — ถ้า NULL → error `OUT_OF_SHIFT`

### แก้ PostgREST 1000-row limit
```typescript
import { fetchAllPages } from '@/lib/fetchAllPages';
// ใช้แทน .from('table').select()
const data = await fetchAllPages((from, to) =>
  supabase.from('table').select('*').range(from, to)
);
```

### Company/Plant filter ใน EXECUTIVE
หน้า Monitor, Executive, PendingCounts มี dropdown เลือก company (เฉพาะ ADMIN/EXECUTIVE ที่มี > 1 company)

### useAuth hook
```typescript
const { company, profile, hasRole, isAdmin } = useAuth();
// hasRole('EXECUTIVE') → boolean
// isAdmin() → boolean (ADMIN role check)
// company.id → บริษัทที่ user กำลัง scope อยู่
```

---

## 12. Known Issues & Tech Debt

### ✅ แก้แล้ว (2026-05-14)
- Pending counts ไม่เคลียร์ (PostgREST limit + missing event link)
- Planned downtime semantics (break ไม่ได้หักจาก planned_time)
- OEE NULL เมื่อ lock โดยไม่ recalc
- Template edit ไม่ cascade ถึง OEE
- Shift calendar ไม่สร้างอัตโนมัติเมื่อเพิ่ม shift
- Start event นอกเวลากะได้

### 🔴 ยังค้างอยู่ (ความเสี่ยงสูง)
- Timezone hardcode `Asia/Bangkok` ใน edge functions ทุกตัว → ขยายต่างประเทศไม่ได้
- Cron edge functions ไม่มี idempotency → ยิงซ้ำอาจเกิดปัญหา
- ⚠️ **Supabase service_role key ถูกแชร์ใน chat เมื่อ 2026-05-14** → ควร rotate ทันที

### 🟡 Tech Debt
- `src/services/oeeApi.ts` 1,250+ บรรทัด → ควรแตกเป็น modules
- `src/pages/Shopfloor.tsx` 735 บรรทัด, `PendingCounts.tsx` 900+ บรรทัด → แยก components
- Test coverage = 0% (vitest config มีแต่ไม่มี test จริง)

### 🟢 Backlog (ของแถม)
- Executive kiosk auto-refresh (ตอนนี้ manual Refresh)
- Error boundary + Sentry
- PWA/offline cache สำหรับ Shopfloor
- GitHub Actions CI
- Scheduled email report ผ่าน edge function

---

## 13. วิธี Deploy

### Frontend เท่านั้น (ส่วนใหญ่)
```bash
npm run build
firebase deploy --only hosting --project smartoee-490f8
```

### DB Migration
ใช้ Supabase MCP tool `apply_migration` หรือวาง SQL ใน Supabase Dashboard > SQL Editor  
แล้ว commit ไฟล์ migration ไว้ที่ `supabase/migrations/YYYYMMDDHHMMSS_name.sql`

### ไม่ต้อง deploy Firebase เมื่อ
- แก้เฉพาะ DB (triggers, RLS, functions, migrations)
- Frontend ที่ deploy แล้ว query Supabase REST/RPC โดยตรง

---

## 14. หน้าต่างๆ ในระบบ

| URL Path | หน้า | ใครใช้ |
|----------|------|--------|
| `/` | Dashboard | ทุก role |
| `/shopfloor` | Shopfloor | STAFF/OPERATOR |
| `/pending-counts` | รอบันทึกจำนวนผลิต | SUPERVISOR/STAFF |
| `/supervisor` | Supervisor Dashboard | SUPERVISOR |
| `/monitor` | Production Monitor | ทุก role (TV display) |
| `/executive` | Executive Dashboard | EXECUTIVE+ |
| `/admin` | Admin Panel | ADMIN |
| `/activity` | Recent Activity Log | SUPERVISOR+ |

---

## 15. สิ่งที่ต้องทำก่อน (Action Items)

1. **🔐 Rotate Supabase service_role key** — ถูกแชร์ใน session ก่อนหน้า  
   ไปที่ Supabase Dashboard > Project Settings > API > Regenerate service_role key  
   แล้วอัปเดต environment variable ทุกที่ที่ใช้

2. **ทดสอบ EXECUTIVE company switcher** — login ด้วย account EXECUTIVE แล้วเช็คว่าเห็น dropdown บริษัทครบ

3. **ตั้ง shift ให้ Plant1** — shift "Routine" ถูกลบไปแล้ว หากต้องการใช้ต้อง Add Shift ใหม่ใน Admin

---

*เอกสารนี้ generate จาก codebase จริง ณ วันที่ 2026-05-15*  
*สำหรับรายละเอียด migration แต่ละตัว ดูที่ `supabase/migrations/`*
