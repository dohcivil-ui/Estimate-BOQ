/**
 * PaintPanel — แผงควบคุมเครื่องมือ "ระบาย/เลือก member" + แก้ชิ้นที่เลือก + Legend
 * --------------------------------------------------------------------------
 * - โหมด: 🖌️ ระบาย (ลากกรอบ) / 👆 เลือก / ✕ ยกเลิก · pick (เฟส 2)
 * - มาร์กที่จะระบาย: chips F2/F1/C2/C3/GB1/GB2/GS + ตั้งชื่อเอง → setPaintMark
 *     F# → ฐาน (ระบายแล้วเป็นวงแหวน) · C# → เสา (กล่องทึบทับฐาน)
 * - แก้ชิ้นที่เลือก: เปลี่ยนชื่อ (renameMark) · ตั้งสีเอง (setColor) · ✓ ยืนยัน · ลบ
 * - Legend: จัดกลุ่มตาม mark (เฉพาะที่ระบายบนแบบแล้ว) + นับ + ซ่อน/แสดง
 *
 * ⚠️ นับเฉพาะ member ที่ระบายตำแหน่งแล้ว (geometry != null) — seed/ghost ไม่นับ
 */
import { useEffect, useMemo, useState } from 'react';
import { useActivePage } from '@/stores/drawingStore';
import {
  useDetectionStore,
  useMembersForPage,
  categoryForMark,
  splitMarks,
  type Member,
} from '@/stores/detectionStore';
import { useToolStore } from '@/stores/toolStore';
import { useLatestAnalysisForPage } from '@/stores/aiStore';
import { getMarkColor } from '@/services/markColors';
import type { AIItem } from '@/types/ai';

const PRESET_MARKS = ['F2', 'F1', 'C2', 'C3', 'GB1', 'GB2', 'GS'];
const SWATCHES = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  '#84cc16',
];

interface MarkGroup {
  mark: string;
  color: string;
  total: number;
  confirmed: number;
  ids: string[];
}

/**
 * จัดกลุ่มตาม "token" — รหัสประกอบ "F2,C2" นับแยก (F2 +1, C2 +1)
 *   เฉพาะ member ที่ระบายตำแหน่งแล้ว (geometry != null)
 */
function groupByToken(members: Member[]): MarkGroup[] {
  const map = new Map<string, MarkGroup>();
  for (const m of members) {
    if (!m.geometry) continue; // ตัด ghost/seed ออก
    for (const token of splitMarks(m.mark)) {
      let g = map.get(token);
      if (!g) {
        g = {
          mark: token,
          color: getMarkColor(token),
          total: 0,
          confirmed: 0,
          ids: [],
        };
        map.set(token, g);
      }
      g.total += 1;
      if (!g.ids.includes(m.id)) g.ids.push(m.id);
      if (m.status === 'confirmed') g.confirmed += 1;
    }
  }
  return [...map.values()].sort((a, b) => a.mark.localeCompare(b.mark));
}

/** ถอดจำนวนคาดต่อรหัส (F2/C2/GB1…) จากผล AI extract — สำหรับ cross-check */
function deriveExpected(items: AIItem[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!items) return out;
  for (const it of items) {
    const hay = `${it.name ?? ''} ${it.category ?? ''}`;
    const m = hay.match(/\b([A-Za-z]{1,3}\d+)\b/);
    if (!m) continue;
    const code = m[1]!.toUpperCase();
    const q = typeof it.quantity === 'number' ? it.quantity : 0;
    if (q > 0) out[code] = (out[code] ?? 0) + q;
  }
  return out;
}

function catLabel(mark: string): string {
  switch (categoryForMark(mark)) {
    case 'footing':
      return 'ฐาน (วงแหวน)';
    case 'column':
      return 'เสา';
    case 'beam':
      return 'คาน';
    case 'slab':
      return 'พื้น';
    default:
      return 'อื่น ๆ';
  }
}

export function PaintPanel() {
  const page = useActivePage();
  const pageId = page?.id ?? null;
  const members = useMembersForPage(pageId);

  const paintMark = useDetectionStore((s) => s.paintMark);
  const paintError = useDetectionStore((s) => s.paintError);
  const setPaintMark = useDetectionStore((s) => s.setPaintMark);
  const selectedIds = useDetectionStore((s) => s.selectedIds);
  const renameMark = useDetectionStore((s) => s.renameMark);
  const setColor = useDetectionStore((s) => s.setColor);
  const confirm = useDetectionStore((s) => s.confirm);
  const deleteMembers = useDetectionStore((s) => s.deleteMembers);
  const setSelection = useDetectionStore((s) => s.setSelection);
  const clearSelection = useDetectionStore((s) => s.clearSelection);
  const hiddenMarks = useDetectionStore((s) => s.hiddenMarks);
  const toggleHiddenMark = useDetectionStore((s) => s.toggleHiddenMark);
  const undo = useDetectionStore((s) => s.undo);
  const redo = useDetectionStore((s) => s.redo);
  const canUndo = useDetectionStore((s) => s.past.length > 0);
  const canRedo = useDetectionStore((s) => s.future.length > 0);
  const expectedByMark = useDetectionStore((s) => s.expectedByMark);
  const setExpected = useDetectionStore((s) => s.setExpected);
  const ocrBusy = useDetectionStore((s) => s.ocrBusy);
  const ocrStatus = useDetectionStore((s) => s.ocrStatus);

  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const activeTool = useToolStore((s) => s.activeTool);
  const clearDraft = useToolStore((s) => s.clearDraft);

  const latest = useLatestAnalysisForPage(pageId);

  const [markInput, setMarkInput] = useState('');
  const [renameInput, setRenameInput] = useState('');

  const groups = useMemo(() => groupByToken(members), [members]);
  const hidden = new Set(hiddenMarks);

  // เลือกชิ้นเดียว → prefill ช่องชื่อด้วยรหัสปัจจุบัน (เช่นผล OCR) ให้แก้ได้
  useEffect(() => {
    if (selectedIds.length === 1) {
      const m = members.find((x) => x.id === selectedIds[0]);
      setRenameInput(m?.mark ?? '');
    }
  }, [selectedIds, members]);

  if (!page) {
    return <p className="text-xs text-ink-muted">เปิดแบบก่อนจึงจะระบายได้</p>;
  }

  const handlePullExpected = () => {
    setExpected(deriveExpected(latest?.result?.items));
  };

  const applyMarkInput = () => {
    const v = markInput.trim().toUpperCase();
    if (v) {
      setPaintMark(v);
      setMarkInput('');
    }
  };

  const cancelAll = () => {
    clearSelection();
    clearDraft();
  };

  const paintedPieces = members.filter((m) => m.geometry != null).length;

  return (
    <div className="space-y-4">
      {/* ── โหมด ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => setActiveTool('paint')}
          className={`rounded px-2 py-2 text-xs font-medium transition-colors ${
            activeTool === 'paint'
              ? 'bg-accent text-ink-inverse'
              : 'bg-bg-raised text-ink-secondary hover:bg-bg-hover'
          }`}
        >
          🏷️ ติดป้าย
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('select')}
          className={`rounded px-2 py-2 text-xs font-medium transition-colors ${
            activeTool === 'select'
              ? 'bg-accent text-ink-inverse'
              : 'bg-bg-raised text-ink-secondary hover:bg-bg-hover'
          }`}
        >
          👆 เลือก
        </button>
        <button
          type="button"
          onClick={cancelAll}
          className="rounded bg-bg-raised px-2 py-1.5 text-xs text-ink-muted hover:bg-bg-hover"
        >
          ✕ ยกเลิก
        </button>
      </div>
      <p className="-mt-2 text-[11px] text-ink-muted">
        โหมดติดป้าย: <b>คลิกที่ป้ายรหัส</b> = OCR อ่านชื่อให้ · <b>ลากกรอบ</b> =
        วาดเอง
      </p>
      {ocrBusy && (
        <p className="-mt-2 flex items-center gap-1.5 text-[11px] text-accent">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-bg-border border-t-accent" />
          {ocrStatus ?? 'กำลังอ่านป้าย…'}
        </p>
      )}

      {/* ── มาร์กที่จะระบาย ──────────────────────────────── */}
      <div>
        <p className="mb-1 text-[11px] font-semibold text-ink-secondary">
          มาร์กที่จะระบาย
          {paintMark && (
            <span className="ml-1 font-normal text-ink-muted">
              — {catLabel(paintMark)}
            </span>
          )}
        </p>
        <div className="mb-2 flex gap-1">
          <input
            value={markInput}
            onChange={(e) => setMarkInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyMarkInput()}
            placeholder="ตั้งชื่อเอง เช่น F3, GB3"
            className="flex-1 rounded border border-bg-border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={applyMarkInput}
            className="rounded bg-bg-raised px-2 py-1 text-xs text-ink-secondary hover:bg-bg-hover"
          >
            ตั้ง
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESET_MARKS.map((mk) => (
            <button
              key={mk}
              type="button"
              onClick={() => setPaintMark(mk)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                paintMark === mk ? 'ring-2 ring-white' : ''
              }`}
              style={{ background: getMarkColor(mk), color: '#fff' }}
            >
              {mk}
            </button>
          ))}
        </div>
        {paintError && (
          <p className="mt-1 text-[11px] text-danger">⚠️ {paintError}</p>
        )}
      </div>

      {/* ── แก้ชิ้นที่เลือก ──────────────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="space-y-2 rounded border border-accent/40 bg-bg-raised/50 p-2">
          <p className="text-[11px] font-semibold text-ink-secondary">
            แก้ชิ้นที่เลือก ({selectedIds.length})
          </p>
          <div className="flex gap-1">
            <input
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = renameInput.trim().toUpperCase();
                  if (v) {
                    renameMark(selectedIds, v);
                    setRenameInput('');
                  }
                }
              }}
              placeholder="เปลี่ยนชื่อ → Enter"
              className="flex-1 rounded border border-bg-border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => {
                const v = renameInput.trim().toUpperCase();
                if (v) {
                  renameMark(selectedIds, v);
                  setRenameInput('');
                }
              }}
              className="rounded bg-bg-raised px-2 py-1 text-xs text-ink-secondary hover:bg-bg-hover"
            >
              ตั้งชื่อ
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setColor(selectedIds, hex)}
                className="h-5 w-5 rounded-sm ring-1 ring-bg-border"
                style={{ background: hex }}
                aria-label={`สี ${hex}`}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => confirm(selectedIds)}
              className="flex-1 rounded bg-success/20 px-2 py-1.5 text-xs text-success hover:bg-success/30"
            >
              ✓ ยืนยัน
            </button>
            <button
              type="button"
              onClick={() => deleteMembers(selectedIds)}
              className="rounded bg-danger/20 px-2 py-1.5 text-xs text-danger hover:bg-danger/30"
            >
              🗑️ ลบ
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded bg-bg-raised px-2 py-1.5 text-xs text-ink-muted hover:bg-bg-hover"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Undo / Redo ──────────────────────────────────── */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          className="flex-1 rounded bg-bg-raised px-2 py-1 text-xs text-ink-secondary hover:bg-bg-hover disabled:opacity-40"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          className="flex-1 rounded bg-bg-raised px-2 py-1 text-xs text-ink-secondary hover:bg-bg-hover disabled:opacity-40"
        >
          ↷ Redo
        </button>
      </div>

      {/* ── Legend ───────────────────────────────────────── */}
      <div className="border-t border-bg-border pt-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-ink-secondary">
            Legend — ติดป้ายแล้ว {paintedPieces} ชิ้น
          </p>
          <button
            type="button"
            onClick={handlePullExpected}
            disabled={!latest?.result?.items?.length}
            title="ดึงจำนวนคาดต่อรหัสจากผลวิเคราะห์ AI ล่าสุด (กฎ 11 grid-first) มาเทียบกับที่ยืนยัน"
            className="rounded bg-bg-raised px-2 py-0.5 text-[10px] text-ink-secondary hover:bg-bg-hover disabled:opacity-40"
          >
            ↻ ดึงจำนวนคาดจาก AI
          </button>
        </div>
        {groups.length === 0 ? (
          <p className="text-[11px] text-ink-muted">
            ยังไม่มีชิ้นงาน — คลิกที่ป้ายรหัสบนแบบเพื่อให้ OCR อ่านชื่อ
          </p>
        ) : (
          <ul className="space-y-1">
            {groups.map((g) => {
              const isHidden = hidden.has(g.mark);
              const expected = expectedByMark[g.mark];
              const mismatch =
                expected != null && expected > 0 && g.confirmed !== expected;
              return (
                <li key={g.mark} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelection(g.ids)}
                    className={`flex flex-1 items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-bg-hover ${
                      isHidden ? 'opacity-40' : ''
                    }`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ background: g.color }}
                    />
                    <span className="font-medium text-ink-primary">
                      {g.mark}
                    </span>
                    {mismatch && (
                      <span title="จำนวนยืนยัน ≠ ที่ AI คาด">⚠️</span>
                    )}
                    <span className="ml-auto text-[10px] text-ink-muted">
                      ยืนยันแล้ว{' '}
                      <span className={g.confirmed > 0 ? 'text-success' : ''}>
                        {g.confirmed}
                      </span>
                      {expected != null && expected > 0 && (
                        <span className={mismatch ? 'text-warning' : ''}>
                          {' '}
                          / AI คาด {expected}
                        </span>
                      )}
                      {g.total !== g.confirmed && (
                        <span className="text-ink-muted">
                          {' '}
                          (ติดแล้ว {g.total})
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleHiddenMark(g.mark)}
                    title={isHidden ? 'แสดง' : 'ซ่อน'}
                    className="rounded px-1 py-1 text-xs text-ink-muted hover:bg-bg-hover"
                  >
                    {isHidden ? '🙈' : '👁️'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
