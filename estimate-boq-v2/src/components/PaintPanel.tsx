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
import { useActivePage, useDrawingStore } from '@/stores/drawingStore';
import {
  useDetectionStore,
  useMembersForPage,
  splitMarks,
  categoryForMark,
  type Member,
} from '@/stores/detectionStore';
import { useToolStore } from '@/stores/toolStore';
import { useLatestAnalysisForPage, useAIStore } from '@/stores/aiStore';
import { useAIReferenceStore } from '@/stores/aiReferenceStore';
import { getMarkColor } from '@/services/markColors';
import { ocrAt, parseMarks, isOcrReady } from '@/services/labelOcr';
import { buildBOQ } from '@/services/compute/buildBOQ';
import { importItemsToBoq } from '@/services/aiImportToBoq';
import { analyzeDimensions, buildReferenceImage } from '@/services/aiAnalyze';
import { MarkDimsDialog } from '@/components/MarkDimsDialog';
import { GridDialog } from '@/components/GridDialog';
import { PEDESTAL_OF } from '@/services/compute/boqAdapter';
import type { AIItem, AIReferenceImage } from '@/types/ai';

/** ชื่อหน้าแบบสำหรับ trace ใน BOQ (mirror AIPanel.pageNameOf) */
function pageNameOf(pageId: string): string {
  const s = useDrawingStore.getState();
  const p = s.pages.find((x) => x.id === pageId);
  if (!p) return 'หน้าแบบ';
  const f = s.files.find((x) => x.id === p.fileId);
  return f ? `${f.name} หน้า ${p.pageNumber}` : `หน้า ${p.pageNumber}`;
}

/** หมวดที่กรอกมิติ/คำนวณได้ (other = ข้าม) */
function isDimKind(mark: string): boolean {
  return categoryForMark(mark) !== 'other';
}

const PRESET_MARKS = ['F2', 'F1', 'C2', 'C3', 'GB1', 'GB2', 'GS'];
const SWATCHES = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#78716c', // stone
  '#64748b', // slate
  '#334155', // slate-700
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
        // สี swatch = สีของ member ตัวแรกในกลุ่มนี้ (สีอิสระจากชื่อ)
        g = {
          mark: token,
          color: m.color,
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

export function PaintPanel() {
  const page = useActivePage();
  const pageId = page?.id ?? null;
  const members = useMembersForPage(pageId);

  const paintColor = useDetectionStore((s) => s.paintColor);
  const setPaintColor = useDetectionStore((s) => s.setPaintColor);
  const paintError = useDetectionStore((s) => s.paintError);
  const setPaintError = useDetectionStore((s) => s.setPaintError);
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
  const setOcr = useDetectionStore((s) => s.setOcr);
  const stamp = useDetectionStore((s) => s.stamp);
  const startStamp = useDetectionStore((s) => s.startStamp);
  const stopStamp = useDetectionStore((s) => s.stopStamp);
  const markDims = useDetectionStore((s) => s.markDims);
  const markDimsSource = useDetectionStore((s) => s.markDimsSource);
  const setMarkDim = useDetectionStore((s) => s.setMarkDim);
  const clearMarkDim = useDetectionStore((s) => s.clearMarkDim);
  const grid = useDetectionStore((s) => s.grid);
  const setGrid = useDetectionStore((s) => s.setGrid);

  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const activeTool = useToolStore((s) => s.activeTool);
  const clearDraft = useToolStore((s) => s.clearDraft);

  // AI อ่านมิติ — ใช้หน้าอ้างอิงชุดเดียวกับ AIPanel (refIds) + engine ปัจจุบัน
  const allPages = useDrawingStore((s) => s.pages);
  const files = useDrawingStore((s) => s.files);
  const refIds = useAIReferenceStore((s) => s.pageIds);
  const engine = useAIStore((s) => s.engine);

  const latest = useLatestAnalysisForPage(pageId);

  const [renameInput, setRenameInput] = useState('');
  /** mark ที่กำลังเปิด popup เติมมิติ — null = ปิด */
  const [dimsForMark, setDimsForMark] = useState<string | null>(null);
  /** เปิด popup นิยาม grid ฐานราก */
  const [gridOpen, setGridOpen] = useState(false);
  // สถานะ "AI อ่านมิติ"
  const [dimsBusy, setDimsBusy] = useState(false);
  const [dimsMsg, setDimsMsg] = useState<string | null>(null);
  const [dimsUnreadable, setDimsUnreadable] = useState<
    { mark: string; reason: string }[]
  >([]);

  const groups = useMemo(() => groupByToken(members), [members]);
  const hidden = new Set(hiddenMarks);

  // มิติที่ยังไม่เติม (เฉพาะหมวดที่คำนวณได้) — roll-up เตือน
  const marksNeedingDims = groups.filter(
    (g) => isDimKind(g.mark) && !markDims[g.mark],
  ).length;

  // ── BOQ preview สด (ทาง A): count←tag · มิติ←markDims · ปริมาณ←compute ──
  const memberInputs = useMemo(
    () =>
      members
        .filter((m) => m.geometry != null)
        .map((m) => ({ mark: m.mark, status: m.status })),
    [members],
  );
  const computed = useMemo(
    () =>
      memberInputs.length > 0 &&
      (Object.keys(markDims).length > 0 || grid != null)
        ? buildBOQ({ extract: [], members: memberInputs, markDims, ...(grid ? { grid } : {}) })
        : null,
    [memberInputs, markDims, grid],
  );

  // หน้าอ้างอิง (แบบขยาย/schedule) — ชุดเดียวกับที่เลือกใน AIPanel
  const referenceImages = useMemo<AIReferenceImage[]>(() => {
    const out: AIReferenceImage[] = [];
    for (const id of refIds.slice(0, 4)) {
      const p = allPages.find((x) => x.id === id);
      if (!p?.bitmap) continue;
      const f = files.find((x) => x.id === p.fileId);
      try {
        out.push(
          buildReferenceImage({
            pageId: p.id,
            bitmap: p.bitmap,
            pageNum: p.pageNumber,
            label: f?.name ?? '—',
            engine,
          }),
        );
      } catch (err) {
        console.warn('[paint-dims] ref image fail:', err);
      }
    }
    return out;
  }, [refIds, allPages, files, engine]);

  // mark หมวดที่อ่านมิติได้ (footing/column/beam/slab) บนหน้านี้
  const dimMarks = useMemo(
    () => groups.filter((g) => isDimKind(g.mark)).map((g) => g.mark),
    [groups],
  );

  // เข้าแท็บ "ระบาย" → เริ่มที่โหมดติดป้าย (paint) ทันที ไม่ต้องสลับเอง
  useEffect(() => {
    setActiveTool('paint');
  }, [setActiveTool]);

  // prefill ช่องชื่อ "เฉพาะตอนตัวที่เลือกเปลี่ยน" — ห้ามผูก members (ref ใหม่ทุก
  //   render จาก .filter()) ไม่งั้น effect จะรีเซ็ตช่องทุก keystroke = พิมพ์ไม่เข้า
  const selId = selectedIds.length === 1 ? selectedIds[0]! : null;
  useEffect(() => {
    if (selId == null) return;
    const m = useDetectionStore.getState().members.find((x) => x.id === selId);
    setRenameInput(m?.mark ?? '');
  }, [selId]);

  if (!page) {
    return <p className="text-xs text-ink-muted">เปิดแบบก่อนจึงจะระบายได้</p>;
  }

  const handlePullExpected = () => {
    setExpected(deriveExpected(latest?.result?.items));
  };

  const cancelAll = () => {
    clearSelection();
    clearDraft();
  };

  // ล้าง marker ทั้งหมดของหน้านี้ (รวม draft ที่ OCR เดาผิด) — undo ได้
  const handleClearPage = () => {
    const ids = members.map((m) => m.id);
    if (ids.length > 0) deleteMembers(ids);
  };

  // import ผลคำนวณ (จาก tag + มิติ) เข้า BOQ
  const handleImportComputed = () => {
    if (!page || !computed || computed.items.length === 0) return;
    const outcome = importItemsToBoq({
      items: computed.items,
      discipline: 'structural',
      pageId: page.id,
      pageName: pageNameOf(page.id),
      sourceRef: `paint:${page.id}:marks`,
    });
    const skipMsg =
      outcome.skippedItems > 0 ? ` (ข้าม ${outcome.skippedItems} รายการ)` : '';
    alert(`📥 เพิ่ม ${outcome.boqIds.length} รายการเข้า BOQ แล้ว${skipMsg}`);
  };

  // 🤖 ให้ AI อ่านมิติจากหน้าแบบขยาย/schedule → เติม markDims (source='ai')
  const handleReadDims = async () => {
    if (dimsBusy) return;
    if (dimMarks.length === 0) {
      setDimsMsg('⚠️ ยังไม่มี mark โครงสร้างบนหน้านี้ — ปักหมุดก่อน');
      return;
    }
    if (referenceImages.length === 0) {
      setDimsMsg(
        '⚠️ เลือก "หน้าอ้างอิง" (แบบขยาย/schedule เช่น หน้า 18) ในแผง AI ก่อน — AI ต้องมีหน้าให้อ่านมิติ',
      );
      return;
    }
    setDimsBusy(true);
    setDimsUnreadable([]);
    setDimsMsg('🤖 กำลังส่งให้ AI อ่านมิติ…');
    try {
      const out = await analyzeDimensions({
        marks: dimMarks,
        references: referenceImages,
        engine,
        hd: true,
        onProgress: (m) => setDimsMsg(m),
      });
      const readMarks = Object.keys(out.dims);
      for (const mark of readMarks) {
        setMarkDim(mark, out.dims[mark]!, 'ai');
      }
      setDimsUnreadable(out.unreadable);
      const parts = [`✅ AI เติมมิติ ${readMarks.length} mark`];
      if (out.unreadable.length > 0) {
        parts.push(`อ่านไม่ออก ${out.unreadable.length}`);
      }
      setDimsMsg(parts.join(' · '));
    } catch (err) {
      console.error('[paint-dims] error:', err);
      setDimsMsg(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDimsBusy(false);
    }
  };

  // OCR เสริม (ไม่อัตโนมัติ) — อ่านป้ายรอบ marker ที่เลือก → เติมเป็นข้อเสนอในช่องชื่อ
  const handleTryOcr = async () => {
    if (selectedIds.length !== 1 || !page?.bitmap) return;
    const m = members.find((x) => x.id === selectedIds[0]);
    if (!m?.geometry) return;
    const center = {
      x: m.geometry.x + m.geometry.w / 2,
      y: m.geometry.y + m.geometry.h / 2,
    };
    setOcr(true, isOcrReady() ? 'กำลังอ่านป้าย…' : 'กำลังโหลดตัวอ่านป้าย…');
    try {
      const raw = await ocrAt(page.bitmap, center, {
        pageWidth: page.pageWidth,
        pageHeight: page.pageHeight,
      });
      setRenameInput(parseMarks(raw).join(','));
    } catch (err) {
      console.error('[labelOcr] error:', err);
    } finally {
      setOcr(false, null);
    }
  };

  const paintedPieces = members.filter((m) => m.geometry != null).length;
  const unnamed = members.filter(
    (m) => m.geometry != null && splitMarks(m.mark).length === 0,
  ).length;

  return (
    <div className="space-y-4">
      {/* ── โหมด ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => {
            setActiveTool('paint');
            setPaintError(null);
          }}
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
        {stamp ? (
          <span className="text-accent">
            📋 คัดลอกวาง: <b>คลิกบนแบบ</b> = วางสำเนา (ชื่อ/สี/ขนาดเดิม) · กดรัว ๆ
            ได้ · <b>Esc</b> ออก
          </span>
        ) : activeTool === 'select' ? (
          <>โหมดแก้: คลิกหมุดเพื่อเลือก · <b>ลากหมุดที่เลือก = ย้าย</b> · Delete = ลบ</>
        ) : (
          <>
            เลือกสี → <b>คลิกบนแบบ</b> = ปักหมุด → ตั้งชื่อในแผงที่เด้งขึ้น (พิมพ์
            หรือกดชิป)
          </>
        )}
      </p>
      {ocrBusy && (
        <p className="-mt-2 flex items-center gap-1.5 text-[11px] text-accent">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-bg-border border-t-accent" />
          {ocrStatus ?? 'กำลังอ่านป้าย…'}
        </p>
      )}

      {/* ── ขั้น 1: สีที่จะใช้ (อิสระจากชื่อ) ─────────────── */}
      <div>
        <p className="mb-1 text-[11px] font-semibold text-ink-secondary">
          สีที่จะใช้ (สำหรับหมุดใหม่)
        </p>
        <div className="flex flex-wrap gap-1">
          {SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => setPaintColor(hex)}
              className={`h-6 w-6 rounded ${
                paintColor === hex
                  ? 'ring-2 ring-white'
                  : 'ring-1 ring-bg-border'
              }`}
              style={{ background: hex }}
              aria-label={`เลือกสี ${hex}`}
            />
          ))}
        </div>
        {paintError && (
          <p className="mt-1 text-[11px] text-danger">⚠️ {paintError}</p>
        )}
      </div>

      {/* ── แก้ชิ้นที่เลือก ──────────────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="space-y-2 rounded border border-accent/40 bg-bg-raised/50 p-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-ink-secondary">
              แก้ชิ้นที่เลือก ({selectedIds.length})
            </p>
            <button
              type="button"
              onClick={clearSelection}
              title="ยกเลิกการเลือก"
              className="rounded px-1.5 text-xs text-ink-muted hover:bg-bg-hover"
            >
              ✕
            </button>
          </div>
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
          {/* OCR เสริม + ล้างชื่อ */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleTryOcr}
              disabled={selectedIds.length !== 1 || ocrBusy}
              title="ลองให้ OCR อ่านป้ายรอบหมุดที่เลือก แล้วเติมเป็นข้อเสนอในช่องชื่อ (แก้ได้)"
              className="flex-1 rounded bg-bg-raised px-2 py-1 text-[11px] text-ink-secondary hover:bg-bg-hover disabled:opacity-40"
            >
              🔤 ลองอ่านป้าย (OCR)
            </button>
            <button
              type="button"
              onClick={() => {
                renameMark(selectedIds, '');
                setRenameInput('');
              }}
              title="ล้างชื่อชิ้นที่เลือก"
              className="rounded bg-bg-raised px-2 py-1 text-[11px] text-ink-muted hover:bg-bg-hover"
            >
              ล้างชื่อ
            </button>
          </div>
          {/* คลิกชิป = เปลี่ยนชื่อชิ้นที่เลือกทันที (แก้ junk จาก OCR เร็ว ๆ) */}
          <div className="flex flex-wrap gap-1">
            {PRESET_MARKS.map((mk) => (
              <button
                key={mk}
                type="button"
                onClick={() => {
                  renameMark(selectedIds, mk);
                  setRenameInput(mk);
                }}
                className="rounded px-2 py-0.5 text-[11px] font-medium text-white"
                style={{ background: getMarkColor(mk) }}
              >
                {mk}
              </button>
            ))}
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
          {/* ── การกระทำหลัก: คัดลอก · ลบ · ยืนยัน (แถวเดียว) ─────────── */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => (stamp ? stopStamp() : startStamp(selectedIds[0]!))}
              disabled={selectedIds.length !== 1}
              title="คัดลอก marker นี้แล้วคลิกบนแบบเพื่อวางสำเนา (ชื่อ/สี/ขนาดเดิม) · Esc=ออก"
              className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                stamp
                  ? 'bg-accent text-ink-inverse'
                  : 'bg-bg-raised text-ink-secondary hover:bg-bg-hover'
              }`}
            >
              {stamp ? '📋 วางอยู่…' : '📋 คัดลอก'}
            </button>
            <button
              type="button"
              onClick={() => deleteMembers(selectedIds)}
              className="flex-1 rounded bg-danger/20 px-2 py-1.5 text-xs text-danger hover:bg-danger/30"
            >
              🗑️ ลบ
            </button>
            <button
              type="button"
              onClick={() => confirm(selectedIds)}
              className="flex-1 rounded bg-success/20 px-2 py-1.5 text-xs text-success hover:bg-success/30"
            >
              ✓ ยืนยัน
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
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setGridOpen(true)}
              title="นิยาม grid ฐานราก (กฎ 11 grid-first) — โค้ดนับจุดตัดแล้วเทียบกับที่ระบายบนแบบ ติดธง 🚩 ถ้าต่าง"
              className={`rounded px-2 py-0.5 text-[10px] hover:bg-bg-hover ${
                grid
                  ? 'bg-accent/20 text-accent'
                  : 'bg-bg-raised text-ink-secondary'
              }`}
            >
              ▦ grid ฐานราก{grid ? ' ✓' : ''}
            </button>
            <button
              type="button"
              onClick={handlePullExpected}
              disabled={!latest?.result?.items?.length}
              title="ดึงจำนวนคาดต่อรหัสจากผลวิเคราะห์ AI ล่าสุด (กฎ 11 grid-first) มาเทียบกับที่ยืนยัน"
              className="rounded bg-bg-raised px-2 py-0.5 text-[10px] text-ink-secondary hover:bg-bg-hover disabled:opacity-40"
            >
              ↻ ดึงจำนวนคาดจาก AI
            </button>
            <button
              type="button"
              onClick={handleClearPage}
              disabled={paintedPieces === 0}
              title="ลบ marker ทั้งหมดในหน้านี้ (เช่น ล้างป้ายขยะจาก OCR)"
              className="rounded bg-danger/15 px-2 py-0.5 text-[10px] text-danger hover:bg-danger/25 disabled:opacity-40"
            >
              🗑️ ล้างทั้งหน้า
            </button>
          </div>
        </div>
        {unnamed > 0 && (
          <p className="mb-1 text-[11px] text-warning">
            ⚠️ ยังไม่ตั้งชื่อ {unnamed} ตัว (ยังไม่เข้านับ) — เลือกแล้วตั้งชื่อ
          </p>
        )}
        {marksNeedingDims > 0 && (
          <p className="mb-1 text-[11px] text-warning">
            ✏️ ยังไม่เติมมิติ {marksNeedingDims} mark — กดปุ่ม ✏️ ท้ายรายการเพื่อคำนวณ BOQ
          </p>
        )}
        {groups.length === 0 ? (
          <p className="text-[11px] text-ink-muted">
            ยังไม่มีชิ้นงาน — เลือกสีแล้วคลิกบนแบบเพื่อปักหมุด
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
                  {isDimKind(g.mark) && markDims[g.mark] && (
                    <span
                      className={`shrink-0 rounded px-1 text-[9px] ${
                        markDimsSource[g.mark] === 'ai'
                          ? 'bg-accent/20 text-accent'
                          : 'text-ink-muted'
                      }`}
                      title={
                        markDimsSource[g.mark] === 'ai'
                          ? 'มิติจาก AI — ตรวจ/แก้ได้'
                          : 'มิติที่พิมพ์เอง'
                      }
                    >
                      {markDimsSource[g.mark] === 'ai' ? 'AI อ่าน' : 'พิมพ์เอง'}
                    </span>
                  )}
                  {isDimKind(g.mark) && (
                    <button
                      type="button"
                      onClick={() => setDimsForMark(g.mark)}
                      title={
                        markDims[g.mark] ? 'แก้มิติ' : 'เติมมิติเพื่อคำนวณ BOQ'
                      }
                      className={`rounded px-1 py-1 text-xs hover:bg-bg-hover ${
                        markDims[g.mark] ? 'text-success' : 'text-warning'
                      }`}
                    >
                      {markDims[g.mark] ? '✓' : '✏️'}
                    </button>
                  )}
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

      {/* ── 🤖 AI อ่านมิติ → เติม markDims อัตโนมัติ ───────────── */}
      {dimMarks.length > 0 && (
        <div className="border-t border-bg-border pt-3">
          <button
            type="button"
            onClick={handleReadDims}
            disabled={dimsBusy}
            title="ส่งหน้าอ้างอิง (แบบขยาย/schedule) ให้ AI อ่านมิติของ mark ที่ปักไว้ แล้วเติมลงฟอร์มอัตโนมัติ — count ยังนับจาก tag เดิม"
            className="flex w-full items-center justify-center gap-1.5 rounded bg-bg-raised px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-bg-hover disabled:opacity-50"
          >
            {dimsBusy && (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-bg-border border-t-accent" />
            )}
            🤖 ให้ AI อ่านมิติ ({dimMarks.length} mark)
          </button>
          {dimsMsg && (
            <p className="mt-1 text-[11px] text-ink-secondary">{dimsMsg}</p>
          )}
          {dimsUnreadable.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {dimsUnreadable.map((u) => (
                <li key={u.mark} className="text-[10px] text-warning">
                  ✏️ {u.mark}: {u.reason} — กรอกเอง
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── BOQ โครงสร้าง (จาก tag + มิติที่เติม) ───────────── */}
      {memberInputs.length > 0 && (
        <div className="border-t border-bg-border pt-3">
          <p className="mb-1 text-[11px] font-semibold text-ink-secondary">
            🧮 BOQ โครงสร้าง (นับจาก tag · มิติจากที่เติม)
          </p>
          {computed == null ? (
            <p className="text-[11px] text-ink-muted">
              เติมมิติอย่างน้อย 1 mark (ปุ่ม ✏️) เพื่อคำนวณปริมาณ
            </p>
          ) : computed.items.length === 0 ? (
            <p className="text-[11px] text-warning">
              ยังคำนวณไม่ได้ — เติมมิติให้ครบก่อน
            </p>
          ) : (
            <>
              <ul className="mb-2 space-y-0.5">
                {computed.items.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="text-ink-primary">{it.name}</span>
                    <span className="shrink-0 text-ink-muted">
                      {it.quantity} {it.unit}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleImportComputed}
                className="w-full rounded bg-accent px-2 py-1.5 text-xs font-medium text-ink-inverse hover:opacity-90"
              >
                📥 Import to BOQ ({computed.items.length} รายการ)
              </button>
            </>
          )}
          {computed && computed.warnings.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {computed.warnings
                .filter((w) => w.startsWith('❓') || w.startsWith('⚠️') || w.startsWith('🚩'))
                .map((w, i) => (
                  <li key={i} className="text-[10px] text-warning">
                    {w}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {dimsForMark &&
        (() => {
          // สูงตอม่อคู่ของฐานนี้ (เช่น F2→C2) — ส่งให้ dialog โชว์ก้นหลุม auto
          const pedMark = PEDESTAL_OF[dimsForMark.toUpperCase()];
          const ped = pedMark ? markDims[pedMark] : undefined;
          const pedestalH = ped?.kind === 'column' ? ped.H : undefined;
          return (
            <MarkDimsDialog
              mark={dimsForMark}
              existing={markDims[dimsForMark]}
              source={markDimsSource[dimsForMark]}
              pedestalH={pedestalH}
              onSave={(dims) => setMarkDim(dimsForMark, dims)}
              onClear={() => clearMarkDim(dimsForMark)}
              onClose={() => setDimsForMark(null)}
            />
          );
        })()}

      {gridOpen && (
        <GridDialog
          existing={grid}
          onSave={(g) => setGrid(g)}
          onClear={() => setGrid(null)}
          onClose={() => setGridOpen(false)}
        />
      )}
    </div>
  );
}
