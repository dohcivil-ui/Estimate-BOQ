/**
 * Integration test — pipeline เต็มสายลง template ราชการจริง (boq-master-cgd.xlsx)
 * ─────────────────────────────────────────────────────────────────────────
 * por4 (โครงสร้าง) → buildExportData → strip → fillBoqTemplate → reload เช็คช่อง input
 * + verify golden chain (ceil 1.2965 → 12,506,000)
 *
 * ยืนยัน: (1) ExcelJS โหลด template ได้หลัง strip · (2) รายการลง code 2 (rows 19-44)
 * (3) Factor F bracket ลง N18-N21 · (4) meta ลงถูก · (5) verify ok ตรง golden
 *
 * หมายเหตุ: ExcelJS ไม่ recalc สูตร → เช็คได้เฉพาะ "ช่อง input" (C/E/G/N18-N21/meta)
 * ส่วนตัวเลขสุดท้าย (F29/ปร.6) พิสูจน์ผ่าน verifyBoqInput (double-entry) + เปิด Excel จริง
 */
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { buildPor456ViewModel } from './compute/por456ViewModel';
import { factorFBracketFor } from '@/core/boqCalc';
import { buildExportData } from './export/buildExportData';
import { verifyBoqInput } from './export/govExcelVerify';
import { fillBoqTemplate } from './export/govExcelExport';
import { stripUnsupportedParts } from './govTemplateExport';
import type { BOQItem, DisciplineGroup } from '@/types/boq';

const TEMPLATE = 'src/assets/templates/boq-master-cgd.xlsx';

function item(p: Partial<BOQItem> & { name: string }): BOQItem {
  return {
    id: crypto.randomUUID(),
    category: p.category ?? 'ฐานราก',
    name: p.name,
    unit: p.unit ?? 'ลบ.ม.',
    quantity: p.quantity ?? 0,
    unitPrice: p.unitPrice ?? 0,
    isMaterial: p.isMaterial ?? true,
    wastePct: 0,
    source: 'ai',
    createdAt: '2026-06-14T00:00:00Z',
    updatedAt: '2026-06-14T00:00:00Z',
  };
}

// fixture: คอนกรีตฐานราก ก้อนเดียว มูลค่า = golden buildingNet 9,646,704.50
// → concrete:c2 → cgdSectionMap code 2 (sub 1.5) · directCost ตรง golden
const groups: DisciplineGroup[] = [
  {
    discipline: 'structural',
    pageId: 'p1',
    pageName: 'p1',
    items: [item({ name: 'คอนกรีตฐานราก', quantity: 1, unit: 'รวม', unitPrice: 9_646_704.5 })],
    analyzedAt: '2026-06-14T00:00:00Z',
    status: 'confirmed',
  },
];

describe('govTemplateExport — fill template ราชการจริง (งานโครงสร้าง v1)', () => {
  const vm = buildPor456ViewModel({ groups, factorFOverride: 0, advancePct: 0, retentionPct: 0 });
  const bracket = factorFBracketFor(vm.por4.directCost, 0, 0)!;
  const { data, warnings } = buildExportData({
    por4: vm.por4,
    meta: { projectName: 'อาคารทดสอบ', location: 'อ.เมือง', province: 'หนองคาย' },
    factorF: bracket,
    conditions: { loanInterest: 0.07, vat: 0.07, equipmentVat: 0.07 },
  });

  it('directCost + bracket ตรง golden (ceil 1.2965)', () => {
    expect(vm.por4.directCost).toBeCloseTo(9_646_704.5, 6);
    expect(bracket.rangeLow).toBe(5_000_000);
    expect(bracket.rangeHigh).toBe(10_000_000);
    expect(bracket.fLow).toBe(1.302);
    expect(bracket.fHigh).toBe(1.296);
  });

  it('buildExportData: รายการลง code 2 (งานโครงสร้าง) ไม่มี UNMAPPED', () => {
    expect(warnings.filter((w) => w.startsWith('UNMAPPED_CGD'))).toHaveLength(0);
    expect(data.buildingItems[2]).toBeDefined();
    const rows = data.buildingItems[2]!;
    expect(rows[0]!.type).toBe('sub');
    const itemRow = rows.find((r) => r.type === 'item');
    expect(itemRow).toBeDefined();
  });

  it('verify golden: ok + por6 = 12,506,000 (อาคารล้วน, ceil)', () => {
    const r = verifyBoqInput(data);
    expect(r.ok).toBe(true);
    expect(r.expect.factorFCeil).toBe(1.2965);
    expect(r.expect.por5kNet).toBe(12_506_000);
    expect(r.expect.por6Total).toBe(12_506_000);
  });

  it('fill template จริง: ExcelJS โหลดได้หลัง strip + ช่อง input ลงถูก', async () => {
    const raw = await readFile(TEMPLATE);
    const stripped = await stripUnsupportedParts(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    );
    const out = await fillBoqTemplate(stripped, data);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out);

    // ปร4.อาคาร code 2 = rows 19-44: row19 sub label, row20 รายการ (C=qty, E=ราคาวัสดุ)
    const ws = wb.getWorksheet('ปร4.อาคาร')!;
    expect(String(ws.getCell('B19').value ?? '')).toContain('1.5');
    expect(ws.getCell('C20').value).toBe(1);
    expect(ws.getCell('E20').value).toBe(9_646_704.5);

    // Factor F bracket ลง N18-N21
    const ff = wb.getWorksheet('factor F')!;
    expect(ff.getCell('N18').value).toBe(5_000_000);
    expect(ff.getCell('N19').value).toBe(10_000_000);
    expect(ff.getCell('N20').value).toBe(1.302);
    expect(ff.getCell('N21').value).toBe(1.296);

    // meta: ชื่องาน (prefix 'งานก่อสร้าง  ' + ค่า)
    expect(String(ws.getCell('A3').value ?? '')).toContain('อาคารทดสอบ');
  });
});
