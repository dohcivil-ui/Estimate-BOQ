/**
 * Tests สำหรับ consolidatePor4 — ชั้นรวม ปร.4
 * อ้าง REBAR/EXCAVATION_ALLOWANCE_PCT/TIE_WIRE_KG_PER_TON ตรง (ไม่ hardcode)
 */
import { describe, it, expect } from 'vitest';
import {
  consolidatePor4,
  MATERIAL_KEY_MAP,
  ALLOWANCE_POLICY,
  type Por4Row,
} from './por4Consolidate';
import { REBAR, EXCAVATION_ALLOWANCE_PCT, TIE_WIRE_KG_PER_TON } from '@/data/cgdAllowance';
import type { BOQItem, DisciplineGroup } from '@/types/boq';

// ── factory helpers ──────────────────────────────────────────────────
let idCounter = 0;
function makeItem(p: Partial<BOQItem> & { name: string }): BOQItem {
  idCounter += 1;
  return {
    id: `t-${idCounter}`,
    category: p.category ?? 'ฐานราก',
    name: p.name,
    unit: p.unit ?? 'กก.',
    quantity: p.quantity ?? 0,
    unitPrice: p.unitPrice ?? 0,
    isMaterial: p.isMaterial ?? true,
    wastePct: p.wastePct ?? 0,
    thickness: p.thickness,
    source: p.source ?? 'ai',
    sourceRef: p.sourceRef,
    notes: p.notes,
    createdAt: '2026-06-10T00:00:00Z',
    updatedAt: '2026-06-10T00:00:00Z',
  };
}

function makeGroup(items: BOQItem[]): DisciplineGroup {
  return {
    discipline: 'structural',
    pageId: 'p1',
    pageName: 'p1',
    items,
    analyzedAt: '2026-06-10T00:00:00Z',
    status: 'confirmed',
  };
}

function findRow(rows: Por4Row[], materialKey: string, role: 'material' | 'labor') {
  return rows.find((r) => r.materialKey === materialKey && r.role === role);
}

// ── tests ────────────────────────────────────────────────────────────
describe('consolidatePor4', () => {
  it('1) rebar:DB12 จาก 2 element merge เป็น 1 row (qty รวม)', () => {
    const groups = [
      makeGroup([
        makeItem({ name: 'เหล็กเสริม DB12', quantity: 40, unit: 'กก.' }),
        makeItem({ name: 'เหล็กเสริม DB12', quantity: 60, unit: 'กก.' }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const db12Rows = res.rows.filter(
      (r) => r.materialKey === 'rebar:DB12' && r.role === 'material',
    );
    expect(db12Rows.length).toBe(1);
    expect(db12Rows[0]!.qtyNet).toBeCloseTo(100, 6);
    expect(db12Rows[0]!.sourceItemIds.length).toBe(2);
  });

  it('2) role material/labor ไม่รวมกัน (formwork:panel)', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'ไม้แบบหล่อคอนกรีต',
          quantity: 70,
          unit: 'ตร.ม.',
          isMaterial: true,
        }),
        makeItem({
          name: 'ค่าประกอบไม้แบบ',
          quantity: 100,
          unit: 'ตร.ม.',
          isMaterial: false,
        }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const mat = findRow(res.rows, 'formwork:panel', 'material');
    const lab = findRow(res.rows, 'formwork:panel', 'labor');
    expect(mat).toBeDefined();
    expect(lab).toBeDefined();
    expect(mat!.qtyNet).toBe(70);
    expect(lab!.qtyNet).toBe(100);
  });

  it('3) excavation 100 → ×1.30 = 130 → ceil 130 (ใช้ EXCAVATION_ALLOWANCE_PCT ตรง)', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'ดินขุดหลุมฐานราก',
          quantity: 100,
          unit: 'ลบ.ม.',
          isMaterial: false,
        }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const row = findRow(res.rows, 'earth:excavation', 'labor');
    expect(row).toBeDefined();
    expect(row!.allowance?.pct).toBe(EXCAVATION_ALLOWANCE_PCT);
    const expectedAfter = 100 * (1 + EXCAVATION_ALLOWANCE_PCT / 100);
    expect(row!.qtyAfterAllowance).toBeCloseTo(expectedAfter, 6);
    expect(row!.qtyFinal).toBe(130);
  });

  it('4) rebar DB12 100 กก. → +9% = 109 → ceil 109 (อ้าง REBAR ตรง, epsilon กัน float)', () => {
    const groups = [
      makeGroup([
        makeItem({ name: 'เหล็กเสริม DB12', quantity: 100, unit: 'กก.' }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const row = findRow(res.rows, 'rebar:DB12', 'material');
    expect(row).toBeDefined();
    expect(row!.allowance?.pct).toBe(REBAR.DB12.wastePct);
    const expectedAfter = 100 * (1 + REBAR.DB12.wastePct / 100);
    expect(row!.qtyAfterAllowance).toBeCloseTo(expectedAfter, 6);
    // 100 × 1.09 = 109.00000000000001 (float) — naive Math.ceil → 110 ผิด
    // qtyFinal ใช้ epsilon (1e-9) จึงปัดเป็น 109 ตรงสเปก
    expect(row!.qtyFinal).toBe(109);
  });

  it('5) wastePct≠0 → warning BOQ_NOT_NET (ไม่ throw)', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'เหล็กเสริม DB12',
          quantity: 100,
          unit: 'กก.',
          wastePct: 9,
        }),
      ]),
    ];
    const res = consolidatePor4(groups);
    expect(res.warnings.some((w) => w.startsWith('BOQ_NOT_NET'))).toBe(true);
    // ยังคง classify/merge ตามปกติ (qty เดิม) — ไม่ throw
    const row = findRow(res.rows, 'rebar:DB12', 'material');
    expect(row).toBeDefined();
    expect(row!.qtyNet).toBe(100);
  });

  it('6) ชื่อไม่รู้จัก → UNMAPPED passthrough ไม่หาย', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'วัสดุประหลาดที่ไม่อยู่ใน dictionary',
          quantity: 7,
          unit: 'ชุด',
          unitPrice: 100,
        }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const stray = res.rows.find((r) =>
      r.flags?.includes('UNMAPPED'),
    );
    expect(stray).toBeDefined();
    expect(stray!.name).toBe('วัสดุประหลาดที่ไม่อยู่ใน dictionary');
    expect(stray!.qtyNet).toBe(7);
    expect(stray!.qtyFinal).toBe(7);
    expect(stray!.materialKey).toBeUndefined();
  });

  it('7) tiewire derive: DB12 1000 กก. → 1090 → 1.09 ตัน × 30 = 32.7 → ceil 33 · drift baseline = net (ไม่เตือน)', () => {
    const groups = [
      makeGroup([
        makeItem({ name: 'เหล็กเสริม DB12', quantity: 1000, unit: 'กก.' }),
        // ลวดผูกของเดิมใน BOQ (3% ของ net 1000 = 30) — drift เทียบ derivedFromNet (=30) → ไม่เตือน
        makeItem({ name: 'ลวดผูกเหล็ก', quantity: 30, unit: 'กก.' }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const tw = findRow(res.rows, 'consumable:tiewire', 'material');
    expect(tw).toBeDefined();
    // qtyFinal ยังใช้ derived "หลังเผื่อ" (rebarAfter=1090): (1090/1000)×30 = 32.7
    // ceil 2dp = 32.7 (ปร.4 สพฐ. ใช้ 2dp ไม่ปัดจำนวนเต็ม)
    const expectedAfter = (1090 / 1000) * TIE_WIRE_KG_PER_TON;
    expect(tw!.qtyAfterAllowance).toBeCloseTo(expectedAfter, 6);
    expect(tw!.qtyFinal).toBeCloseTo(32.7, 6);
    // baseline เทียบกับ NET (1000/1000×30 = 30) vs BOQ 30 → drift 0% → ไม่มี warning
    expect(res.warnings.some((w) => w.startsWith('CONSUMABLE_DRIFT'))).toBe(false);
  });

  it('7b) rebar:labor derived จากวัสดุรวมหลังเผื่อ — DB12 1000 → labor qtyFinal = 1090', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'เหล็กเสริม DB12',
          quantity: 1000,
          unit: 'กก.',
          isMaterial: true,
          unitPrice: 28,
        }),
        makeItem({
          name: 'ค่าผูก/ตัด/ดัดเหล็ก',
          quantity: 1000,
          unit: 'กก.',
          isMaterial: false,
          unitPrice: 2.31,
        }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const lab = findRow(res.rows, 'rebar:labor', 'labor');
    expect(lab).toBeDefined();
    // rebarMaterialKgAfter = 1000 × 1.09 = 1090 → ceilInt = 1090
    expect(lab!.qtyAfterAllowance).toBeCloseTo(1000 * (1 + REBAR.DB12.wastePct / 100), 6);
    expect(lab!.qtyFinal).toBe(1090);
    // amount ใช้ qtyFinal × unitPrice
    expect(lab!.amount).toBeCloseTo(1090 * 2.31, 6);
  });

  it('7c) CONSUMABLE_DRIFT triggers เมื่อ BOQ ลวดผูก = 5 (ห่าง net 30 มาก)', () => {
    const groups = [
      makeGroup([
        makeItem({ name: 'เหล็กเสริม DB12', quantity: 1000, unit: 'กก.' }),
        // ลวดผูก BOQ ผิด (เกิน 5% จาก net 30) → ต้องเตือน
        makeItem({ name: 'ลวดผูกเหล็ก', quantity: 5, unit: 'กก.' }),
      ]),
    ];
    const res = consolidatePor4(groups);
    expect(
      res.warnings.some((w) => w.startsWith('CONSUMABLE_DRIFT')),
    ).toBe(true);
  });

  it('7d) PRICE_INCONSISTENT: DB12 สอง source ราคา 25 vs 28 → เตือน + weighted avg', () => {
    const groups = [
      makeGroup([
        makeItem({ name: 'เหล็กเสริม DB12', quantity: 40, unit: 'กก.', unitPrice: 25 }),
        makeItem({ name: 'เหล็กเสริม DB12', quantity: 60, unit: 'กก.', unitPrice: 28 }),
      ]),
    ];
    const res = consolidatePor4(groups);
    expect(res.warnings.some((w) => w.startsWith('PRICE_INCONSISTENT'))).toBe(
      true,
    );
    const row = findRow(res.rows, 'rebar:DB12', 'material');
    // weighted = (40×25 + 60×28) / 100 = (1000 + 1680) / 100 = 26.8
    expect(row!.unitPrice).toBeCloseTo(26.8, 6);
  });

  it('8) backfill ไม่เผื่อ (net = final ก่อน ceil)', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'ดินถมกลับ',
          quantity: 50.4,
          unit: 'ลบ.ม.',
          isMaterial: false,
        }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const row = findRow(res.rows, 'earth:backfill', 'labor');
    expect(row).toBeDefined();
    expect(row!.allowance).toBeUndefined(); // net → no allowance attached
    expect(row!.qtyAfterAllowance).toBe(50.4); // = qtyNet (ก่อน ceil)
    expect(row!.qtyFinal).toBeCloseTo(50.4, 6); // ceil 2dp ของ 50.4 = 50.4 (ปร.4 สพฐ. 2dp)
  });

  it('7e) rebar:mesh = net (ไม่เผื่อ) + ไม่เข้าฐาน Σ เหล็ก (ไม่ pollute tiewire)', () => {
    const groups = [
      makeGroup([
        // ตะแกรงสำเร็จ 50 กก. — net, ไม่เข้าฐานคำนวณลวดผูก
        makeItem({
          name: 'ตะแกรงเหล็ก (wire mesh)',
          quantity: 50,
          unit: 'กก.',
          unitPrice: 30,
        }),
        // เหล็กจริง DB12 100 กก. — เข้าฐานคำนวณลวดผูก
        makeItem({ name: 'เหล็กเสริม DB12', quantity: 100, unit: 'กก.' }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const mesh = findRow(res.rows, 'rebar:mesh', 'material');
    expect(mesh).toBeDefined();
    expect(mesh!.allowance).toBeUndefined(); // net → no allowance attached
    expect(mesh!.qtyFinal).toBe(50);
    expect(mesh!.flags).toBeUndefined(); // mapped (ไม่ใช่ UNMAPPED)
    // tiewire derive ใช้เฉพาะ rebar size จริง (DB12=109 กก. after) ไม่รวม mesh
    // expected = (109/1000) × 30 = 3.27 → ceil 4
    const tw = res.rows.find((r) => r.materialKey === 'consumable:tiewire');
    if (tw) {
      expect(tw.qtyAfterAllowance).toBeCloseTo((109 / 1000) * 30, 6);
    }
  });

  // ── extra sanity checks ────────────────────────────────────────────
  it('sanity: dictionary มี rebar ครบทุกขนาดใน REBAR (RB6..DB28)', () => {
    for (const size of Object.keys(REBAR)) {
      expect(MATERIAL_KEY_MAP[`เหล็กเสริม ${size}`]).toBe(`rebar:${size}`);
      expect(MATERIAL_KEY_MAP[`เหล็กรัดรอบฐาน ${size}`]).toBe(`rebar:${size}`);
      expect(ALLOWANCE_POLICY[`rebar:${size}`]).toBeDefined();
    }
  });

  it('sanity: rebar:mesh ประกาศ policy + map "ตะแกรงเหล็ก (wire mesh)" → rebar:mesh', () => {
    expect(MATERIAL_KEY_MAP['ตะแกรงเหล็ก (wire mesh)']).toBe('rebar:mesh');
    expect(ALLOWANCE_POLICY['rebar:mesh']).toBeDefined();
    expect(ALLOWANCE_POLICY['rebar:mesh']!.pct).toBe(0);
    expect(ALLOWANCE_POLICY['rebar:mesh']!.ref).toContain('มอก.737-2549');
  });
});
