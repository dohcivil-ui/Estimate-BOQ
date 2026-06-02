# CGD Constants — Single Source of Truth

> เอกสารอ้างอิงค่าคงที่ตามหลักเกณฑ์กรมบัญชีกลาง (กบก.) สำหรับ Estimate-BOQ v2
> ปลายทาง repo: `docs/cgd-constants.md` · อัปเดตตาม CC survey 2 มิ.ย. 2569

---

## ลำดับชั้นแหล่งอ้างอิง (สำคัญสำหรับ audit)

| ระดับ | เอกสาร | สถานะ |
|---|---|---|
| **ฉบับหลัก** | กบก. "หลักเกณฑ์การคำนวณราคากลางงานก่อสร้างอาคาร" (ปัจจุบัน) | ⚠ ต้องเปิดยืนยันก่อนเปลี่ยน method ใด ๆ |
| working copy | ตำรา *ประมาณราคางานก่อสร้างอาคาร* (ดาราวัลย์, วท.ชลบุรี) อ้าง CGD 2560 | ✅ มีในมือ (secondary) |
| ค่าแรง | ว.809 (14 พ.ย. 2568) | ✅ |
| Factor F | ว.499 / CGD 2567 | ✅ |

**กฎ:** ห้ามเปลี่ยน math ใน compute path ตาม secondary source อย่างเดียว — ต้องยืนยันฉบับหลักก่อน (golden rule)

---

## สรุป 2 ถัง (อ่านก่อน)

| ถัง | ลักษณะ | จัดการ |
|---|---|---|
| **A. ขัดกันเอง** | code/comment/AI ไม่ตรงกัน = ค่าไม่นิ่ง | **แก้** (ปลดล็อก validators) |
| **B. วิธีต่างจาก CGD** | code นิ่ง+สอดคล้อง AI แต่ไม่ตรงตำรา | **ตัดสินใจ** ยืนยันฉบับหลักก่อน ค่อยแก้ทีหลัง |

---

## ถัง A — ขัดกันเอง (ต้องแก้)

### A1. ลวดผูกเหล็ก (tie wire) — consumable ✅ ตัดสินแล้ว
- **TIE_WIRE_RATIO = 0.03 (3% = 30 กก./ตัน)** — ล็อกฝั่ง gov (handoff)
- ⚠ ไม่อยู่ในตำราเล่มนี้ · ที่มาทางการ % = "หลักเกณฑ์ถอดแบบหาปริมาณวัสดุ" กบก. → STEP 0 ยังต้องยืนยันเลขหน้า

| ที่ | ค่า | สถานะ | action |
|---|---|---|---|
| `consumables.ts:25` | `tieWirePct: 0.01` | ⚠ code = 1% | → `0.03` |
| `consumables.ts:16` | comment 1% | ⚠ | → 3% + ที่มา |
| `buildBOQ.ts:14` | comment 1.5% | ⚠ | → 3% / ชี้ const |
| `aiPrompts.ts:94,654` | `×0.03` | ✅ = 3% | คงไว้ (append-only) |

> **2 คอนเซ็ปต์ห้ามปน:** `ลวดผูก/tieWire` (consumable, ตัวนี้) ≠ `tieRebar/ปลอก/stirrup` (เหล็กจริง ใน footingCompute:200-221 — ห้ามแตะ)
> ลวดผูกคิดเฉพาะฐานราก+คาน (`buildBOQ:141,180`). Deferred: ฐานฐานรากไม่รวม `tie_rebar_kg`

### A2. ตะปู (nails) ⚠ พบใหม่ — inconsistency 3 ทาง
| ที่ | ค่า |
|---|---|
| `consumables.ts:26` | `nailsPerM2: 0.3` (code ใช้จริง) |
| `buildBOQ.ts:15` | comment 0.20 กก./ตร.ม. (ผิด) |
| ตำรา น.15 | **0.25 กก./ตร.ม.** (CGD, เนื้อที่เต็ม) |

> **decision:** แนะนำ align 0.25 (CGD) — เป็น math change เล็ก ต้อง browser-test + commit แยก · ห้ามบันเดิลกับ P3-1

---

## ถัง B — วิธีต่างจาก CGD (ตัดสินใจ + ยืนยันฉบับหลักก่อน)

### B1. ขุดดิน + ถมกลับ — geometric vs flat ⚠ (เดิมผมเฟรมผิดว่าเป็น reproducibility — ที่จริง code↔AI สอดคล้อง เป็น method choice)
| วิธี | สูตร | ฐาน 1.5×1.5×D1.0 |
|---|---|---|
| **code+AI ปัจจุบัน** | (W+1.0)(L+1.0)×D×N · `footingCompute:19,144` `EXCAV_SIDE 0.50` | 6.25 ลบ.ม. |
| ตำรา CGD | W×L×D×N×1.30 (น.5) | 2.93 ลบ.ม. |

> 30% ตำรา = "กันดินพัง+ทำงานสะดวก" (น.3) = **working space เดียวกับ +0.5ม. ไม่ใช่ swell → แทนกัน ไม่ใช่บวก**
> ตำรารวม ขุด+ถมกลับ เป็นก้อนเดียว ×1.30 · code แยก excav(geom) / backfill(หักปริมาตรแทนที่ :147) → เปลี่ยน = redesign section
> **status: PENDING — ยืนยันฉบับหลัก กบก. ก่อน · อย่าสร้าง const 1.30 ตอนนี้** · roadmap: P3 earthwork-method

### B2. ทรายรอง / lean — ไม่มีค่าเผื่อบดอัด
| ที่ | ค่า | ตำรา |
|---|---|---|
| `footingCompute:17` | `SAND_THK 0.05` (W×L×thk×N, geometric) | ทรายรองฐาน ×1.25 (น.9) |
| `footingCompute:18` | `LEAN_THK 0.05` | lean โดยทั่วไปไม่เผื่อบดอัด (เทไม่ยุบ) |

> decision: ทรายควรมี ×1.25 ไหม? lean น่าจะไม่ต้อง — ยืนยันฉบับหลัก

### B3. ไม้แบบ — ไม่มีตัวคูณลดตามชั้น ❌
- code: geometric ล้วน (`footingCompute:148`, `beamCompute:67`) ไม่มี 0.80/0.70/0.60/0.50
- ตำรา น.16: วัสดุไม้แบบ × ตัวคูณลดตามชั้น (ค่าแรงคิดเต็ม)
> เกี่ยวกับ active issue "formwork qty" โดยตรง · decision: tool รายงานไม้แบบเป็น material (ต้องลด) หรือ basis ค่าแรง (เต็ม)?

### B4. ไม้คร่าว — สูตรคนละแบบ
- code `consumables.ts:27` `walerFactor 0.5 × formwork_m2` → `waler_m`
- ตำรา น.15: เนื้อที่ × ตัวคูณลด × 0.30 → ลบ.ฟ.
> decision: จะ map เข้าสูตรตำราไหม (เปลี่ยนทั้งหน่วยและฐาน)

### B5. ค้ำยัน / shoring — ไม่มีในระบบเลย ❌
- ตำรา: ท้องคาน 1 ต้น/ม. (น.29) · ท้องพื้น 1 ต้น/ตร.ม. (น.38)
> decision: เพิ่ม feature ใหม่ หรือยังไม่จำเป็นในขอบเขตปัจจุบัน

---

## สอดคล้องแล้ว — ไม่ต้องแตะ
- **ค่าเผื่อเสีย (waste):** เหล็ก +7% / คอนกรีต +3% — `wage809.ts:22-23,49,57` = `aiPrompts:599,708` ✅

---

## เสาเข็ม (อ้างอิง)
- หน่วย = ต้น · = จำนวนเข็มต่อฐาน × จำนวนฐาน (ตำรา น.10-11) · code-side ⏳ ยังไม่ตรวจ

---

## บ้านของ const — ปัจจุบันกระจาย 3 module ไม่มีไฟล์กลาง
- `compute/footingCompute.ts` → CONST {SAND_THK, LEAN_THK, EXCAV_SIDE, REBAR_KG_PER_M}
- `compute/consumables.ts` → CONSUMABLE_RATIOS {tieWirePct, nailsPerM2, walerFactor}
- `core/wage809.ts` → LABOR_PRESETS_W809 + defaultWastePct
- `src/constants/` มีแค่ thaiProvinces.ts (ไม่เกี่ยว)

> **แผน:** สร้าง `src/services/compute/cgdConstants.ts` ให้ 3 module import จากที่เดียว — **แต่ทำหลังตัดสินค่า/วิธีครบ** ไม่ refactor structure ระหว่างตัดสินใจ

---
*Estimate-BOQ Phase 3 · 2 มิ.ย. 2569 · AI ร่าง — คนตรวจ + ยืนยันฉบับหลักก่อนล็อก*
