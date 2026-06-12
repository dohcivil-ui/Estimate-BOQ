/**
 * por456ViewModel.ts — ประกอบผลลัพธ์ ปร.4/5/6 จาก disciplineGroups (เลขล็อก)
 * --------------------------------------------------------------------------
 * จุดประสงค์: เป็น single assembly ที่ "จอแสดงผล (คนตรวจ)" และ "export (โค้ดล็อก)"
 * ใช้ร่วมกัน — ตัวเลขเดียวกันทุกที่ ไม่มีสายคำนวณซ้ำ
 *
 * chain:
 *   groups → consolidatePor4 → por4.directCost
 *     → effectiveFactorF(directCost) → factorF
 *     → por5Summary(directCost, factorF, special, cfg)
 *     → por6Summary([{ ค่าก่อสร้างอาคาร, por5.approxAmount }])
 *
 * pure module: ไม่ import store/supabase/react — รับ input เป็น plain values
 * (caller ฝั่ง UI ดึง groups/meta จาก store แล้วส่งเข้ามา → เทสได้ไม่ต้อง browser)
 *
 * หมายเหตุ directCost: ใช้ por4.directCost (เลขหลังเผื่อ/ceil2dp/เหล็กต่อขนาด ที่ล็อกแล้ว)
 * — ห้ามใช้ directCostTotal(items) สายเก่า (เลขคนละชุด ไม่ผ่าน ปร.4 consolidation)
 */
import type { DisciplineGroup } from '@/types/boq';
import { effectiveFactorF } from '@/core/boqCalc';
import {
  consolidatePor4,
  type Por4Result,
  type ConsolidatePor4Options,
} from './por4Consolidate';
import { por5Summary, type Por5Config, type Por5Result } from './por5Summary';
import { por6Summary, type Por6Part, type Por6Result } from './por6Summary';

export interface Por456ViewModelInput {
  /** ขาเข้า ปร.4 — disciplineGroups จาก boqStore (net, wastePct=0) */
  groups: DisciplineGroup[];
  /** Factor F override จาก projectMeta.factorF (0 = อัตโนมัติจากตาราง CGD) */
  factorFOverride: number;
  /** เงินล่วงหน้า (%) จาก projectMeta.advancePct */
  advancePct: number;
  /** เงินประกันผลงานหัก (%) จาก projectMeta.retentionPct */
  retentionPct: number;
  /** ค่าใช้จ่ายพิเศษ ส่วนที่ 2 (ไม่คูณ F) — default 0 */
  specialCost?: number;
  /** ตัวเลือก ปร.5 (bahtMode/approxStep/approxMode/buildingAreaSqm) */
  por5Config?: Por5Config;
  /** ตัวเลือก ปร.4 (เช่น laborRateBySizeTon override) — reproduce เอกสารเก่า */
  por4Options?: ConsolidatePor4Options;
}

export interface Por456ViewModel {
  /** ผล ปร.4 (dual-column rows + directCost + warnings) */
  por4: Por4Result;
  /** Factor F ที่ใช้จริง (override หรือ interpolate จากตาราง) */
  factorF: number;
  /** ผล ปร.5 (ต้นทุน × F → ยอดสุทธิ + ตัวอักษร) */
  por5: Por5Result;
  /** ผล ปร.6 (Σ ยอดสุทธิรายส่วน + ตัวอักษร) */
  por6: Por6Result;
  /** รายส่วนที่ป้อนเข้า ปร.6 (เปิดให้ UI/ผู้ตรวจเห็น breakdown) */
  por6Parts: Por6Part[];
}

/**
 * ประกอบ ปร.4/5/6 จาก groups — pure, deterministic
 * ปัจจุบันรองรับ vertical slice อาคารเดียว (ปร.6 ส่วนเดียว = "ค่าก่อสร้างอาคาร")
 * ครุภัณฑ์จัดซื้อ/สั่งทำ (ปร.5ข ×1.07) เป็นงานค้าง — เพิ่ม part ภายหลังโดยไม่แตะ chain นี้
 */
export function buildPor456ViewModel(
  input: Por456ViewModelInput,
): Por456ViewModel {
  const por4 = consolidatePor4(input.groups, input.por4Options);

  const factorF = effectiveFactorF(
    por4.directCost,
    input.factorFOverride,
    input.advancePct,
    input.retentionPct,
  );

  const por5 = por5Summary(
    por4.directCost,
    factorF,
    input.specialCost ?? 0,
    input.por5Config ?? {},
  );

  const por6Parts: Por6Part[] = [
    { label: 'ค่าก่อสร้างอาคาร', netAmount: por5.approxAmount },
  ];
  const por6 = por6Summary(por6Parts);

  return { por4, factorF, por5, por6, por6Parts };
}
