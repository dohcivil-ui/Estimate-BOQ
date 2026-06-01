/**
 * MarkDimsDialog — popup เติม "มิติต่อ mark" (ทาง A: compute structural โดยไม่พึ่ง AI)
 * --------------------------------------------------------------------------
 * field-set เปลี่ยนตามชนิด (จาก categoryForMark): ฐาน/เสา(ตอม่อ)/คาน/พื้น
 *   - count มาจาก tag (ไม่กรอกที่นี่) · ที่นี่กรอกแค่ "มิติ/เหล็ก"
 *   - ช่องว่าง/<=0 → ไฮไลต์แดง แต่ Save ได้ (builder จะขึ้น ❓ เอง)
 * Save → setMarkDim(mark, dims) → BOQ preview recompute realtime
 */
import { useState } from 'react';
import {
  categoryForMark,
  type MarkDims,
  type MarkDimsSource,
  type MemberCategory,
} from '@/stores/detectionStore';
import { autoExcavDepth } from '@/services/compute/footingCompute';

type DimsKind = 'footing' | 'column' | 'beam' | 'slab';

/** map หมวด → kind ที่กรอกมิติได้ (other = กรอกไม่ได้) */
function kindOf(cat: MemberCategory): DimsKind | null {
  if (cat === 'footing' || cat === 'column' || cat === 'beam' || cat === 'slab')
    return cat;
  return null;
}

const KIND_LABEL: Record<DimsKind, string> = {
  footing: 'ฐานราก',
  column: 'ตอม่อ/เสา',
  beam: 'คาน',
  slab: 'พื้น',
};

/** input ตัวเลข — คืน NaN ถ้าว่าง (caller ตัดสินใจ highlight) */
function numField(v: string): number {
  if (v.trim() === '') return NaN;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

interface Props {
  mark: string;
  existing: MarkDims | undefined;
  /** ที่มาของมิติเดิม — 'ai' แสดงป้าย "AI อ่าน" ให้ตรวจก่อนใช้ */
  source?: MarkDimsSource;
  /** สูงตอม่อคู่ (ม.) — ใช้โชว์ก้นหลุมที่คำนวณเองในฟอร์มฐาน (0/undefined = ไม่มีคู่) */
  pedestalH?: number;
  onSave: (dims: MarkDims) => void;
  onClear: () => void;
  onClose: () => void;
}

export function MarkDimsDialog({
  mark,
  existing,
  source,
  pedestalH,
  onSave,
  onClear,
  onClose,
}: Props) {
  const kind = kindOf(categoryForMark(mark));

  // ── ฐานราก ──
  const ef = existing?.kind === 'footing' ? existing : null;
  const [fW, setFW] = useState(ef ? String(ef.W) : '');
  const [fL, setFL] = useState(ef ? String(ef.L) : '');
  const [fT, setFT] = useState(ef ? String(ef.T) : '');
  const [fDepth, setFDepth] = useState(ef && ef.depth != null ? String(ef.depth) : '');
  const [fRebar, setFRebar] = useState(ef?.rebar ?? '');
  const [fTie, setFTie] = useState(ef?.tieRebar ?? '');

  // ก้นหลุมที่โค้ดคำนวณเอง (โชว์เป็น placeholder — ว่าง = ใช้ค่านี้)
  const fTnum = numField(fT);
  const autoDepth = Number.isFinite(fTnum)
    ? autoExcavDepth({ T: fTnum, pedestalH })
    : null;

  // ── ตอม่อ/เสา ──
  const ec = existing?.kind === 'column' ? existing : null;
  const [cW, setCW] = useState(ec ? String(ec.W) : '');
  const [cL, setCL] = useState(ec ? String(ec.L) : '');
  const [cH, setCH] = useState(ec ? String(ec.H) : '');
  const [cVBars, setCVBars] = useState(ec?.vBars ?? '');
  const [cTie, setCTie] = useState(ec?.tie ?? '');

  // ── คาน ──
  const eb = existing?.kind === 'beam' ? existing : null;
  const [bW, setBW] = useState(eb ? String(eb.W) : '');
  const [bH, setBH] = useState(eb ? String(eb.H) : '');
  const [bPieces, setBPieces] = useState<{ length: string; count: string }[]>(
    eb && eb.pieces.length > 0
      ? eb.pieces.map((p) => ({ length: String(p.length), count: String(p.count) }))
      : [{ length: '', count: '' }],
  );
  const [bMain, setBMain] = useState(eb?.mainBars ?? '');
  const [bStirrup, setBStirrup] = useState(eb?.stirrup ?? '');

  // ── พื้น ──
  const es = existing?.kind === 'slab' ? existing : null;
  const [sArea, setSArea] = useState(es ? String(es.areaSqm) : '');
  const [sThk, setSThk] = useState(es ? String(es.thickness) : '');
  const [sWire, setSWire] = useState(es ? String(es.meshWireMM) : '');
  const [sSpacing, setSSpacing] = useState(es ? String(es.meshSpacing) : '');
  const [sSand, setSSand] = useState(es?.sandThk != null ? String(es.sandThk) : '');

  const bad = (n: number) => !Number.isFinite(n) || n <= 0;

  const handleSave = () => {
    let dims: MarkDims;
    switch (kind) {
      case 'footing':
        dims = {
          kind: 'footing',
          W: numField(fW),
          L: numField(fL),
          T: numField(fT),
          ...(fDepth.trim() === '' ? {} : { depth: numField(fDepth) }),
          rebar: fRebar.trim(),
          ...(fTie.trim() === '' ? {} : { tieRebar: fTie.trim() }),
        };
        break;
      case 'column':
        dims = {
          kind: 'column',
          W: numField(cW),
          L: numField(cL),
          H: numField(cH),
          vBars: cVBars.trim(),
          tie: cTie.trim(),
        };
        break;
      case 'beam':
        dims = {
          kind: 'beam',
          W: numField(bW),
          H: numField(bH),
          pieces: bPieces.map((p) => ({
            length: numField(p.length),
            count: numField(p.count),
          })),
          mainBars: bMain.trim(),
          stirrup: bStirrup.trim(),
        };
        break;
      case 'slab':
        dims = {
          kind: 'slab',
          areaSqm: numField(sArea),
          thickness: numField(sThk),
          meshWireMM: numField(sWire),
          meshSpacing: numField(sSpacing),
          sandThk: sSand.trim() === '' ? undefined : numField(sSand),
        };
        break;
      default:
        return;
    }
    onSave(dims);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-3 rounded-lg border border-bg-border bg-bg-base p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-primary">
            เติมมิติ <span className="text-accent">{mark}</span>
            {kind && (
              <span className="ml-1 text-xs text-ink-muted">
                ({KIND_LABEL[kind]})
              </span>
            )}
            {existing && source === 'ai' && (
              <span
                className="ml-1 rounded bg-accent/20 px-1 text-[10px] text-accent"
                title="มิติชุดนี้ AI อ่านมาจากแบบขยาย — ตรวจให้ชัวร์ก่อน บันทึกแล้วจะถือว่ายืนยันเอง"
              >
                AI อ่าน — ตรวจก่อน
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 text-ink-muted hover:bg-bg-hover"
          >
            ✕
          </button>
        </div>

        {kind == null ? (
          <p className="text-xs text-warning">
            ⚠️ รหัส {mark} ไม่เข้าหมวดที่คำนวณได้ (ฐาน/เสา/คาน/พื้น) — เปลี่ยนชื่อให้ตรงหมวดก่อน
          </p>
        ) : kind === 'footing' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <NumIn label="กว้าง W (ม.)" value={fW} onChange={setFW} bad={bad(numField(fW))} />
              <NumIn label="ยาว L (ม.)" value={fL} onChange={setFL} bad={bad(numField(fL))} />
              <NumIn label="หนา T (ม.)" value={fT} onChange={setFT} bad={bad(numField(fT))} />
            </div>
            <NumIn
              label="ก้นหลุม/ลึก (ม.) — ว่าง = โปรแกรมคำนวณเอง"
              value={fDepth}
              onChange={setFDepth}
              bad={false}
              placeholder={
                autoDepth != null ? `auto ${autoDepth.toFixed(2)}` : 'auto'
              }
            />
            {fDepth.trim() === '' && autoDepth != null && (
              <p className="-mt-1 text-[10px] text-ink-muted">
                โปรแกรมจะใช้ {autoDepth.toFixed(2)} ม. (สูงตอม่อ {(pedestalH ?? 0).toFixed(2)} + หนาฐาน + lean + ทราย)
              </p>
            )}
            <TxtIn
              label='เหล็กตะแกรง (เช่น "16-DB12" หรือ "DB12@0.15")'
              value={fRebar}
              onChange={setFRebar}
              bad={fRebar.trim() === ''}
            />
            <TxtIn
              label='เหล็กรัดรอบฐาน (เช่น "RB9@0.20") — ถ้ามี'
              value={fTie}
              onChange={setFTie}
              bad={false}
            />
          </div>
        ) : kind === 'column' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <NumIn label="กว้าง W (ม.)" value={cW} onChange={setCW} bad={bad(numField(cW))} />
              <NumIn label="ยาว L (ม.)" value={cL} onChange={setCL} bad={bad(numField(cL))} />
              <NumIn label="สูง H (ม.)" value={cH} onChange={setCH} bad={bad(numField(cH))} />
            </div>
            <TxtIn
              label='เหล็กยืน (เช่น "8-DB12")'
              value={cVBars}
              onChange={setCVBars}
              bad={cVBars.trim() === ''}
            />
            <TxtIn
              label='ปลอก (เช่น "RB9@0.15")'
              value={cTie}
              onChange={setCTie}
              bad={cTie.trim() === ''}
            />
          </div>
        ) : kind === 'beam' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <NumIn label="กว้าง W (ม.)" value={bW} onChange={setBW} bad={bad(numField(bW))} />
              <NumIn label="สูง H (ม.)" value={bH} onChange={setBH} bad={bad(numField(bH))} />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-ink-secondary">
                ช่วงคาน (ยาว ม. × จำนวนตัว)
              </p>
              <div className="space-y-1">
                {bPieces.map((p, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input
                      value={p.length}
                      onChange={(e) =>
                        setBPieces((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, length: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder="ยาว"
                      className={`w-20 rounded border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent ${
                        bad(numField(p.length)) ? 'border-danger' : 'border-bg-border'
                      }`}
                    />
                    <span className="text-ink-muted">×</span>
                    <input
                      value={p.count}
                      onChange={(e) =>
                        setBPieces((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, count: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder="จำนวน"
                      className={`w-20 rounded border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent ${
                        bad(numField(p.count)) ? 'border-danger' : 'border-bg-border'
                      }`}
                    />
                    {bPieces.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setBPieces((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="rounded px-1.5 text-xs text-danger hover:bg-bg-hover"
                      >
                        −
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setBPieces((prev) => [...prev, { length: '', count: '' }])
                }
                className="mt-1 rounded bg-bg-raised px-2 py-0.5 text-[11px] text-ink-secondary hover:bg-bg-hover"
              >
                + เพิ่มช่วง
              </button>
            </div>
            <TxtIn
              label='เหล็กยืนหลัก (เช่น "4-DB16")'
              value={bMain}
              onChange={setBMain}
              bad={bMain.trim() === ''}
            />
            <TxtIn
              label='ปลอก (เช่น "RB6@0.15")'
              value={bStirrup}
              onChange={setBStirrup}
              bad={bStirrup.trim() === ''}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <NumIn
                label="พื้นที่ (ตร.ม.)"
                value={sArea}
                onChange={setSArea}
                bad={bad(numField(sArea))}
              />
              <NumIn
                label="หนา (ม.)"
                value={sThk}
                onChange={setSThk}
                bad={bad(numField(sThk))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumIn
                label="ลวดตะแกรง (มม.)"
                value={sWire}
                onChange={setSWire}
                bad={bad(numField(sWire))}
              />
              <NumIn
                label="ระยะตะแกรง (ม.)"
                value={sSpacing}
                onChange={setSSpacing}
                bad={bad(numField(sSpacing))}
              />
            </div>
            <NumIn
              label="ทรายรองพื้น (ม.) — เว้นว่างได้"
              value={sSand}
              onChange={setSSand}
              bad={false}
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {existing && (
            <button
              type="button"
              onClick={() => {
                onClear();
                onClose();
              }}
              className="rounded bg-danger/15 px-3 py-1.5 text-xs text-danger hover:bg-danger/25"
            >
              ลบมิติ
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={kind == null}
            className="ml-auto rounded bg-accent px-4 py-1.5 text-xs font-medium text-ink-inverse hover:opacity-90 disabled:opacity-40"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ช่องกรอกย่อย ────────────────────────────────────────────
function NumIn({
  label,
  value,
  onChange,
  bad,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  bad: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] text-ink-muted">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent ${
          bad ? 'border-danger' : 'border-bg-border'
        }`}
      />
    </label>
  );
}

function TxtIn({
  label,
  value,
  onChange,
  bad,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  bad: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] text-ink-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent ${
          bad ? 'border-danger' : 'border-bg-border'
        }`}
      />
    </label>
  );
}
