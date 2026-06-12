/**
 * Tests สำหรับ consolidatePor4 — ชั้นรวม ปร.4 (dual-column)
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

// dual-column row finders
function findByKey(rows: Por4Row[], materialKey: string) {
  return rows.filter((r) => r.materialKey === materialKey);
}
function findMaterialOnly(rows: Por4Row[], materialKey: string) {
  return rows.find(
    (r) =>
      r.materialKey === materialKey &&
      r.materialUnitPrice != null &&
      r.laborUnitPrice == null,
  );
}
function findLaborOnly(rows: Por4Row[], materialKey: string) {
  return rows.find(
    (r) =>
      r.materialKey === materialKey &&
      r.laborUnitPrice != null &&
      r.materialUnitPrice == null,
  );
}
function findDual(rows: Por4Row[], materialKey: string) {
  return rows.find(
    (r) =>
      r.materialKey === materialKey &&
      r.materialUnitPrice != null &&
      r.laborUnitPrice != null,
  );
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
    const db12Rows = findByKey(res.rows, 'rebar:DB12');
    expect(db12Rows.length).toBe(1);
    expect(db12Rows[0]!.qtyNet).toBeCloseTo(100, 6);
    expect(db12Rows[0]!.sourceItemIds.length).toBe(2);
  });

  it('2) qty ต่าง (formwork:panel mat 70 vs labor 100) → 2 แถวแยก (ไม่ pair)', () => {
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
    const mat = findMaterialOnly(res.rows, 'formwork:panel');
    const lab = findLaborOnly(res.rows, 'formwork:panel');
    expect(mat).toBeDefined();
    expect(lab).toBeDefined();
    expect(mat!.qtyNet).toBe(70);
    expect(lab!.qtyNet).toBe(100);
    // ไม่มี dual row
    expect(findDual(res.rows, 'formwork:panel')).toBeUndefined();
  });

  it('3) excavation 100 → ×1.30 = 130 (labor-only · ใช้ EXCAVATION_ALLOWANCE_PCT ตรง)', () => {
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
    const row = findLaborOnly(res.rows, 'earth:excavation');
    expect(row).toBeDefined();
    expect(row!.allowance?.pct).toBe(EXCAVATION_ALLOWANCE_PCT);
    expect(row!.qtyAfterAllowance).toBeCloseTo(130, 6);
    expect(row!.qtyFinal).toBe(130);
    expect(row!.materialUnitPrice).toBeUndefined();
  });

  it('4) rebar DB12 100 กก. → +9% = 109 (material-only · epsilon กัน float)', () => {
    const groups = [
      makeGroup([
        makeItem({ name: 'เหล็กเสริม DB12', quantity: 100, unit: 'กก.' }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const row = findMaterialOnly(res.rows, 'rebar:DB12');
    expect(row).toBeDefined();
    expect(row!.allowance?.pct).toBe(REBAR.DB12.wastePct);
    expect(row!.qtyAfterAllowance).toBeCloseTo(109, 6);
    expect(row!.qtyFinal).toBe(109);
    expect(row!.laborUnitPrice).toBeUndefined();
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
    const row = findMaterialOnly(res.rows, 'rebar:DB12');
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
    const stray = res.rows.find((r) => r.flags?.includes('UNMAPPED'));
    expect(stray).toBeDefined();
    expect(stray!.name).toBe('วัสดุประหลาดที่ไม่อยู่ใน dictionary');
    expect(stray!.qtyNet).toBe(7);
    expect(stray!.qtyFinal).toBe(7);
    expect(stray!.materialKey).toBeUndefined();
    expect(stray!.materialUnitPrice).toBe(100);
    expect(stray!.totalAmount).toBeCloseTo(700, 6);
  });

  it('7) tiewire derive: DB12 1000 กก. → 1090 → 32.7 (ceil 2dp) · drift baseline = net (ไม่เตือน)', () => {
    const groups = [
      makeGroup([
        makeItem({ name: 'เหล็กเสริม DB12', quantity: 1000, unit: 'กก.' }),
        makeItem({ name: 'ลวดผูกเหล็ก', quantity: 30, unit: 'กก.' }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const tw = findMaterialOnly(res.rows, 'consumable:tiewire');
    expect(tw).toBeDefined();
    const expectedAfter = (1090 / 1000) * TIE_WIRE_KG_PER_TON;
    expect(tw!.qtyAfterAllowance).toBeCloseTo(expectedAfter, 6);
    expect(tw!.qtyFinal).toBeCloseTo(32.7, 6);
    expect(res.warnings.some((w) => w.startsWith('CONSUMABLE_DRIFT'))).toBe(
      false,
    );
  });

  it('7b) rebar:labor ฝังลง rebar:DB12 (dual-column) · rate มาจาก ว.809 ไม่ใช่ BOQ', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'เหล็กเสริม DB12',
          quantity: 1000,
          unit: 'กก.',
          isMaterial: true,
          unitPrice: 28,
        }),
        // BOQ ส่ง 3.9 บ./กก. (= 3,900 บ./ตัน DB12 medium ตรง ว.809) → ไม่เกิด drift
        makeItem({
          name: 'ค่าผูก/ตัด/ดัดเหล็ก',
          quantity: 1000,
          unit: 'กก.',
          isMaterial: false,
          unitPrice: 3.9,
        }),
      ]),
    ];
    const res = consolidatePor4(groups);
    expect(findByKey(res.rows, 'rebar:labor').length).toBe(0);
    const dual = findDual(res.rows, 'rebar:DB12');
    expect(dual).toBeDefined();
    expect(dual!.qtyFinal).toBe(1090);
    expect(dual!.materialUnitPrice).toBe(28);
    // laborUnitPrice = 3900 (medium ว.809) / 1000 = 3.9 บ./กก.
    expect(dual!.laborUnitPrice).toBeCloseTo(3.9, 6);
    expect(dual!.materialAmount).toBeCloseTo(1090 * 28, 6);
    expect(dual!.laborAmount).toBeCloseTo(1090 * 3.9, 6);
    expect(dual!.totalAmount).toBeCloseTo(1090 * 28 + 1090 * 3.9, 6);
    expect(
      res.warnings.some((w) => w.startsWith('REBAR_LABOR_RATE_DRIFT')),
    ).toBe(false);
  });

  it('7f1) RB6 rate ว.809 = 4,900 บ./ตัน → 4.9 บ./กก. · qty 1000 หลังเผื่อ → labor ตามสัดส่วน', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'เหล็กเสริม RB6',
          quantity: 1000,
          unit: 'กก.',
          isMaterial: true,
          unitPrice: 30,
        }),
        // ใส่ aggregate row เพื่อ trigger distribute (rate ตรง small=4.9 → ไม่ drift)
        makeItem({
          name: 'ค่าผูก/ตัด/ดัดเหล็ก',
          quantity: 1000,
          unit: 'กก.',
          isMaterial: false,
          unitPrice: 4.9,
        }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const dual = findDual(res.rows, 'rebar:RB6');
    expect(dual).toBeDefined();
    // RB6 5% waste → qtyFinal = 1050
    expect(dual!.qtyFinal).toBe(1050);
    expect(dual!.laborUnitPrice).toBeCloseTo(4.9, 6);
    expect(dual!.laborAmount).toBeCloseTo(1050 * 4.9, 6); // = 5145
  });

  it('7f2) per-size ทำงานจริง: DB12 (medium 3.9) ≠ DB20 (large 3.5) ในแถวเดียวกัน', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'เหล็กเสริม DB12',
          quantity: 2500,
          unit: 'กก.',
          isMaterial: true,
          unitPrice: 28,
        }),
        makeItem({
          name: 'เหล็กเสริม DB20',
          quantity: 2000,
          unit: 'กก.',
          isMaterial: true,
          unitPrice: 30,
        }),
        // BOQ rate ใส่ค่ากลาง 3.7 (ใกล้ weighted avg) → ไม่ drift
        makeItem({
          name: 'ค่าผูก/ตัด/ดัดเหล็ก',
          quantity: 4500,
          unit: 'กก.',
          isMaterial: false,
          unitPrice: 3.7,
        }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const db12 = findDual(res.rows, 'rebar:DB12');
    const db20 = findDual(res.rows, 'rebar:DB20');
    expect(db12).toBeDefined();
    expect(db20).toBeDefined();
    // DB12 9% waste → qtyFinal=2725 · labor 3.9 บ./กก.
    expect(db12!.qtyFinal).toBe(2725);
    expect(db12!.laborUnitPrice).toBeCloseTo(3.9, 6);
    expect(db12!.laborAmount).toBeCloseTo(2725 * 3.9, 6); // 10627.5
    // DB20 13% waste → qtyFinal=2260 · labor 3.5 บ./กก.
    expect(db20!.qtyFinal).toBe(2260);
    expect(db20!.laborUnitPrice).toBeCloseTo(3.5, 6);
    expect(db20!.laborAmount).toBeCloseTo(2260 * 3.5, 6); // 7910
    // พิสูจน์ per-size: 2 ขนาดมี laborUnitPrice ต่างกัน
    expect(db12!.laborUnitPrice).not.toBe(db20!.laborUnitPrice);
  });

  it('7f3) override laborRateBySizeTon {DB12: 3600} → DB12 ใช้ 3.6 บ./กก. แทน ว.809', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'เหล็กเสริม DB12',
          quantity: 2500,
          unit: 'กก.',
          isMaterial: true,
          unitPrice: 28,
        }),
        makeItem({
          name: 'ค่าผูก/ตัด/ดัดเหล็ก',
          quantity: 2500,
          unit: 'กก.',
          isMaterial: false,
          unitPrice: 3.6,
        }),
      ]),
    ];
    const res = consolidatePor4(groups, {
      laborRateBySizeTon: { DB12: 3600 },
    });
    const dual = findDual(res.rows, 'rebar:DB12');
    expect(dual).toBeDefined();
    expect(dual!.qtyFinal).toBe(2725);
    expect(dual!.laborUnitPrice).toBeCloseTo(3.6, 6);
    expect(dual!.laborAmount).toBeCloseTo(2725 * 3.6, 6); // 9810
  });

  it('7f4) BOQ rate ต่าง >5% → REBAR_LABOR_RATE_DRIFT warning', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'เหล็กเสริม DB12',
          quantity: 1000,
          unit: 'กก.',
          isMaterial: true,
          unitPrice: 28,
        }),
        // BOQ rate 2.31 (เก่า) ห่างจาก ว.809 = 3.9 → drift 68%
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
    expect(
      res.warnings.some((w) => w.startsWith('REBAR_LABOR_RATE_DRIFT')),
    ).toBe(true);
  });

  it('7f5) audit trail: sourceItemIds ของ rebar:DB12 รวม id แถวค่าแรงขาเข้า', () => {
    const dbItem = makeItem({
      name: 'เหล็กเสริม DB12',
      quantity: 1000,
      unit: 'กก.',
      isMaterial: true,
      unitPrice: 28,
    });
    const laborItem = makeItem({
      name: 'ค่าผูก/ตัด/ดัดเหล็ก',
      quantity: 1000,
      unit: 'กก.',
      isMaterial: false,
      unitPrice: 3.9,
    });
    const res = consolidatePor4([makeGroup([dbItem, laborItem])]);
    const dual = findDual(res.rows, 'rebar:DB12');
    expect(dual).toBeDefined();
    expect(dual!.sourceItemIds).toContain(dbItem.id);
    expect(dual!.sourceItemIds).toContain(laborItem.id);
  });

  it('7c) CONSUMABLE_DRIFT triggers เมื่อ BOQ ลวดผูก = 5 (ห่าง net 30 มาก)', () => {
    const groups = [
      makeGroup([
        makeItem({ name: 'เหล็กเสริม DB12', quantity: 1000, unit: 'กก.' }),
        makeItem({ name: 'ลวดผูกเหล็ก', quantity: 5, unit: 'กก.' }),
      ]),
    ];
    const res = consolidatePor4(groups);
    expect(res.warnings.some((w) => w.startsWith('CONSUMABLE_DRIFT'))).toBe(
      true,
    );
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
    const row = findMaterialOnly(res.rows, 'rebar:DB12');
    // weighted = (40×25 + 60×28) / 100 = 26.8
    expect(row!.materialUnitPrice).toBeCloseTo(26.8, 6);
  });

  it('8) backfill ไม่เผื่อ (net = final · labor-only)', () => {
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
    const row = findLaborOnly(res.rows, 'earth:backfill');
    expect(row).toBeDefined();
    expect(row!.allowance).toBeUndefined();
    expect(row!.qtyAfterAllowance).toBe(50.4);
    expect(row!.qtyFinal).toBeCloseTo(50.4, 6);
  });

  it('7e) rebar:mesh = net + ไม่เข้าฐาน Σ เหล็ก (ไม่ pollute tiewire)', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'ตะแกรงเหล็ก (wire mesh)',
          quantity: 50,
          unit: 'กก.',
          unitPrice: 30,
        }),
        makeItem({ name: 'เหล็กเสริม DB12', quantity: 100, unit: 'กก.' }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const mesh = findMaterialOnly(res.rows, 'rebar:mesh');
    expect(mesh).toBeDefined();
    expect(mesh!.allowance).toBeUndefined();
    expect(mesh!.qtyFinal).toBe(50);
    expect(mesh!.flags).toBeUndefined();
    // tiewire derive ใช้เฉพาะ rebar size จริง (DB12=109 หลังเผื่อ) ไม่รวม mesh
    const tw = res.rows.find((r) => r.materialKey === 'consumable:tiewire');
    if (tw) {
      expect(tw.qtyAfterAllowance).toBeCloseTo((109 / 1000) * 30, 6);
    }
  });

  it('9) คอนกรีต ค.2 15 ลบ.ม. (mat 2050 + labor 289) → dual-column · totalAmount 35,085', () => {
    const groups = [
      makeGroup([
        makeItem({
          name: 'คอนกรีตฐานราก',
          quantity: 15,
          unit: 'ลบ.ม.',
          isMaterial: true,
          unitPrice: 2050,
        }),
        makeItem({
          name: 'ค่าเทคอนกรีตฐาน',
          quantity: 15,
          unit: 'ลบ.ม.',
          isMaterial: false,
          unitPrice: 289,
        }),
      ]),
    ];
    const res = consolidatePor4(groups);
    const dual = findDual(res.rows, 'concrete:c2');
    expect(dual).toBeDefined();
    expect(dual!.qtyFinal).toBe(15);
    expect(dual!.materialUnitPrice).toBe(2050);
    expect(dual!.laborUnitPrice).toBe(289);
    expect(dual!.materialAmount).toBeCloseTo(30_750, 6);
    expect(dual!.laborAmount).toBeCloseTo(4_335, 6);
    expect(dual!.totalAmount).toBeCloseTo(35_085, 6);
    expect(res.directCost).toBeCloseTo(35_085, 6);
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
