/**
 * Compact form สำหรับ project metadata + Factor F
 */
import { useProjectMeta } from '@/stores/projectMetaStore';
import { useBOQStore } from '@/stores/boqStore';
import { directCostTotal, effectiveFactorF } from '@/core/boqCalc';

export function ProjectMetaForm() {
  const meta = useProjectMeta();
  const items = useBOQStore((s) => s.items);
  const direct = directCostTotal(items);
  const factorF = effectiveFactorF(
    direct,
    meta.factorF,
    meta.advancePct,
    meta.retentionPct,
  );

  return (
    <div className="space-y-2 rounded border border-bg-border bg-bg-raised p-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        ข้อมูลโครงการ
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="ชื่อโครงการ"
          value={meta.name}
          onChange={(v) => meta.setField('name', v)}
          full
        />
        <Field
          label="เจ้าของ"
          value={meta.client}
          onChange={(v) => meta.setField('client', v)}
        />
        <Field
          label="จังหวัด"
          value={meta.province}
          onChange={(v) => meta.setField('province', v)}
        />
        <Field
          label="ที่ตั้ง"
          value={meta.location}
          onChange={(v) => meta.setField('location', v)}
          full
        />
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-bg-border pt-2">
        <NumberField
          label="Factor F"
          value={meta.factorF}
          step={0.0001}
          hint="0 = อัตโนมัติจากตาราง"
          onChange={(n) => meta.setField('factorF', n)}
        />
        <NumberField
          label="VAT %"
          value={meta.vatPct}
          step={0.1}
          onChange={(n) => meta.setField('vatPct', n)}
        />
      </div>

      {/* เลือกตาราง Factor F CGD 2567 — ใช้ตอน export ปร.5/ปร.6 */}
      <div className="grid grid-cols-2 gap-2 border-t border-bg-border pt-2">
        <SelectField
          label="เงินล่วงหน้า %"
          value={meta.advancePct}
          options={[0, 5, 10, 15]}
          hint="ตาราง Factor F (สงป.2567)"
          onChange={(n) => meta.setField('advancePct', n)}
        />
        <SelectField
          label="เงินประกัน %"
          value={meta.retentionPct}
          options={[0, 5, 10]}
          hint="หักประกันผลงาน"
          onChange={(n) => meta.setField('retentionPct', n)}
        />
      </div>

      <p className="text-[11px] text-ink-muted">
        Factor F ที่ใช้:{' '}
        <span className="font-mono text-ink-primary">{factorF.toFixed(4)}</span>{' '}
        {meta.factorF > 0
          ? '(กรอกเอง)'
          : `(ตาราง CGD 2567 · ค่างาน ${(direct / 1_000_000).toFixed(2)} ลบ.)`}
      </p>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  hint?: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-ink-muted">
        {label}
        {hint && <span className="ml-1 normal-case text-ink-muted">— {hint}</span>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-bg-border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}%
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-0.5 ${full ? 'col-span-2' : ''}`}>
      <span className="text-[10px] uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-bg-border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  step,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  hint?: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-ink-muted">
        {label}
        {hint && <span className="ml-1 normal-case text-ink-muted">— {hint}</span>}
      </span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (isFinite(n)) onChange(n);
        }}
        className="rounded border border-bg-border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent"
      />
    </label>
  );
}
