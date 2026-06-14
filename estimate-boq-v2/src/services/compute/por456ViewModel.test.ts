/**
 * Tests สำหรับ buildPor456ViewModel — assembly ปร.4/5/6 (เลขล็อก)
 * ยืนยัน chain por4.directCost → factorF → por5 → por6 ต่อกันถูก + override F ทำงาน
 */
import { describe, it, expect } from 'vitest';
import { buildPor456ViewModel } from './por456ViewModel';
import { effectiveFactorF } from '@/core/boqCalc';
import type { BOQItem, DisciplineGroup } from '@/types/boq';

// ── factory helpers ──────────────────────────────────────────────────
let idCounter = 0;
function makeItem(p: Partial<BOQItem> & { name: string }): BOQItem {
  idCounter += 1;
  return {
    id: `vm-${idCounter}`,
    category: p.category ?? 'ฐานราก',
    name: p.name,
    unit: p.unit ?? 'ลบ.ม.',
    quantity: p.quantity ?? 0,
    unitPrice: p.unitPrice ?? 0,
    isMaterial: p.isMaterial ?? true,
    wastePct: p.wastePct ?? 0,
    thickness: p.thickness,
    source: p.source ?? 'ai',
    sourceRef: p.sourceRef,
    notes: p.notes,
    createdAt: '2026-06-12T00:00:00Z',
    updatedAt: '2026-06-12T00:00:00Z',
  };
}
function makeGroup(items: BOQItem[]): DisciplineGroup {
  return {
    discipline: 'structural',
    pageId: 'p1',
    pageName: 'p1',
    items,
    analyzedAt: '2026-06-12T00:00:00Z',
    status: 'confirmed',
  };
}

// fixture: คอนกรีต ค.2 15 ลบ.ม. (mat 2050 + labor 289) → directCost ล็อก = 35,085
//   mat 15×2050=30,750 · labor 15×289=4,335 (pct=0, qtyFinal=15) — ตรงกับ por4 test 9
function concreteGroups(): DisciplineGroup[] {
  return [
    makeGroup([
      makeItem({ name: 'คอนกรีตฐานราก', quantity: 15, unitPrice: 2050 }),
      makeItem({
        name: 'ค่าเทคอนกรีตฐาน',
        quantity: 15,
        unitPrice: 289,
        isMaterial: false,
      }),
    ]),
  ];
}

describe('buildPor456ViewModel', () => {
  it('1) chain ต่อกันถูก: por4.directCost → factorF → por5 → por6', () => {
    const vm = buildPor456ViewModel({
      groups: concreteGroups(),
      factorFOverride: 0,
      advancePct: 0,
      retentionPct: 0,
    });

    // anchor: directCost ล็อกจาก ปร.4 (deterministic)
    expect(vm.por4.directCost).toBeCloseTo(35_085, 6);

    // factorF = ผลของ effectiveFactorF จริง (ฐาน = por4.directCost ไม่ใช่สายเก่า)
    expect(vm.factorF).toBe(effectiveFactorF(vm.por4.directCost, 0, 0, 0));
    expect(vm.factorF).toBeGreaterThan(1);
    expect(vm.factorF).toBeLessThan(1.4);

    // ปร.5: constructionCost = directCost × factorF (full precision)
    expect(vm.por5.constructionCost).toBeCloseTo(
      vm.por4.directCost * vm.factorF,
      6,
    );

    // ปร.6: ส่วนเดียว = ค่าก่อสร้างอาคาร = por5.approxAmount (ไม่ปัดซ้ำ)
    expect(vm.por6Parts).toHaveLength(1);
    expect(vm.por6Parts[0]!.label).toBe('ค่าก่อสร้างอาคาร');
    expect(vm.por6Parts[0]!.netAmount).toBe(vm.por5.approxAmount);
    expect(vm.por6.total).toBe(vm.por5.approxAmount);
    expect(vm.por6.totalText).toContain('บาทถ้วน');
  });

  it('2) factorFOverride > 0 → ใช้ค่า override ตรงๆ (ไม่ interpolate)', () => {
    const vm = buildPor456ViewModel({
      groups: concreteGroups(),
      factorFOverride: 1.3,
      advancePct: 0,
      retentionPct: 0,
    });
    expect(vm.factorF).toBe(1.3);
    expect(vm.por5.constructionCost).toBeCloseTo(vm.por4.directCost * 1.3, 6);
  });

  it('3) groups ว่าง → directCost 0 · ไม่ throw', () => {
    const vm = buildPor456ViewModel({
      groups: [],
      factorFOverride: 0,
      advancePct: 0,
      retentionPct: 0,
    });
    expect(vm.por4.directCost).toBe(0);
    expect(vm.por6.total).toBe(vm.por5.approxAmount);
  });

  it('5) golden งานโครงสร้างล้วน: directCost 9,646,704.50 → F ceil 1.2965 → ปร.5 12,506,000 (display = export)', () => {
    // anchor v1: ยอดอาคาร 9,646,704.50 (อาคารเรียน 324ล./55-ข)
    // → effectiveFactorF ceil = 1.2965 (ไม่ใช่ round 1.2964)
    // → constructionCost 12,506,952.38 → floor1000 = 12,506,000 (ตรง govExcelVerify por5kNet)
    const vm = buildPor456ViewModel({
      groups: [
        makeGroup([
          // UNMAPPED passthrough: qtyFinal=ceil2dp(1)=1, amount=9,646,704.50 → directCost ตรง
          makeItem({ name: 'รวมต้นทุนอาคาร', quantity: 1, unit: 'รวม', unitPrice: 9_646_704.5 }),
        ]),
      ],
      factorFOverride: 0,
      advancePct: 0,
      retentionPct: 0,
    });
    expect(vm.por4.directCost).toBeCloseTo(9_646_704.5, 6);
    expect(vm.factorF).toBe(1.2965);
    expect(vm.por5.constructionCost).toBeCloseTo(12_506_952.38425, 4);
    expect(vm.por5.constructionCostBaht).toBe(12_506_952);
    expect(vm.por5.approxAmount).toBe(12_506_000);
    expect(vm.por6.total).toBe(12_506_000);
  });

  it('4) ส่ง warnings ของ ปร.4 ทะลุถึง view (เช่น CONSUMABLE_MISSING)', () => {
    // เหล็กเสริมล้วน ไม่มีลวดผูก → ปร.4 เตือน CONSUMABLE_MISSING
    const vm = buildPor456ViewModel({
      groups: [
        makeGroup([
          makeItem({ name: 'เหล็กเสริม DB12', quantity: 100, unit: 'กก.' }),
        ]),
      ],
      factorFOverride: 0,
      advancePct: 0,
      retentionPct: 0,
    });
    expect(
      vm.por4.warnings.some((w) => w.startsWith('CONSUMABLE_MISSING')),
    ).toBe(true);
  });
});
