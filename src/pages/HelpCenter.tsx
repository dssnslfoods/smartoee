import { useState, useRef, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  HelpCircle,
  Search,
  BookOpen,
  Users,
  LayoutDashboard,
  Factory,
  ClipboardCheck,
  BarChart3,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Monitor,
  ScrollText,
  FileDown,
  ClipboardList,
  CalendarDays,
  Calculator,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Help content data – mirrors the generated manual                  */
/* ------------------------------------------------------------------ */

interface HelpSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  items: { q: string; a: string }[];
}

const helpSections: HelpSection[] = [
  /* -------- System Overview -------- */
  {
    id: "overview",
    title: "ภาพรวมระบบ",
    icon: BookOpen,
    items: [
      {
        q: "ระบบ PNF OEE คืออะไร?",
        a: "PNF OEE System เป็นแอปพลิเคชันเว็บสำหรับติดตามประสิทธิภาพการผลิตแบบ Real-time โดยวัดผลจากตัวชี้วัด 3 ตัวหลัก ได้แก่ Availability (อัตราการใช้งาน), Performance (ประสิทธิภาพ) และ Quality (คุณภาพ) ซึ่งรวมกันเป็นค่า OEE = A × P × Q ระบบรองรับการจัดการหลายบริษัท หลายโรงงาน และหลายไลน์การผลิตในระบบเดียว",
      },
      {
        q: "ใครควรใช้ระบบนี้?",
        a: "ผู้ใช้งานแบ่งเป็น 4 กลุ่ม ได้แก่ (1) Staff/Operator - บันทึกเหตุการณ์การผลิตและจำนวนผลิต (2) Supervisor - ตรวจสอบ อนุมัติ ล็อคกะ จัดการข้อมูลหลักด้านการผลิต (3) Executive - ดู Dashboard วิเคราะห์ภาพรวม (4) Admin - ตั้งค่าโครงสร้างระบบและจัดการข้อมูลหลัก",
      },
      {
        q: "ขั้นตอนการทำงานหลักของระบบเป็นอย่างไร?",
        a: "Admin ตั้งค่าข้อมูลหลัก (โรงงาน, ไลน์, เครื่องจักร, สินค้า) → สร้างบัญชีผู้ใช้ → Supervisor กำหนดสิทธิ์เครื่องจักร, ตั้งค่ากะ, Planned Production Time, มาตรฐานการผลิต → Staff บันทึกเหตุการณ์และจำนวนผลิตบน Shopfloor → Supervisor ตรวจสอบ Preview → คำนวณ OEE → อนุมัติ → ล็อคกะ → Executive ดู Dashboard วิเคราะห์",
      },
      {
        q: "ระบบมีข้อจำกัดอะไรบ้าง?",
        a: "ระบบทำงานบนเว็บเบราว์เซอร์เท่านั้น (ไม่มี Mobile App), ต้องใช้อินเทอร์เน็ตตลอดเวลา, ผู้ใช้ไม่สามารถสมัครเองได้ต้องให้ Admin สร้างบัญชีให้, ระบบทำงานตามกะ (Shift-based) ต้องตั้งค่าตารางกะก่อนใช้งาน, RUN event ผูกกับสินค้า 1 รายการ, ระบบบังคับไม่ให้บันทึกข้อมูลนอกเวลากะ",
      },
    ],
  },

  /* -------- OEE Calculation Formulas -------- */
  {
    id: "oee-formulas",
    title: "สูตรการคำนวณ OEE",
    icon: BarChart3,
    badge: "สำคัญ",
    items: [
      {
        q: "OEE คืออะไร? คำนวณอย่างไร?",
        a: "OEE (Overall Equipment Effectiveness) คือดัชนีชี้วัดประสิทธิภาพโดยรวมของเครื่องจักร คำนวณจาก 3 ปัจจัยคูณกัน:\n\nOEE = Availability × Performance × Quality\n\nตัวอย่าง: A = 90%, P = 85%, Q = 98%\nOEE = 0.90 × 0.85 × 0.98 = 74.97%\n\nระดับมาตรฐาน:\n• World Class: ≥ 85%\n• Acceptable: 60–84%\n• Needs Improvement: < 60%",
      },
      {
        q: "Availability (A) คำนวณอย่างไร?",
        a: "Availability วัดสัดส่วนเวลาที่เครื่องจักรทำงานจริงเทียบกับเวลาที่วางแผนไว้\n\nสูตร: A = Run Time / Planned Production Time × 100%\n\n• Run Time = ผลรวมระยะเวลาของเหตุการณ์ RUN ทั้งหมดในกะ (นาที)\n• Planned Production Time = ระยะเวลากะ − เวลาหักแผนล่วงหน้า (พัก, ประชุม, ซ่อมบำรุง, อาหาร, อื่นๆ)\n\nตัวอย่าง: กะ 8 ชม. (480 นาที) หักพัก 30 นาที หักประชุม 15 นาที\nPlanned Production Time = 480 − 30 − 15 = 435 นาที\nRun Time = 400 นาที\nA = 400 / 435 × 100% = 91.95%\n\nหมายเหตุ: หากไม่มีการตั้งค่า Planned Production Time Template จะใช้ค่าเวลาเต็มจาก Shift Calendar",
      },
      {
        q: "Performance (P) คำนวณอย่างไร?",
        a: "Performance วัดความเร็วจริงของการผลิตเทียบกับความเร็วอุดมคติ\n\nสูตร: P = Total Produced / (Output Rate × Run Time) × 100%\n\n• Total Produced = Good Qty + Reject Qty (จำนวนผลิตทั้งหมด)\n• Output Rate = จำนวนชิ้นที่ควรผลิตได้ต่อนาที (ชิ้น/นาที) — ดึงจาก Production Standard ของคู่เครื่องจักร-SKU ถ้าไม่มีจะใช้ค่า Default ของเครื่องจักร\n• Run Time = เวลาทำงานจริง (นาที)\n\nตัวอย่าง: ผลิตได้ 800 ชิ้น, Output Rate = 2.4 ชิ้น/นาที, Run Time = 400 นาที\nP = 800 / (2.4 × 400) × 100% = 83.33%\n\n💡 Output Rate คำนวณจาก: 60 / Ideal Cycle Time (วินาที)\nเช่น Ideal Cycle Time = 25 วินาที → Output Rate = 60 / 25 = 2.4 ชิ้น/นาที\n\nหมายเหตุ: หากมีหลาย SKU ในกะเดียวกัน ระบบจะคำนวณ Weighted Average Output Rate ตามสัดส่วนเวลาผลิตของแต่ละ SKU",
      },
      {
        q: "Quality (Q) คำนวณอย่างไร?",
        a: "Quality วัดสัดส่วนชิ้นงานดีเทียบกับจำนวนผลิตทั้งหมด\n\nสูตร: Q = Good Qty / Total Produced × 100%\n\n• Good Qty = จำนวนชิ้นงานดีที่ผ่านมาตรฐาน\n• Total Produced = Good Qty + Reject Qty\n\nตัวอย่าง: Good = 780 ชิ้น, Reject = 20 ชิ้น\nQ = 780 / (780 + 20) × 100% = 97.5%\n\nหมายเหตุ: หาก Total Produced = 0 ระบบจะคำนวณ Quality = 100% (ไม่มีของเสีย)",
      },
      {
        q: "Output Rate คืออะไร? ต่างจาก Ideal Cycle Time อย่างไร?",
        a: "Output Rate คือจำนวนชิ้นงานที่ควรผลิตได้ต่อนาที เป็นการแสดงผล Ideal Cycle Time ในรูปแบบที่เข้าใจง่ายกว่า\n\nสูตรแปลง: Output Rate = 60 / Ideal Cycle Time (วินาที)\n\nตัวอย่าง: Ideal Cycle Time = 3 วินาที/ชิ้น\nOutput Rate = 60 / 3 = 20 ชิ้น/นาที\n\nในระบบ PNF OEE ทุกหน้าจอ (เครื่องจักร, มาตรฐาน, Shopfloor) จะแสดงเป็น Output Rate (ชิ้น/นาที) แทน Ideal Cycle Time แต่ฐานข้อมูลยังจัดเก็บเป็นวินาทีเสมอ ค่าที่แสดงจะปัดเป็นจำนวนเต็ม",
      },
      {
        q: "Planned Production Time คำนวณอย่างไร?",
        a: "Planned Production Time (PPT) คือเวลาที่วางแผนไว้สำหรับผลิตจริง หลังหักเวลาที่ไม่ได้ผลิตตามแผน\n\nสูตร: PPT = ระยะเวลากะ − (พัก + อาหาร + ประชุม + ซ่อมบำรุง + อื่นๆ)\n\nตัวอย่าง: กะ 8 ชม. (480 นาที)\n• พัก: 20 นาที\n• อาหาร: 30 นาที\n• ประชุม: 15 นาที\n• ซ่อมบำรุง: 10 นาที\nPPT = 480 − (20 + 30 + 15 + 10) = 405 นาที\n\nPPT ตั้งค่าที่ระดับ Plant + Shift ผ่าน Planned Time Template บน Supervisor Dashboard ระบบตรวจสอบว่าเวลาหักรวมไม่เกินระยะเวลากะ",
      },
      {
        q: "ระบบคำนวณ OEE เมื่อมีหลาย SKU ในกะเดียวกันอย่างไร?",
        a: "เมื่อเครื่องจักรผลิตหลาย SKU ในกะเดียว ระบบใช้ Weighted Average Ideal Cycle Time:\n\n1. สำหรับแต่ละ RUN event ระบบหา Ideal Cycle Time จาก Production Standard ของคู่เครื่องจักร-SKU นั้น\n2. ถ้าไม่มี Standard จะใช้ค่า Default ของเครื่องจักร\n3. คำนวณ Weighted Average โดยถ่วงน้ำหนักตามระยะเวลา RUN ของแต่ละ SKU\n\nสูตร: Weighted ICT = Σ(ICTᵢ × Durationᵢ) / Σ(Durationᵢ)\n\nจากนั้นนำ Weighted ICT ไปใช้ในสูตร Performance ตามปกติ",
      },
      {
        q: "Six Big Losses คืออะไร? เกี่ยวกับ OEE อย่างไร?",
        a: "Six Big Losses เป็นกรอบการวิเคราะห์ความสูญเสียที่สัมพันธ์กับ OEE 3 ตัว:\n\nAvailability Losses:\n1. Breakdown (เครื่องเสีย) — หยุดกะทันหัน\n2. Setup/Changeover (ตั้งเครื่อง/เปลี่ยนรุ่น) — หยุดตามแผน\n\nPerformance Losses:\n3. Small Stops (หยุดเล็กน้อย) — หยุดสั้นๆ บ่อยๆ\n4. Slow Cycles (เครื่องทำงานช้า) — ผลิตช้ากว่าอุดมคติ\n\nQuality Losses:\n5. Startup Rejects (ของเสียช่วงเริ่มเครื่อง)\n6. Production Rejects (ของเสียระหว่างผลิต)\n\nในระบบ PNF OEE สามารถดู Loss Category ได้บน Executive Dashboard ผ่าน Pareto Chart และ Loss Category Breakdown",
      },
      {
        q: "OEE ระดับ Line และ Plant คำนวณอย่างไร?",
        a: "OEE ระดับ Line: คำนวณจากค่าเฉลี่ยของ OEE ทุกเครื่องจักรในไลน์นั้น\nOEE ระดับ Plant: คำนวณจากค่าเฉลี่ยของ OEE ทุกเครื่องจักรในโรงงานนั้น\n\nค่า A, P, Q ของแต่ละระดับเป็นค่าเฉลี่ยของเครื่องจักรในกลุ่ม ไม่ใช่การคูณค่าเฉลี่ยของ A × P × Q\n\nข้อมูล Snapshot จะถูกบันทึกที่ 3 ระดับ: MACHINE, LINE, PLANT ทุกครั้งที่ Supervisor คำนวณ OEE",
      },
    ],
  },

  /* -------- Roles & Permissions -------- */
  {
    id: "roles",
    title: "บทบาทและสิทธิ์การใช้งาน",
    icon: Users,
    items: [
      {
        q: "บทบาท STAFF ทำอะไรได้บ้าง?",
        a: "Staff สามารถ: เริ่ม/หยุดเหตุการณ์การผลิต (RUN, DOWNTIME, SETUP) บนเครื่องจักรที่มีสิทธิ์ บันทึกจำนวนผลิต (Good/Reject) ดู Timeline เหตุการณ์ ดู Dashboard แบบพื้นฐาน (ไม่มีตัวกรองช่วงเวลา) ดู Recent Activity เฉพาะของตนเอง และดูหน้ารอบันทึกจำนวนผลิต (Pending Counts) ไม่สามารถเข้าหน้า Supervisor, Executive หรือ Admin ได้",
      },
      {
        q: "บทบาท SUPERVISOR ทำอะไรได้บ้าง?",
        a: "Supervisor มีสิทธิ์ทุกอย่างเหมือน Staff เพิ่มเติม: เข้าถึงเครื่องจักรทั้งหมดในบริษัทโดยอัตโนมัติ ตรวจสอบ/คำนวณ OEE/อนุมัติ/ล็อคกะ สร้างบัญชี Staff และ Supervisor ใหม่ เปลี่ยนบทบาทระหว่าง Staff กับ Supervisor ได้ จัดการกลุ่มสิทธิ์เครื่องจักร สร้างมาตรฐานการผลิต ดู Audit Log จัดการวันหยุด (Holidays) และคลิกชื่อเครื่องจักรใน Warning เพื่อไปยังหน้ารอบันทึกจำนวนผลิตได้โดยตรง",
      },
      {
        q: "บทบาท EXECUTIVE ทำอะไรได้บ้าง?",
        a: "Executive เป็นบทบาทอ่านอย่างเดียว (Read-only) สามารถดู Dashboard ด้วยตัวกรองช่วงเวลา ดู Executive Dashboard (Snapshot, Trend, Pareto, Ranking, Loss Category, Attention Panel) ดู Monitor และ Recent Activity แต่ไม่สามารถบันทึกหรือแก้ไขข้อมูลใดๆ",
      },
      {
        q: "บทบาท ADMIN ทำอะไรได้บ้าง?",
        a: "Admin มีสิทธิ์เต็มในระบบ: จัดการบริษัท โรงงาน ไลน์ เครื่องจักร สินค้า มาตรฐานการผลิต สาเหตุหยุดเครื่อง/ของเสีย วันหยุด จัดการบัญชีผู้ใช้ทุกบทบาท กำหนดสิทธิ์ Import/Export ข้อมูล ดู Activity Log และเลือกบริษัทที่ต้องการจัดการได้",
      },
      {
        q: "สิทธิ์การเข้าถึงเครื่องจักรทำงานอย่างไร?",
        a: "Staff ต้องได้รับมอบสิทธิ์เฉพาะเจาะจง (ผ่านสิทธิ์เดี่ยวหรือกลุ่มสิทธิ์) ส่วน Supervisor และ Admin เข้าถึงเครื่องจักรทั้งหมดในบริษัทโดยอัตโนมัติ การตรวจสอบสิทธิ์ทั้งหมดถูกบังคับที่ระดับฐานข้อมูล ไม่สามารถข้ามได้จากหน้าจอ",
      },
    ],
  },

  /* -------- Login / Auth -------- */
  {
    id: "login",
    title: "การเข้าสู่ระบบ",
    icon: Shield,
    items: [
      {
        q: "วิธีเข้าสู่ระบบ",
        a: "เปิด URL ระบบในเบราว์เซอร์ → กรอก Email และ Password → กดปุ่ม Sign In → ระบบจะนำทางไปที่ Dashboard โดยอัตโนมัติ (Admin จะต้องเลือกบริษัทก่อน)",
      },
      {
        q: "ลืมรหัสผ่านทำอย่างไร?",
        a: "ระบบไม่มีฟีเจอร์ Reset Password ด้วยตนเอง กรุณาติดต่อ Supervisor หรือ Admin เพื่อเปลี่ยนรหัสผ่านให้",
      },
      {
        q: "วิธีออกจากระบบ",
        a: "กดไอคอน Logout (ลูกศรชี้ขวา) ที่มุมล่างซ้ายของ Sidebar ข้างชื่อผู้ใช้ ระบบจะล้าง Session และนำทางกลับไปหน้า Login",
      },
      {
        q: "Admin เลือกบริษัทอย่างไร?",
        a: "หลังจาก Login สำเร็จ จะแสดงหน้าเลือกบริษัท กดเลือกบริษัทที่ต้องการจัดการ สามารถเปลี่ยนบริษัทภายหลังได้จาก Company Switcher ใน Sidebar",
      },
    ],
  },

  /* -------- Dashboard -------- */
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      {
        q: "Dashboard แสดงอะไรบ้าง?",
        a: "Dashboard แสดง: (1) OEE Gauge รวม (World Class ≥85%, Acceptable 60-84%, Needs Improvement <60%) (2) Gauge แยก A/P/Q (3) สรุปสถานะเครื่องจักร (Running/Idle/Stopped/Maintenance) (4) กราฟ OEE Trend (5) Grid เครื่องจักรทั้งหมด พร้อมตัวกรองโรงงาน (Plant) และสายการผลิต (Line) แบบ Cascading",
      },
      {
        q: "วิธีดูรายละเอียดเครื่องจักร",
        a: "กดที่การ์ดเครื่องจักรใดก็ได้ จะเปิดหน้ารายละเอียดแสดง: OEE A/P/Q แยก, สถิติการผลิต (Good/Reject, Run Time/Downtime), กราฟ OEE ย้อนหลัง 7 หรือ 30 วัน",
      },
      {
        q: "ตัวกรองช่วงเวลาใช้ได้กับบทบาทใด?",
        a: "ตัวกรองช่วงเวลา (วันนี้, เมื่อวาน, 7/14/30/60 วัน) ใช้ได้เฉพาะ Supervisor, Executive และ Admin เท่านั้น Staff จะเห็นเฉพาะข้อมูลวันปัจจุบัน",
      },
      {
        q: "Fullscreen และ Kiosk Mode คืออะไร?",
        a: "Fullscreen ขยายเต็มจอ กด Escape เพื่อออก Kiosk Mode ออกแบบสำหรับ TV Display จะซ่อนปุ่มควบคุมทั้งหมด แสดงเฉพาะข้อมูล พร้อมนาฬิกาและตัวนับถอยหลังการรีเฟรชทุก 30 วินาที",
      },
    ],
  },

  /* -------- Shopfloor -------- */
  {
    id: "shopfloor",
    title: "Shopfloor (บันทึกเหตุการณ์)",
    icon: Factory,
    items: [
      {
        q: "วิธีเริ่มบันทึกเหตุการณ์",
        a: "ขั้นตอน: (1) เลือกโรงงาน → (2) เลือกไลน์ → (3) เลือกเครื่องจักร → (4) เลือกสินค้า/SKU → (5) กดปุ่ม Start Run (เริ่มผลิต), Downtime (หยุดเครื่อง) หรือ Setup (ตั้งเครื่อง)",
      },
      {
        q: "ทำไมต้องเลือก SKU ก่อนกด Start Run?",
        a: 'ระบบต้องรู้ว่ากำลังผลิตสินค้าอะไร เพื่อใช้ Output Rate (Ideal Cycle Time) ของสินค้านั้นในการคำนวณ Performance ของ OEE ถ้าไม่เลือก SKU ระบบจะแจ้งเตือน "กรุณาเลือก SKU ก่อนเริ่มงาน" เมื่อเลือก SKU จะแสดง Output Rate (ชิ้น/นาที) ของคู่เครื่องจักร-SKU นั้น',
      },
      {
        q: "เปลี่ยน SKU ระหว่างผลิตได้หรือไม่?",
        a: "ได้ เมื่อเปลี่ยน SKU ขณะ RUN อยู่ ระบบจะหยุด Session เดิมโดยอัตโนมัติและเริ่ม Session ใหม่กับ SKU ใหม่ทันที",
      },
      {
        q: "วิธีบันทึกจำนวนผลิต",
        a: 'ในส่วน "บันทึกจำนวนผลิต": กรอกจำนวนดี (Good Qty) → กรอกจำนวนเสีย (Reject Qty, ค่าเริ่มต้น 0) → เลือกสาเหตุของเสีย (ถ้ามี) → เพิ่มหมายเหตุ (ไม่บังคับ) → กด Submit',
      },
      {
        q: "ถ้ากะถูกล็อคแล้วจะเกิดอะไรขึ้น?",
        a: 'จะมีแถบสีแดงแสดงว่า "กะถูกล็อค" คุณจะไม่สามารถบันทึกเหตุการณ์ใหม่ แก้ไข หรือลบข้อมูลของกะนั้นได้ ข้อจำกัดนี้บังคับที่ระดับฐานข้อมูล',
      },
      {
        q: '"เครื่องจักรของฉัน" แท็บคืออะไร?',
        a: 'แท็บ "เครื่องจักรของฉัน" แสดงเครื่องจักรทั้งหมดที่คุณมีสิทธิ์เข้าถึง พร้อมสถานะปัจจุบัน (Running/Idle/Stopped/Setup) ใช้ดูภาพรวมได้โดยไม่ต้องเลือกทีละเครื่อง',
      },
      {
        q: "Production Benchmark Card แสดงอะไร?",
        a: "เมื่อเลือกเครื่องจักรและ SKU แล้ว Benchmark Card จะแสดง: Output Rate (ชิ้น/นาที), Standard Setup Time, Target Quality ดึงจากตาราง Production Standards ถ้าไม่มีค่ามาตรฐานเฉพาะคู่เครื่องจักร-SKU จะแสดงค่า Default ของเครื่องจักร Supervisor สามารถสร้างมาตรฐานใหม่ได้โดยตรงจากหน้า Shopfloor",
      },
    ],
  },

  /* -------- Monitor -------- */
  {
    id: "monitor",
    title: "Production Monitor",
    icon: Monitor,
    items: [
      {
        q: "หน้า Monitor ใช้ทำอะไร?",
        a: "หน้า Monitor แสดงสถานะเครื่องจักรทั้งหมดแบบ Real-time เหมาะสำหรับแสดงบน TV หรือจอขนาดใหญ่ในโรงงาน มีไฟ Live สีเขียวกะพริบแสดงว่าข้อมูลอัปเดตอัตโนมัติ",
      },
      {
        q: "สามารถกรองเครื่องจักรได้หรือไม่?",
        a: "ได้ สามารถกรองตาม: โรงงาน (Plant), สายการผลิต (Line) แบบ Cascading (เลือก Plant แล้ว Line จะแสดงเฉพาะใน Plant นั้น) และ สถานะ (Running/Stopped/Setup/Idle) ตัวกรองจะซ่อนเมื่ออยู่ใน Kiosk Mode",
      },
    ],
  },

  /* -------- Pending Counts -------- */
  {
    id: "pendingcounts",
    title: "รอบันทึกจำนวนผลิต (Pending Counts)",
    icon: ClipboardList,
    items: [
      {
        q: "หน้ารอบันทึกจำนวนผลิตคืออะไร?",
        a: "หน้านี้แสดงรายการเหตุการณ์ RUN ที่จบแล้วแต่ยังไม่ได้บันทึกจำนวนผลิต (Good/Reject Qty) ช่วยให้มั่นใจว่าข้อมูลการผลิตครบถ้วนก่อนที่ Supervisor จะคำนวณ OEE และอนุมัติกะ",
      },
      {
        q: "วิธีบันทึกจำนวนผลิตจากหน้านี้",
        a: "คลิกที่เหตุการณ์ที่ต้องการ → ระบบจะเปิดฟอร์มบันทึกจำนวนผลิต → กรอก Good Qty และ Reject Qty → เลือกสาเหตุของเสีย (ถ้ามี) → กด Submit เหตุการณ์จะหายจากรายการเมื่อบันทึกเสร็จ",
      },
      {
        q: "Supervisor สามารถเข้าหน้านี้จากหน้า Supervisor ได้อย่างไร?",
        a: "เมื่อ Supervisor พยายามอนุมัติกะ หากมีเหตุการณ์ RUN ที่ยังไม่ได้บันทึกจำนวนผลิต ระบบจะแสดง Warning พร้อมชื่อเครื่องจักรที่คลิกได้ คลิกที่ชื่อเครื่องจักรจะนำทางมายังหน้ารอบันทึกจำนวนผลิตโดยกรองเฉพาะเครื่องจักรนั้น พร้อมปุ่ม 'กลับหน้า Supervisor' เพื่อกลับไปดำเนินการต่อ",
      },
    ],
  },

  /* -------- Supervisor -------- */
  {
    id: "supervisor",
    title: "Supervisor Dashboard",
    icon: ClipboardCheck,
    items: [
      {
        q: "Supervisor Dashboard ประกอบด้วยอะไรบ้าง?",
        a: "ประกอบด้วยหลายแท็บ: (1) สรุปกะ - ดู OEE, อนุมัติ/ล็อคกะ พร้อมปฏิทินแสดงสถานะรายวัน (2) กลุ่มสิทธิ์ - จัดการ Permission Group (3) จัดการพนักงาน - สร้าง/แก้ไขบัญชี Staff และ Supervisor รวมถึงเปลี่ยนบทบาทได้ (4) Audit Log - ดูประวัติการเปลี่ยนแปลงข้อมูล (5) ข้อมูลหลัก - กะทำงาน, เวลาวางแผน, เครื่องจักร, สินค้า, มาตรฐาน, วันหยุด",
      },
      {
        q: "ขั้นตอนการปิดกะ (Shift Workflow) เป็นอย่างไร?",
        a: 'ขั้นตอน: (1) เลือกโรงงาน (2) ตรวจสอบข้อมูลกะ (3) ตรวจสอบว่าไม่มีเหตุการณ์ที่รอบันทึกจำนวนผลิต (ถ้ามี คลิกชื่อเครื่องจักรเพื่อไปกรอกข้อมูล) (4) กดปุ่ม "คำนวณ OEE" → ตรวจสอบ Timeline Preview → ยืนยัน (5) กด "อนุมัติกะ" (6) กด "ล็อคกะ" เพื่อป้องกันการแก้ไขย้อนหลัง',
      },
      {
        q: "ทำไมต้อง Preview ก่อนคำนวณ OEE?",
        a: "เพื่อให้ Supervisor ตรวจสอบความถูกต้องของข้อมูลก่อนคำนวณ Preview แสดง Timeline ของเหตุการณ์ (RUN/DOWNTIME/SETUP) และจำนวนผลิตทั้งหมดในกะ รวมถึงระยะเวลาและปริมาณรวม ช่วยลดข้อผิดพลาดก่อนบันทึกผลลัพธ์",
      },
      {
        q: "วิธีสร้าง Permission Group",
        a: 'ไปที่แท็บ "กลุ่มสิทธิ์" → กด "สร้างกลุ่ม" → ตั้งชื่อกลุ่มและคำอธิบาย → เลือกเครื่องจักรที่ต้องการรวมในกลุ่ม → กำหนดพนักงาน (Staff) เข้ากลุ่ม ประโยชน์: ไม่ต้องกำหนดสิทธิ์ทีละเครื่องทีละคน',
      },
      {
        q: "Supervisor จัดการบัญชีพนักงานอย่างไร?",
        a: 'ไปที่แท็บ "จัดการพนักงาน" → กดปุ่มเพิ่มพนักงาน → กรอกชื่อ, Email, รหัสผ่าน → บัญชีจะถูกสร้างในบริษัทเดียวกับ Supervisor โดยอัตโนมัติ Supervisor สามารถแก้ไข Email, ชื่อ, รหัสผ่าน และเปลี่ยนบทบาทระหว่าง Staff กับ Supervisor ได้',
      },
      {
        q: "ปฏิทินกะแสดงสถานะอย่างไร?",
        a: "ปฏิทินในแท็บสรุปกะแสดงสถานะรายวันด้วยสี: เขียว = อนุมัติแล้ว, เหลือง = ร่าง (DRAFT), แดง = ล็อคแล้ว, เทา = วันหยุด/ไม่มีการผลิต ระบบตรวจสอบทั้งข้อมูล OEE และเหตุการณ์การผลิตเพื่อแยกวันหยุดจริงออกจากวันที่มีการผลิตแต่ยังไม่ได้คำนวณ OEE",
      },
      {
        q: "วิธีจัดการวันหยุด (Holidays)",
        a: 'ไปที่แท็บ "วันหยุด" บน Supervisor Dashboard → กดเพิ่มวันหยุด → กรอกชื่อ, วันที่, คำอธิบาย → เลือกโรงงาน (ถ้าต้องการกำหนดเฉพาะโรงงาน) → เลือกว่าเป็นวันหยุดประจำปีหรือไม่ วันหยุดจะแสดงบนปฏิทินกะเพื่อช่วยในการวางแผน',
      },
    ],
  },

  /* -------- Executive -------- */
  {
    id: "executive",
    title: "Executive Dashboard",
    icon: BarChart3,
    items: [
      {
        q: "Executive Dashboard ประกอบด้วยอะไรบ้าง?",
        a: "แสดง 6 ส่วน: (1) KPI Snapshot - OEE/A/P/Q พร้อม Delta เปรียบเทียบ (2) OEE Trend Chart - กราฟแนวโน้มรายวัน (3) Top Losses Pareto - สาเหตุหยุดเครื่อง Top 5 (4) Line Ranking - จัดอันดับประสิทธิภาพรายไลน์ (5) Loss Category - จำแนกความสูญเสียตามประเภท (6) Attention Panel - จุดเสี่ยงที่ต้องดำเนินการ",
      },
      {
        q: "ข้อมูล Executive Dashboard มาจากไหน?",
        a: "ข้อมูลทั้งหมดดึงจากตาราง oee_snapshots (ที่ Supervisor คำนวณแล้ว) และ production_events (สำหรับ Pareto/Loss Category) ข้อมูลจะถูกต้องก็ต่อเมื่อ Supervisor ได้คำนวณ OEE และอนุมัติกะเรียบร้อยแล้ว",
      },
      {
        q: "สามารถแสดงบนจอ TV ได้หรือไม่?",
        a: "ได้ ใช้ Kiosk Mode จะซ่อนปุ่มควบคุมทั้งหมด แสดงเฉพาะข้อมูล พร้อมรีเฟรชอัตโนมัติทุก 30 วินาที มีนาฬิกาและตัวนับถอยหลังให้ทราบความสดใหม่ของข้อมูล",
      },
    ],
  },

  /* -------- Admin Setup -------- */
  {
    id: "admin",
    title: "Admin Setup (ตั้งค่าระบบ)",
    icon: Settings,
    badge: "Admin",
    items: [
      {
        q: "Admin Setup มีแท็บอะไรบ้าง?",
        a: "มี 6 แท็บหลัก: Users (ผู้ใช้), Companies (บริษัท), Plants (โรงงาน), Lines (ไลน์), Downtime (สาเหตุหยุดเครื่อง), Defects (สาเหตุของเสีย) ส่วนข้อมูลเกี่ยวกับการผลิต (Machines, Products, Standards, Shifts, Planned Time, Holidays) จัดการบน Supervisor Dashboard",
      },
      {
        q: "วิธีสร้างบัญชีผู้ใช้ใหม่",
        a: "ไปที่แท็บ Users → กดเพิ่มผู้ใช้ → กรอก: ชื่อ, Email (ต้องไม่ซ้ำ), รหัสผ่าน (อย่างน้อย 6 ตัวอักษร), บทบาท (STAFF/SUPERVISOR/EXECUTIVE/ADMIN), บริษัท (บังคับยกเว้น Admin) → กดบันทึก",
      },
      {
        q: "Machine มีฟิลด์อะไรสำคัญบ้าง?",
        a: "ฟิลด์สำคัญ: ชื่อ, Code (ต้อง Unique), ไลน์, Output Rate (ชิ้น/นาที — ระบบแปลงเป็น Ideal Cycle Time เก็บในฐานข้อมูลเป็นวินาทีอัตโนมัติ), Target OEE/A/P/Q (เป้าหมาย OEE เฉพาะเครื่อง) ค่าเป้าหมายจะแสดงเปรียบเทียบกับค่าจริงใน Dashboard",
      },
      {
        q: "Production Standards คืออะไร?",
        a: "มาตรฐานการผลิตคือค่า Output Rate (ชิ้น/นาที), Setup Time, Target Quality สำหรับคู่เครื่องจักร-สินค้าเฉพาะ ถ้ามีค่ามาตรฐานจะใช้แทนค่า Default ของเครื่องจักรในการคำนวณ Performance ของ OEE Supervisor สามารถสร้างมาตรฐานได้ทั้งจากแท็บมาตรฐานและจากหน้า Shopfloor โดยตรง (Inline Standard Dialog)",
      },
      {
        q: "Downtime Category มีประเภทอะไรบ้าง?",
        a: "มี 4 ประเภท: PLANNED (หยุดตามแผน เช่น พักเครื่อง), UNPLANNED (หยุดไม่มีแผน เช่น ขาดวัตถุดิบ), BREAKDOWN (เครื่องเสีย), CHANGEOVER (เปลี่ยนรุ่นสินค้า) ประเภทเหล่านี้ใช้ในการวิเคราะห์ Loss Category บน Executive Dashboard",
      },
      {
        q: "สามารถ Import/Export ข้อมูลได้หรือไม่?",
        a: "ได้ รองรับ Import จากไฟล์ Excel (.xlsx) หรือ CSV โดยจับคู่ด้วย Code (ไม่สนตัวพิมพ์เล็ก/ใหญ่) และ Export เป็น Excel หรือ CSV ไฟล์ Excel จะมีการจัดรูปแบบสีตามระดับ OEE (เขียว/เหลือง/แดง)",
      },
    ],
  },

  /* -------- Recent Activity & Activity Log -------- */
  {
    id: "activity",
    title: "Recent Activity & Activity Log",
    icon: ScrollText,
    items: [
      {
        q: "Recent Activity กับ Activity Log ต่างกันอย่างไร?",
        a: "Recent Activity เป็นหน้าที่ทุก Role เข้าถึงได้ แสดงกิจกรรมในรูปแบบเข้าใจง่าย จัดกลุ่มเป็น Session ส่วน Activity Log เข้าถึงได้เฉพาะ Admin แสดงข้อมูล Audit Trail แบบดิบพร้อม Before/After JSON สำหรับตรวจสอบเชิงเทคนิค",
      },
      {
        q: "Staff เห็นกิจกรรมของคนอื่นไหม?",
        a: 'ไม่ Staff เห็นเฉพาะกิจกรรมที่ตัวเองบันทึกเท่านั้น มี Badge "แสดงเฉพาะของคุณ" ยืนยัน Supervisor และ Admin เห็นกิจกรรมของทุกคนในบริษัท',
      },
      {
        q: "สามารถแก้ไข/ลบบันทึกจาก Recent Activity ได้หรือไม่?",
        a: "ได้ Staff แก้ไข/ลบได้เฉพาะบันทึกของตนเอง (ถ้ากะยังไม่ล็อค) Supervisor และ Admin แก้ไข/ลบได้ทุกบันทึกในบริษัท Toggle Chips ช่วยกรองประเภทกิจกรรม",
      },
    ],
  },

  /* -------- Troubleshooting -------- */
  {
    id: "troubleshooting",
    title: "ปัญหาที่พบบ่อยและวิธีแก้",
    icon: AlertTriangle,
    items: [
      {
        q: 'Login ไม่สำเร็จ แสดง "Failed to sign in"',
        a: "ตรวจสอบ Email และ Password ให้ถูกต้อง ถ้าลืมรหัสผ่านให้ติดต่อ Supervisor หรือ Admin เพื่อรีเซ็ต ตรวจสอบว่าบัญชียังเปิดใช้งานอยู่",
      },
      {
        q: "ไม่เห็นเครื่องจักรบน Shopfloor",
        a: "สาเหตุที่พบบ่อย: (1) ยังไม่ได้รับสิทธิ์เครื่องจักร - ติดต่อ Supervisor (2) ไม่ได้เลือกโรงงานและไลน์ (3) เครื่องจักรถูก Deactivate - ติดต่อ Admin",
      },
      {
        q: "OEE แสดง 0% บน Dashboard",
        a: 'OEE = 0% หมายความว่ายังไม่ได้คำนวณ OEE สำหรับกะนั้น Supervisor ต้องไปที่ Supervisor Dashboard เลือกโรงงาน แล้วกด "คำนวณ OEE" สำหรับกะที่ต้องการ',
      },
      {
        q: 'ไม่สามารถบันทึกเหตุการณ์ได้ แสดง "Failed to start event"',
        a: "สาเหตุที่เป็นไปได้: (1) กะถูกล็อคแล้ว (2) ไม่มีกะที่ Active ในขณะนั้น (3) ไม่มีสิทธิ์เข้าถึงเครื่องจักร ตรวจสอบแถบสถานะกะและติดต่อ Supervisor",
      },
      {
        q: "Executive Dashboard ไม่แสดงข้อมูล",
        a: "ตรวจสอบว่า: (1) มี OEE Snapshot ในช่วงเวลาที่เลือก (7/14/30 วัน) (2) Supervisor ได้คำนวณ OEE และอนุมัติกะเรียบร้อยแล้ว (3) มีข้อมูลการผลิตจริงในช่วงเวลานั้น",
      },
      {
        q: "ปฏิทินแสดงเป็นวันหยุดทั้งที่มีการผลิต",
        a: "สาเหตุที่เป็นไปได้: Supervisor ยังไม่ได้คำนวณ OEE สำหรับกะนั้น ระบบตรวจสอบทั้งข้อมูล OEE และเหตุการณ์การผลิต แต่หากยังไม่มีทั้งสองอย่าง จะแสดงเป็นวันหยุด กรุณาคำนวณ OEE เพื่อให้ปฏิทินแสดงสถานะที่ถูกต้อง",
      },
      {
        q: "ลองทำอะไรก่อนแจ้ง IT?",
        a: "1. รีเฟรชหน้า 2. ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต 3. ลองเบราว์เซอร์อื่น (Chrome/Firefox/Edge) 4. ล้าง Cache เบราว์เซอร์ 5. ตรวจสอบว่าคนอื่นมีปัญหาเหมือนกันไหม 6. จด Error Message หรือถ่ายภาพหน้าจอไว้แจ้ง IT",
      },
    ],
  },

  /* -------- Best Practices -------- */
  {
    id: "bestpractices",
    title: "แนวปฏิบัติที่ดี",
    icon: CheckCircle2,
    items: [
      {
        q: "Staff ควรใช้ระบบอย่างไรให้ถูกต้อง?",
        a: "บันทึกเหตุการณ์แบบ Real-time (อย่ารอจบกะ), เลือก SKU ให้ถูกต้องก่อน Start Run, บันทึกจำนวนผลิตเป็นระยะ ไม่ต้องรอจบกะ, เลือกสาเหตุ Downtime ทุกครั้ง, ใช้ Notes เพิ่มรายละเอียดเมื่อจำเป็น, ตรวจสอบหน้ารอบันทึกจำนวนผลิตเป็นประจำ",
      },
      {
        q: "Supervisor ควรทำอะไรบ้าง?",
        a: "ตรวจสอบ Timeline Preview ก่อนคำนวณ OEE, ทำตาม Workflow ตามลำดับ (ตรวจสอบ → คำนวณ → อนุมัติ → ล็อค), ล็อคกะทันทีหลังอนุมัติ, จัดการสิทธิ์ Staff เมื่อมีคนใหม่เข้ามา, ใช้ Permission Group แทนกำหนดสิทธิ์ทีละเครื่อง, ใช้ลิงก์คลิกได้ใน Warning เพื่อไปกรอกข้อมูลที่ขาด, ตั้งค่าวันหยุดเพื่อให้ปฏิทินแม่นยำ",
      },
      {
        q: "สิ่งที่ไม่ควรทำ (Don'ts)",
        a: 'อย่ารอจบกะค่อยกรอกข้อมูลย้อนหลัง, อย่าแชร์บัญชี Login กับคนอื่น, อย่าเปิดเหตุการณ์ค้างไว้เมื่อเครื่องหยุดจริง, อย่าข้ามขั้นตอนการคำนวณก่อนอนุมัติกะ, อย่า Deactivate ข้อมูลหลักโดยไม่พิจารณาผลกระทบ, อย่าใช้สาเหตุ "อื่นๆ" ทุกครั้งสำหรับ Downtime',
      },
      {
        q: "ตารางปฏิบัติงานรายวันแนะนำ",
        a: "เริ่มกะ: Staff เลือกเครื่องจักร+SKU กด Start Run → ระหว่างกะ: บันทึกเหตุการณ์ตามจริง กรอกจำนวนผลิตเป็นระยะ → จบกะ: หยุดเหตุการณ์ทั้งหมด กรอกจำนวนผลิตสุดท้าย ตรวจสอบ Pending Counts → หลังจบกะ: Supervisor ตรวจสอบ คำนวณ OEE อนุมัติ ล็อค",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HelpCenter() {
  const { hasRole } = useAuth();
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Filter sections and items by search
  const filteredSections = helpSections
    .map((section) => {
      // If active section filter, only show that section
      if (activeSection && section.id !== activeSection) return null;
      if (!search.trim()) return section;
      const q = search.toLowerCase();
      const matchedItems = section.items.filter(
        (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
      );
      if (matchedItems.length > 0 || section.title.toLowerCase().includes(q)) {
        return { ...section, items: matchedItems.length > 0 ? matchedItems : section.items };
      }
      return null;
    })
    .filter(Boolean) as HelpSection[];

  const totalQuestions = filteredSections.reduce((sum, s) => sum + s.items.length, 0);

  const handleExportPDF = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const sectionsHTML = helpSections
      .map(
        (section, sIdx) => `
        <div class="section" ${sIdx > 0 ? 'style="page-break-before: auto;"' : ""}>
          <h2>${section.title}${section.badge ? ` <span class="badge">${section.badge}</span>` : ""}</h2>
          ${section.items
            .map(
              (item, idx) => `
            <div class="qa">
              <div class="question">${sIdx + 1}.${idx + 1} ${item.q}</div>
              <div class="answer">${item.a}</div>
            </div>`,
            )
            .join("")}
        </div>`,
      )
      .join("");

    printWindow.document.write(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>PNF OEE System - คู่มือการใช้งาน</title>
  <style>
    @page { margin: 20mm 18mm; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Sarabun', 'Noto Sans Thai', 'Segoe UI', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
    }
    .cover {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 85vh;
      text-align: center;
      page-break-after: always;
    }
    .cover h1 {
      font-size: 28pt;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 8px;
    }
    .cover .subtitle {
      font-size: 16pt;
      color: #475569;
      margin-bottom: 32px;
    }
    .cover .meta {
      font-size: 10pt;
      color: #94a3b8;
      margin-top: 48px;
    }
    .cover .line {
      width: 80px;
      height: 4px;
      background: #3b82f6;
      border-radius: 2px;
      margin: 24px auto;
    }
    /* TOC */
    .toc {
      page-break-after: always;
    }
    .toc h2 {
      font-size: 18pt;
      color: #1e3a5f;
      margin-bottom: 16px;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 8px;
    }
    .toc-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 6px 0;
      border-bottom: 1px dotted #cbd5e1;
      font-size: 11pt;
    }
    .toc-item .toc-title { font-weight: 600; color: #334155; }
    .toc-item .toc-count { color: #64748b; font-size: 9pt; }
    /* Sections */
    .section { margin-bottom: 24px; }
    .section h2 {
      font-size: 15pt;
      font-weight: 700;
      color: #1e3a5f;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 6px;
      margin-bottom: 14px;
      margin-top: 28px;
    }
    .badge {
      display: inline-block;
      background: #dbeafe;
      color: #1e40af;
      font-size: 8pt;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      vertical-align: middle;
      margin-left: 6px;
    }
    .qa {
      margin-bottom: 14px;
      padding-left: 12px;
      border-left: 3px solid #e2e8f0;
    }
    .question {
      font-weight: 700;
      font-size: 11pt;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .answer {
      font-size: 10.5pt;
      color: #475569;
      line-height: 1.7;
    }
    .footer-note {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 9pt;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>PNF OEE System</h1>
    <div class="line"></div>
    <div class="subtitle">คู่มือการใช้งานระบบ</div>
    <div class="meta">
      เวอร์ชัน 2.2<br/>
      วันที่พิมพ์: ${new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}<br/><p>
   © 2026 PNF OEE System. Designed and Developed by Arnon Arpaket. All rights reserved.
    </div>
  </div>

  <div class="toc">
    <h2>สารบัญ</h2>
    ${helpSections
      .map(
        (s, i) =>
          `<div class="toc-item"><span class="toc-title">${i + 1}. ${s.title}</span><span class="toc-count">${s.items.length} คำถาม</span></div>`,
      )
      .join("")}
  </div>

  ${sectionsHTML}

  <div class="footer-note">
    PNF OEE System — คู่มือการใช้งาน v2.2 — ${new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
  </div>
</body>
</html>`);

    printWindow.document.close();
    // Wait for content to render then trigger print
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }, []);

  // Only ADMIN, EXECUTIVE, SUPERVISOR can access
  const canAccess = hasRole("ADMIN") || hasRole("EXECUTIVE") || hasRole("SUPERVISOR");
  if (!canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <div className="page-container space-y-5 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <PageHeader title="Help Center" description="คู่มือการใช้งานระบบ PNF OEE v2.2 — รวมสูตรคำนวณ OEE" icon={HelpCircle} />
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="shrink-0 gap-2 mt-1">
            <FileDown className="h-4 w-4" />
            Export PDF
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาคำถาม เช่น วิธีเริ่มบันทึก, OEE คืออะไร, ลืมรหัสผ่าน, Pending Counts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {search.trim() && (
              <p className="text-xs text-muted-foreground mt-2">
                พบ {totalQuestions} คำถามใน {filteredSections.length} หมวด
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Navigation Chips */}
        <div className="flex flex-wrap gap-2">
          {helpSections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <Button
                key={section.id}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => setActiveSection(isActive ? null : section.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                {section.title}
                {isActive && <X className="h-3 w-3 ml-0.5" />}
              </Button>
            );
          })}
        </div>

        {/* Sections */}
        <ScrollArea className="h-[calc(100vh-320px)] min-h-[400px]">
          <div className="space-y-4 pr-3">
            {filteredSections.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>ไม่พบคำถามที่ตรงกับ "{search}"</p>
                  <p className="text-xs mt-1">ลองค้นหาด้วยคำอื่น หรือลองเลือกหมวดอื่น</p>
                </CardContent>
              </Card>
            ) : (
              filteredSections.map((section) => {
                const Icon = section.icon;
                return (
                  <Card key={section.id} className="overflow-hidden">
                    <CardHeader className="pb-2 bg-muted/30">
                      <CardTitle className="text-base flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        {section.title}
                        {section.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {section.badge}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs ml-auto">
                          {section.items.length} คำถาม
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-2">
                      <Accordion type="multiple" className="w-full">
                        {section.items.map((item, idx) => (
                          <AccordionItem key={idx} value={`${section.id}-${idx}`} className="border-b last:border-0">
                            <AccordionTrigger className="text-sm font-medium text-left py-3 hover:no-underline [&[data-state=open]]:text-primary">
                              {item.q}
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4 whitespace-pre-line">
                              {item.a}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer stats */}
        <div className="text-center text-xs text-muted-foreground pb-2">
          ทั้งหมด {helpSections.length} หมวด · {helpSections.reduce((s, sec) => s + sec.items.length, 0)} คำถาม · เวอร์ชัน 2.2
        </div>
      </div>
    </AppLayout>
  );
}
