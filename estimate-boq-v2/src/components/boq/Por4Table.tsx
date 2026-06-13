/**
 * Por4Table — มุมมอง ปร.4 (อ่านอย่างเดียว) จาก consolidatePor4(disciplineGroups)
 * --------------------------------------------------------------------------
 * - รวบ BOQ rows (วัสดุ/ค่าแรง แยกรายการ) → ปร.4 dual-column ผ่าน consolidatePor4
 * - read-only: ลำดับ | รายการ | จำนวน | หน่วย | ค่าวัสดุ/หน่วย | จำนวนเงินวัสดุ |
 *              ค่าแรง/หน่วย | จำนวนเงินค่าแรง | รวม
 * - ช่อง unitPrice/amount ที่ undefined → "-"
 * - warnings จาก Por4Result (CONSUMABLE_MISSING ฯลฯ) → banner ด้านบน
 * - ไม่แตะ logic ใน por4Consolidate.ts (เรียกใช้อย่างเดียว)
 */
import { useMemo } from 'react';
import { useBOQStore } from '@/stores/boqStore';
import { consolidatePor4, type Por4Row } from '@/services/compute/por4Consolidate';
import { formatCurrency } from '@/core/boqCalc';

const fmtQty = (n: number): string =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** เงิน/ราคา — undefined → "-" */
const money = (n: number | undefined): string =>
  n == null ? '-' : formatCurrency(n);

export function Por4Table() {
  const groups = useBOQStore((s) => s.disciplineGroups);

  const result = useMemo(() => {
    try {
      return { ok: true as const, data: consolidatePor4(groups) };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [groups]);

  if (!result.ok) {
    return (
      <div className="rounded border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
        ⚠️ รวบ ปร.4 ไม่สำเร็จ: {result.error}
      </div>
    );
  }

  const { rows, directCost, warnings } = result.data;

  if (rows.length === 0) {
    return (
      <div className="rounded border border-dashed border-bg-border p-6 text-center text-xs text-ink-muted">
        ยังไม่มีรายการสำหรับ ปร.4
        <br />
        เพิ่มรายการในโหมด “แก้ไข BOQ” ก่อน
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {warnings.length > 0 && (
        <div className="rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          <div className="mb-1 font-semibold">
            ⚠️ ตรวจสอบ {warnings.length} รายการก่อนใช้ ปร.4
          </div>
          <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-4">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded border border-bg-border">
        <table className="w-full text-xs">
          <thead className="bg-bg-raised text-[10px] uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="w-8 px-1 py-1.5 text-center">#</th>
              <th className="px-1 py-1.5 text-left">รายการ</th>
              <th className="w-20 px-1 py-1.5 text-right">จำนวน</th>
              <th className="w-14 px-1 py-1.5 text-center">หน่วย</th>
              <th className="w-24 px-1 py-1.5 text-right">ค่าวัสดุ/หน่วย</th>
              <th className="w-24 px-1 py-1.5 text-right">จำนวนเงินวัสดุ</th>
              <th className="w-24 px-1 py-1.5 text-right">ค่าแรง/หน่วย</th>
              <th className="w-24 px-1 py-1.5 text-right">จำนวนเงินค่าแรง</th>
              <th className="w-28 px-1 py-1.5 text-right">รวม</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <Por4RowView key={`${r.section}-${r.materialKey ?? r.name}-${idx}`} row={r} idx={idx} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-bg-border bg-bg-raised font-semibold">
              <td className="px-1 py-1.5 text-right text-ink-secondary" colSpan={8}>
                ค่างานต้นทุนรวม (Direct Cost)
              </td>
              <td className="px-1 py-1.5 text-right font-mono text-ink-primary">
                {formatCurrency(directCost)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Por4RowView({ row, idx }: { row: Por4Row; idx: number }) {
  const unmapped = row.flags?.includes('UNMAPPED');
  return (
    <tr className="border-t border-bg-border hover:bg-bg-hover">
      <td className="px-1 py-1 text-center text-ink-muted">{idx + 1}</td>
      <td className="px-1 py-1 text-ink-primary">
        {row.name}
        {unmapped && (
          <span
            className="ml-1 rounded bg-warning/20 px-1 text-[9px] text-warning"
            title="ไม่พบใน dictionary — แสดงผ่านโดยไม่รวบ/เผื่อ"
          >
            ไม่ระบุหมวด
          </span>
        )}
      </td>
      <td className="px-1 py-1 text-right font-mono text-ink-secondary">
        {fmtQty(row.qtyFinal)}
      </td>
      <td className="px-1 py-1 text-center text-ink-secondary">{row.unit}</td>
      <td className="px-1 py-1 text-right font-mono text-ink-secondary">
        {money(row.materialUnitPrice)}
      </td>
      <td className="px-1 py-1 text-right font-mono text-ink-primary">
        {money(row.materialAmount)}
      </td>
      <td className="px-1 py-1 text-right font-mono text-ink-secondary">
        {money(row.laborUnitPrice)}
      </td>
      <td className="px-1 py-1 text-right font-mono text-ink-primary">
        {money(row.laborAmount)}
      </td>
      <td className="px-1 py-1 text-right font-mono font-semibold text-ink-primary">
        {formatCurrency(row.totalAmount)}
      </td>
    </tr>
  );
}
