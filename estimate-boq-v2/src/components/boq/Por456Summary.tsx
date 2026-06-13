/**
 * Por456Summary — มุมมอง ปร.5 (สรุปราคา + Factor F) และ ปร.6 (ราคากลางรวม) อ่านอย่างเดียว
 * --------------------------------------------------------------------------
 * - เรียก buildPor456ViewModel(input) ครั้งเดียว → ใช้ตัวเลขชุดเดียวกับ export
 * - input ดึงจาก boqStore (disciplineGroups) + projectMetaStore (factorF/advance/retention)
 * - ไม่แตะ logic ใน por456ViewModel/por5Summary/por6Summary (เรียกใช้อย่างเดียว)
 */
import { useMemo } from 'react';
import { useBOQStore } from '@/stores/boqStore';
import { useProjectMeta } from '@/stores/projectMetaStore';
import { buildPor456ViewModel } from '@/services/compute/por456ViewModel';
import { formatCurrency } from '@/core/boqCalc';

export function Por456View({ mode }: { mode: 'por5' | 'por6' }) {
  const groups = useBOQStore((s) => s.disciplineGroups);
  const factorFOverride = useProjectMeta((s) => s.factorF);
  const advancePct = useProjectMeta((s) => s.advancePct);
  const retentionPct = useProjectMeta((s) => s.retentionPct);

  const vm = useMemo(() => {
    try {
      return {
        ok: true as const,
        data: buildPor456ViewModel({
          groups,
          factorFOverride: factorFOverride ?? 0,
          advancePct: advancePct ?? 0,
          retentionPct: retentionPct ?? 0,
        }),
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [groups, factorFOverride, advancePct, retentionPct]);

  if (!vm.ok) {
    return (
      <div className="rounded border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
        ⚠️ คำนวณ {mode === 'por5' ? 'ปร.5' : 'ปร.6'} ไม่สำเร็จ: {vm.error}
      </div>
    );
  }

  const { por4, factorF, por5, por6, por6Parts } = vm.data;

  if (por4.rows.length === 0) {
    return (
      <div className="rounded border border-dashed border-bg-border p-6 text-center text-xs text-ink-muted">
        ยังไม่มีรายการสำหรับ {mode === 'por5' ? 'ปร.5' : 'ปร.6'}
        <br />
        เพิ่มรายการในโหมด “แก้ไข BOQ” ก่อน
      </div>
    );
  }

  const isAutoF = (factorFOverride ?? 0) <= 0;

  return (
    <div className="space-y-3">
      {por4.warnings.length > 0 && (
        <div className="rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          <div className="mb-1 font-semibold">
            ⚠️ ตรวจสอบ {por4.warnings.length} รายการ (กระทบค่างานต้นทุน)
          </div>
          <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto pl-4">
            {por4.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {mode === 'por5' ? (
        <div className="space-y-2 rounded border border-bg-border bg-bg-raised p-3 text-xs">
          <div className="mb-1 text-[11px] font-semibold text-ink-secondary">
            ปร.5 — สรุปราคาค่าก่อสร้าง
          </div>
          <DefRow label="ค่างานต้นทุน (Direct Cost)" value={`฿ ${formatCurrency(por5.directCost)}`} />
          <DefRow
            label={`Factor F${isAutoF ? ' (อัตโนมัติจากตาราง CGD)' : ' (กำหนดเอง)'}`}
            value={factorF.toFixed(4)}
          />
          <div className="text-[10px] text-ink-muted">
            เงินล่วงหน้า {advancePct ?? 0}% · เงินประกันผลงาน {retentionPct ?? 0}% · VAT รวมใน Factor F แล้ว
          </div>
          <DefRow
            label="ค่าก่อสร้าง = ต้นทุน × F"
            value={`฿ ${formatCurrency(por5.constructionCost)}`}
          />
          <div className="border-t border-bg-border pt-1">
            <DefRow
              label="เงินประมาณ (ปัดหลักพัน)"
              value={`฿ ${formatCurrency(por5.approxAmount, 0)}`}
              bold
            />
          </div>
          <div className="text-right text-[11px] text-ink-secondary">
            ({por5.approxAmountText})
          </div>
          {por5.avgPerSqm != null && (
            <DefRow
              label="ราคาเฉลี่ยต่อ ตร.ม."
              value={`฿ ${formatCurrency(por5.avgPerSqm)}`}
            />
          )}
        </div>
      ) : (
        <div className="space-y-2 rounded border border-bg-border bg-bg-raised p-3 text-xs">
          <div className="mb-1 text-[11px] font-semibold text-ink-secondary">
            ปร.6 — สรุปราคากลางงานก่อสร้าง
          </div>
          <table className="w-full">
            <thead className="text-[10px] uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="w-8 px-1 py-1 text-center">#</th>
                <th className="px-1 py-1 text-left">รายการ</th>
                <th className="px-1 py-1 text-right">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {por6Parts.map((p, i) => (
                <tr key={i} className="border-t border-bg-border">
                  <td className="px-1 py-1 text-center text-ink-muted">{i + 1}</td>
                  <td className="px-1 py-1 text-ink-primary">{p.label}</td>
                  <td className="px-1 py-1 text-right font-mono text-ink-primary">
                    ฿ {formatCurrency(p.netAmount, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-bg-border font-semibold">
                <td className="px-1 py-1.5 text-right text-ink-secondary" colSpan={2}>
                  รวมราคากลางทั้งสิ้น
                </td>
                <td className="px-1 py-1.5 text-right font-mono text-ink-primary">
                  ฿ {formatCurrency(por6.total, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
          <div className="text-right text-[11px] text-ink-secondary">
            ({por6.totalText})
          </div>
        </div>
      )}
    </div>
  );
}

function DefRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-secondary">{label}</span>
      <span className={`font-mono text-ink-primary ${bold ? 'font-bold' : ''}`}>{value}</span>
    </div>
  );
}
