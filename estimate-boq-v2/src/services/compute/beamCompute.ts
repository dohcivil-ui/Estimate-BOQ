/**
 * beamCompute.ts — คาน GB1/GB2 + พื้น GS → BOQ (deterministic)
 * --------------------------------------------------------------
 * คู่กับ footingCompute.ts · สูตรจาก Custom Instructions กฎ 13 (คาน=จำนวนตัว)
 * pure module: ไม่มี dependency กับ store/supabase
 */

import { barWeightPerM } from './footingCompute.ts'; // ใช้ d²/162 ตัวเดียวกัน

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
/** เหล็กยืนหลัก หรือ เหล็กเสริมพิเศษ */
export interface BeamBar {
  size: string;          // "DB12"
  count: number;         // จำนวนเส้น
  /** ส่วนของความยาวช่วงที่เหล็กพาดจริง: เหล็กหลัก=1.0, เสริมหัวเสา L/4=0.25, กลางคาน 3L/4=0.75 */
  lengthFactor?: number; // default 1.0
  note?: string;
}

/** คาน 1 "ตัว" = ช่วงต่อเนื่องที่เหล็กต่อเนื่อง (กฎ 13) */
export interface BeamPiece {
  length: number;        // ความยาวต่อตัว (ม.)
  count: number;         // กี่ตัวที่เหมือนกัน
}

export interface BeamSpec {
  type: string;          // "GB1" | "GB2"
  W: number;             // กว้างหน้าตัด (ม.)
  H: number;             // สูงหน้าตัด (ม.)
  pieces: BeamPiece[];   // รายการคานชนิดนี้ (กฎ 13: ต่อเนื่อง=1 ตัว×ยาวรวม)
  cover?: number;        // default 0.025 (คาน)
  mainBars: BeamBar[];   // เหล็กยืนหลัก (บน+ล่าง) — lengthFactor=1.0
  extraBars?: BeamBar[]; // เหล็กเสริมพิเศษ (L/4, 3L/4 ฯลฯ)
  stirrup: { size: string; spacing: number }; // ปลอก เช่น RB6@0.15
  lapFactor?: number;    // เผื่อต่อทาบเหล็กหลัก เช่น 1.05 (default 1.0)
  hook?: number;         // งอปลายปลอกต่อข้าง (ม.) default 0.05
  /** true = ร่างจาก AI ยังไม่ยืนยัน (mirror SlabSpec) */
  provisional?: boolean;
  refSheet?: string;
}

export interface BeamQty {
  type: string;
  pieces_total: number;  // จำนวนตัวรวม
  length_total_m: number;
  concrete_m3: number;
  formwork_m2: number;   // 2 ข้าง (คานคอดิน ก้นวางบน lean/ดิน)
  rebar_kg: number;
  rebar_breakdown: Record<string, number>;
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────
// คาน
// ─────────────────────────────────────────────────────────────
export function computeBeam(b: BeamSpec): BeamQty {
  const cover = b.cover ?? 0.025;
  const lap = b.lapFactor ?? 1.0;
  const hook = b.hook ?? 0.05;
  const warnings: string[] = [];

  const pieces_total = b.pieces.reduce((s, p) => s + p.count, 0);
  const length_total = b.pieces.reduce((s, p) => s + p.length * p.count, 0);
  if (length_total <= 0) warnings.push(`❓ ${b.type}: ความยาวรวม = 0`);

  const concrete_m3 = b.W * b.H * length_total;
  const formwork_m2 = 2 * b.H * length_total; // 2 ข้าง

  const rebar_breakdown: Record<string, number> = {};
  const addBar = (size: string, kg: number) =>
    (rebar_breakdown[size] = (rebar_breakdown[size] ?? 0) + kg);

  // เหล็กหลัก: วิ่งเต็มความยาวคาน (×lap)
  for (const m of b.mainBars) {
    const f = m.lengthFactor ?? 1.0;
    const kg = m.count * (length_total * f) * lap * barWeightPerM(m.size);
    addBar(m.size, kg);
  }
  // เหล็กเสริมพิเศษ: คิด "ต่อช่วง" (L/4, 3L/4 อิงความยาวแต่ละช่วง)
  for (const e of b.extraBars ?? []) {
    const f = e.lengthFactor ?? 0.25;
    let kg = 0;
    for (const p of b.pieces) kg += e.count * (p.length * f) * p.count * barWeightPerM(e.size);
    addBar(e.size, kg);
  }
  // ปลอก: จำนวน = ยาว/ระยะ +1 ต่อช่วง · ยาวปลอก = เส้นรอบรูปใน − มุม + งอ
  const stirLen = 2 * ((b.W - 2 * cover) + (b.H - 2 * cover)) + 2 * hook;
  let stirCount = 0;
  for (const p of b.pieces) stirCount += (Math.floor(p.length / b.stirrup.spacing) + 1) * p.count;
  addBar(b.stirrup.size, stirCount * stirLen * barWeightPerM(b.stirrup.size));

  const r = (x: number, p = 2) => +x.toFixed(p);
  let rebar_kg = 0;
  for (const k in rebar_breakdown) { rebar_breakdown[k] = r(rebar_breakdown[k], 1); rebar_kg += rebar_breakdown[k]; }

  return {
    type: b.type, pieces_total, length_total_m: r(length_total),
    concrete_m3: r(concrete_m3, 3), formwork_m2: r(formwork_m2),
    rebar_kg: r(rebar_kg, 1), rebar_breakdown, warnings,
  };
}

// ─────────────────────────────────────────────────────────────
// พื้นเทกับที่ GS (slab on grade)
// ─────────────────────────────────────────────────────────────
export interface SlabSpec {
  name: string;          // "GS"
  area_m2: number;       // พื้นที่พื้น (ตร.ม.)
  thickness: number;     // หนา (ม.)
  /** wire mesh: ขนาดลวด (มม.) + ระยะ (ม.) 2 ทาง */
  mesh?: { wireMM: number; spacing: number };
  sandThk?: number;      // ทรายรองพื้น (ม.) ถ้ามี
  /** true = ร่างจาก AI (พื้นที่/ความหนายังไม่ยืนยัน — ต้องเติมมิติก่อนใช้จริง) */
  provisional?: boolean;
  refSheet?: string;
}
export interface SlabQty {
  name: string;
  concrete_m3: number;
  mesh_kg: number;       // โดยประมาณ (ตะแกรง 2 ทาง)
  sand_m3: number;
  warnings: string[];
}
export function computeSlab(s: SlabSpec): SlabQty {
  const warnings: string[] = [];
  if (s.area_m2 <= 0) warnings.push(`❓ ${s.name}: พื้นที่ยังไม่ระบุ — ต้องอ่าน/ยืนยันจากแบบ`);
  const concrete_m3 = s.area_m2 * s.thickness;
  let mesh_kg = 0;
  if (s.mesh) {
    const kgPerM = (s.mesh.wireMM * s.mesh.wireMM) / 162;     // d²/162
    const lengthPerM2 = 2 * (1 / s.mesh.spacing);             // 2 ทาง × เส้น/ม.
    mesh_kg = +(s.area_m2 * lengthPerM2 * kgPerM).toFixed(1);
  }
  const sand_m3 = +(s.area_m2 * (s.sandThk ?? 0)).toFixed(2);
  return { name: s.name, concrete_m3: +concrete_m3.toFixed(3), mesh_kg, sand_m3, warnings };
}

/*
 * ── การต่อระบบ (adapter ทำตอน wire จริง) ─────────────────────
 * BeamSpec[] / SlabSpec มาจาก: full-engine analyzePage อ่าน S2-01(ความยาว/ตำแหน่ง)
 *   + S2-03(หน้าตัด/เหล็ก) → คนยืนยันการจับ GB1/GB2 ก่อน → ป้อนโมดูล
 * ราคา/Factor F: ใช้ computeCost จาก footingCompute.ts (รูปแบบเดียวกัน)
 */
