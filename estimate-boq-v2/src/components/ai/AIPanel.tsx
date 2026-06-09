/**
 * AI tab — chat-first interface
 *
 * Flow:
 *   1. ก่อน analyze ครั้งแรก: เลือก discipline preset + แก้ prompt → กด "🤖 วิเคราะห์"
 *      → analyzePage() ส่ง prompt + PDF (Anthropic Direct) หรือ image
 *   2. หลัง analyze สำเร็จ: ผลลัพธ์ render เป็น AI bubble ตัวแรก
 *      input box ด้านล่างเปลี่ยนเป็น follow-up chat → ส่ง sendChatMessage()
 *   3. ทุก AI bubble ที่มี parsedResult.items[] → ปุ่ม "📋 Import to BOQ"
 *      (append เข้า BOQ ของหน้านั้น ไม่ replace)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useActivePage, useDrawingStore } from '@/stores/drawingStore';
import {
  useAIStore,
  useConversationFor,
  useLatestAnalysisForPage,
} from '@/stores/aiStore';
import { useAIReferenceStore } from '@/stores/aiReferenceStore';
import { useDetectionStore } from '@/stores/detectionStore';
import {
  analyzePage,
  AutoDetectFailed,
  buildReferenceImage,
  cleanJsonResponse,
} from '@/services/aiAnalyze';
import { buildUserMessage, sendChatMessage } from '@/services/aiChat';
import { buildTagTally } from '@/services/markParse';
import { importItemsToBoq } from '@/services/aiImportToBoq';
import { buildBOQ } from '@/services/compute/buildBOQ';
import {
  DEFAULT_PRESET,
  fillPagePlaceholders,
  getPreset,
  PROMPT_PRESETS,
  type PromptPreset,
} from '@/services/aiPresets';
import {
  getAvailableEngines,
  getEngineConfig,
  type AIEngine,
} from '@/services/aiEngines';
import {
  DISCIPLINE_LABELS,
  type AIAnalysis,
  type AIAnalysisResponse,
  type AIChatMessage,
  type AIDiscipline,
  type AIItem,
  type AIReferenceImage,
} from '@/types/ai';
import { RefPagesBlock } from './RefPagesBlock';
import { ImportPreview } from './ImportPreview';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const LOCALSTORAGE_PRESET = 'boq:ai_preset';
const LOCALSTORAGE_HD = 'boq:ai_hd';

function loadPresetId(): string {
  if (typeof window === 'undefined') return DEFAULT_PRESET!.id;
  const raw = window.localStorage.getItem(LOCALSTORAGE_PRESET) ?? '';
  return getPreset(raw)?.id ?? DEFAULT_PRESET!.id;
}

function savePresetId(id: string): void {
  try {
    window.localStorage.setItem(LOCALSTORAGE_PRESET, id);
  } catch {
    // ignore
  }
}

/** ดึงเลขหน้าหลัก + อ้างอิงเป็น string สำหรับ fillPagePlaceholders */
function buildPageStrings(opts: {
  mainPage: number | null;
  refPageNumbers: number[];
}): { main: string; refs: string } {
  return {
    main: opts.mainPage != null ? String(opts.mainPage) : '',
    refs: opts.refPageNumbers.length > 0 ? opts.refPageNumbers.join(',') : '',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// AIPanel — top-level
// ═══════════════════════════════════════════════════════════════════════
function AIPanelContent() {
  const page = useActivePage();
  const latest = useLatestAnalysisForPage(page?.id ?? null);
  const conversation = useConversationFor(latest?.id ?? null);
  const removeAnalysesForPage = useAIStore((s) => s.removeAnalysesForPage);

  const engine = useAIStore((s) => s.engine);
  const setEngine = useAIStore((s) => s.setEngine);
  const availableEngines = getAvailableEngines();
  useEffect(() => {
    if (availableEngines.length === 1 && engine !== availableEngines[0]) {
      setEngine(availableEngines[0]!);
    }
  }, [availableEngines, engine, setEngine]);

  return (
    <div className="space-y-3">
      <EnginePills
        engine={engine}
        availableEngines={availableEngines}
        onChange={setEngine}
        disabled={false}
      />
      <RefPagesBlock />

      <ChatStream latest={latest} conversation={conversation?.messages ?? []} />

      <ChatInputBlock latest={latest} />

      {latest && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (page && confirm('ล้างผลวิเคราะห์ + chat ของหน้านี้?')) {
                removeAnalysesForPage(page.id);
              }
            }}
            className="text-[10px] text-ink-muted hover:text-danger"
          >
            🗑️ ล้างผลของหน้านี้
          </button>
        </div>
      )}
    </div>
  );
}

export function AIPanel() {
  return (
    <ErrorBoundary scope="AI panel">
      <AIPanelContent />
    </ErrorBoundary>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Engine selector (pills)
// ═══════════════════════════════════════════════════════════════════════
const ENGINE_ACTIVE_CLASS: Record<AIEngine, string> = {
  claude: 'border-orange-400 bg-orange-400/15 text-orange-200',
  pro31: 'border-teal-400 bg-teal-400/15 text-teal-200',
  flash35: 'border-indigo-400 bg-indigo-400/15 text-indigo-200',
  flash30: 'border-sky-400 bg-sky-400/15 text-sky-200',
};

function EnginePills({
  engine,
  availableEngines,
  onChange,
  disabled,
}: {
  engine: AIEngine;
  availableEngines: AIEngine[];
  onChange: (engine: AIEngine) => void;
  disabled: boolean;
}) {
  if (availableEngines.length === 0) {
    return (
      <div className="rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs text-warning">
        ⚠️ ยังไม่ได้ตั้ง API key ใน .env.local
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        AI Engine
      </div>
      <div className="flex flex-wrap gap-1.5">
        {availableEngines.map((e) => {
          const config = getEngineConfig(e);
          const active = e === engine;
          return (
            <button
              key={e}
              type="button"
              onClick={() => onChange(e)}
              disabled={disabled}
              className={`relative rounded-full border px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? `${ENGINE_ACTIVE_CLASS[e]} font-semibold`
                  : 'border-slate-600 bg-transparent text-ink-secondary hover:border-slate-400 hover:text-ink-primary'
              }`}
              title={
                config.tested
                  ? `${config.label} · ${config.role}`
                  : `${config.label} · ${config.role} — ⚠️ ยังไม่ทดสอบ: ตรวจ count เอง`
              }
            >
              {config.icon} {config.shortLabel}
              {!config.tested && (
                <span
                  className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle"
                  aria-label="ยังไม่ทดสอบ — ตรวจ count เอง"
                />
              )}
            </button>
          );
        })}
      </div>
      {!getEngineConfig(engine).tested && (
        <div className="rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-200">
          ⚠️ {getEngineConfig(engine).label} ยังไม่ทดสอบความแม่น — ตรวจ count เอง
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Chat bubble stream — initial analysis + conversation messages
// ═══════════════════════════════════════════════════════════════════════
function ChatStream({
  latest,
  conversation,
}: {
  latest: AIAnalysis | null;
  conversation: AIChatMessage[];
}) {
  const chatBusy = useAIStore(
    (s) => s.chatBusyAnalysisId === (latest?.id ?? '__none__'),
  );
  const busy = useAIStore((s) => s.busyPageId);
  const isAnalyzing = Boolean(busy) && latest?.status === 'pending';
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [conversation.length, latest?.status]);

  // ถ้ายังไม่มี analysis เลย → placeholder
  if (!latest) {
    return (
      <div className="rounded border border-bg-border bg-bg-raised p-4 text-center text-xs text-ink-muted">
        🤖 เลือก discipline + แก้ prompt ด้านล่าง แล้วกดวิเคราะห์
        <br />
        AI วิเคราะห์ → ระบุ confidence + source
        <br />
        <span className="text-warning">⚠️ AI ไม่แก้ BOQ เอง — เพิ่มเฉพาะตอนกด "Import to BOQ"</span>
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      className="max-h-[28rem] space-y-2 overflow-y-auto rounded border border-bg-border bg-bg-raised p-2 text-xs"
    >
      {/* error/pending */}
      {latest.status === 'pending' && (
        <div className="flex items-center gap-2 rounded border border-bg-border bg-bg-base px-2 py-1.5 text-ink-secondary">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-bg-border border-t-accent" />
          🤖 AI กำลังวิเคราะห์…
        </div>
      )}
      {latest.status === 'error' && (
        <div className="rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
          <p className="font-semibold">⚠️ วิเคราะห์ไม่สำเร็จ</p>
          <p className="mt-1 whitespace-pre-line">{latest.error}</p>
        </div>
      )}

      {/* initial analysis bubble */}
      {latest.status === 'success' && latest.result && (
        <InitialAnalysisBubble analysis={latest} />
      )}

      {/* follow-up conversation */}
      {conversation.map((m) => (
        <ChatBubble
          key={m.id}
          msg={m}
          analysisId={latest.id}
          pageId={latest.pageId}
          discipline={latest.discipline}
        />
      ))}

      {chatBusy && !isAnalyzing && (
        <div className="flex items-center gap-2 rounded border border-bg-border bg-bg-base px-2 py-1.5 text-ink-secondary">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-bg-border border-t-accent" />
          🤖 AI กำลังตอบ…
        </div>
      )}
    </div>
  );
}

// ─── initial analysis as first AI bubble ───────────────────────────────
function InitialAnalysisBubble({ analysis }: { analysis: AIAnalysis }) {
  const setAnalysisImported = useAIStore((s) => s.setAnalysisImported);
  const [showPreview, setShowPreview] = useState(false);
  const [computed, setComputed] = useState<{
    items: AIItem[];
    warnings: string[];
  } | null>(null);
  const result = analysis.result;
  if (!result) return null;
  const itemCount = result.items?.length ?? 0;
  const notes = result.notes ?? [];
  const unreadable = result.unreadable ?? [];
  const engine = getEngineConfig(analysis.engine);
  const time = new Date(analysis.createdAt).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const imported = (analysis.importedBoqIds?.length ?? 0) > 0;

  const handleConfirm = (picked: AIItem[]) => {
    const outcome = importItemsToBoq({
      items: picked,
      discipline: result.discipline,
      pageId: analysis.pageId,
      pageName: pageNameOf(analysis.pageId),
      sourceRef: analysis.id,
    });
    setAnalysisImported(analysis.id, outcome.boqIds);
    setShowPreview(false);
    const skipMsg =
      outcome.skippedItems > 0 ? ` (ข้าม ${outcome.skippedItems} item)` : '';
    alert(`📥 เพิ่ม ${outcome.boqIds.length} รายการเข้า BOQ แล้ว${skipMsg}`);
  };

  // 🧮 คำนวณปริมาณ deterministic จาก compute layer (footing/beam/slab + consumables)
  const handleCompute = () => {
    // จำนวนฐาน/เสาจากการระบายบนแบบ (เฉพาะที่ระบายตำแหน่งแล้ว geometry != null)
    //   ห้ามนับจาก AI/seed — count มาจาก member ที่คนระบายเท่านั้น
    const members = useDetectionStore
      .getState()
      .getForPage(analysis.pageId)
      .filter((m) => m.geometry != null)
      .map((m) => ({ mark: m.mark, status: m.status }));
    const r = buildBOQ({
      extract: result.items ?? [],
      members: members.length > 0 ? members : undefined,
    });
    if (r.warnings.length > 0)
      console.info('[buildBOQ] ⚠️ ต้องยืนยัน:\n' + r.warnings.join('\n'));
    setComputed(r);
    if (r.items.length === 0) {
      alert(
        `🧮 ยังคำนวณ BOQ ไม่ได้ — ข้อมูลไม่ครบ\n\n${r.warnings.slice(0, 8).join('\n')}`,
      );
      setComputed(null);
    }
  };

  // import ผลคำนวณ (compute) เข้า BOQ
  const handleConfirmComputed = (picked: AIItem[]) => {
    const outcome = importItemsToBoq({
      items: picked,
      discipline: result.discipline,
      pageId: analysis.pageId,
      pageName: pageNameOf(analysis.pageId),
      sourceRef: `${analysis.id}:compute`,
    });
    setAnalysisImported(analysis.id, outcome.boqIds);
    setComputed(null);
    const skipMsg =
      outcome.skippedItems > 0 ? ` (ข้าม ${outcome.skippedItems} item)` : '';
    alert(`🧮 เพิ่ม ${outcome.boqIds.length} รายการ (คำนวณ) เข้า BOQ แล้ว${skipMsg}`);
  };

  return (
    <div className="mr-auto max-w-[90%] rounded-lg border border-success/30 bg-success/5 px-2 py-1.5">
      <div className="mb-0.5 flex flex-wrap items-center gap-1 text-[10px] text-ink-muted">
        <span>🤖 {engine.icon} {engine.label}</span>
        <span>·</span>
        <span>{time}</span>
        <span>·</span>
        <span className="rounded bg-accent-subtle px-1 text-accent">
          {DISCIPLINE_LABELS[analysis.discipline]}
        </span>
        {analysis.hd && (
          <span className="rounded bg-warning/20 px-1 text-warning">HD</span>
        )}
        {analysis.elapsedMs != null && (
          <span className="font-mono text-ink-muted">
            {(analysis.elapsedMs / 1000).toFixed(1)}s
          </span>
        )}
        {analysis.tokens && (
          <span className="font-mono text-ink-muted">
            in {analysis.tokens.in ?? '—'} / out {analysis.tokens.out ?? '—'}
          </span>
        )}
        {imported && (
          <span className="ml-1 rounded bg-success/20 px-1 text-success">
            ✓ Import แล้ว ({analysis.importedBoqIds?.length})
          </span>
        )}
      </div>

      <ResultSummary result={result} drawingType={result.drawing_type} />
      <ItemPreview items={result.items} />
      {notes.length > 0 && <NotesList title="📝 หมายเหตุ" items={notes} />}
      {unreadable.length > 0 && (
        <NotesList
          title="❓ อ่านไม่ชัด — ต้องยืนยัน"
          items={unreadable}
          warning
        />
      )}

      {itemCount > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {analysis.discipline === 'structural' ? (
            <>
              <button
                type="button"
                onClick={handleCompute}
                title="คำนวณปริมาณ deterministic (คอนกรีต/ตอม่อ/ทราย/lean/ไม้แบบ/เหล็ก/ดินขุด/ถม + ลวดผูก/ตะปู/ไม้เคร่า) จากมิติที่ AI ถอดได้"
                className="rounded bg-accent px-2 py-1 text-[11px] font-medium text-ink-inverse hover:bg-accent-hover"
              >
                🧮 Import to BOQ (คำนวณปริมาณ)
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                title="ดูรายการดิบจาก AI (ไม่ผ่าน compute) — สำหรับตรวจสอบ"
                className="rounded border border-bg-border bg-bg-base px-2 py-1 text-[11px] font-medium text-ink-secondary hover:bg-bg-hover"
              >
                รายการดิบจาก AI ({itemCount})
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="rounded bg-accent px-2 py-1 text-[11px] font-medium text-ink-inverse hover:bg-accent-hover"
            >
              📥 Import to BOQ ({itemCount} items)
            </button>
          )}
        </div>
      )}
      {showPreview && (
        <ImportPreview
          items={result.items ?? []}
          headerLabel={`${DISCIPLINE_LABELS[analysis.discipline]} — ${pageNameOf(analysis.pageId)}`}
          onConfirm={handleConfirm}
          onClose={() => setShowPreview(false)}
        />
      )}
      {computed && (
        <ImportPreview
          items={computed.items}
          headerLabel={`🧮 คำนวณปริมาณ — ${pageNameOf(analysis.pageId)}`}
          onConfirm={handleConfirmComputed}
          onClose={() => setComputed(null)}
        />
      )}
    </div>
  );
}

function pageNameOf(pageId: string): string {
  const s = useDrawingStore.getState();
  const p = s.pages.find((x) => x.id === pageId);
  if (!p) return 'หน้าแบบ';
  const f = s.files.find((x) => x.id === p.fileId);
  return f ? `${f.name} หน้า ${p.pageNumber}` : `หน้า ${p.pageNumber}`;
}

// ─── chat bubble (user + assistant) ────────────────────────────────────
function ChatBubble({
  msg,
  analysisId,
  pageId,
  discipline,
}: {
  msg: AIChatMessage;
  analysisId: string;
  pageId: string;
  discipline: AIDiscipline;
}) {
  const setChatMessageImported = useAIStore((s) => s.setChatMessageImported);
  const [showPreview, setShowPreview] = useState(false);
  const time = new Date(msg.createdAt).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (msg.role === 'user') {
    return (
      <div className="ml-auto max-w-[85%] rounded-lg border border-sky-500/30 bg-sky-500/5 px-2 py-1.5">
        <div className="mb-0.5 flex items-center gap-1 text-[10px] text-ink-muted">
          <span>🧑 คุณ</span>
          <span>·</span>
          <span>{time}</span>
        </div>
        <p className="whitespace-pre-wrap text-ink-primary">{msg.content}</p>
      </div>
    );
  }

  // assistant
  const result = msg.parsedResult;
  const hasResult = Boolean(result && Array.isArray(result.items));
  const itemCount = result?.items?.length ?? 0;
  const isAnswer = msg.content.includes('"answer"') && !hasResult;
  const imported = (msg.imported?.boqIds.length ?? 0) > 0;

  const handleConfirm = (picked: AIItem[]) => {
    if (!result) return;
    const outcome = importItemsToBoq({
      items: picked,
      discipline: result.discipline ?? discipline,
      pageId,
      pageName: pageNameOf(pageId),
      sourceRef: `${analysisId}:${msg.id}`,
    });
    setChatMessageImported(analysisId, msg.id, outcome.boqIds);
    setShowPreview(false);
    const skipMsg =
      outcome.skippedItems > 0 ? ` (ข้าม ${outcome.skippedItems} item)` : '';
    alert(`📥 เพิ่ม ${outcome.boqIds.length} รายการเข้า BOQ แล้ว${skipMsg}`);
  };

  return (
    <div className="mr-auto max-w-[90%] rounded-lg border border-success/30 bg-success/5 px-2 py-1.5">
      <div className="mb-0.5 flex items-center gap-1 text-[10px] text-ink-muted">
        <span>🤖 AI</span>
        <span>·</span>
        <span>{time}</span>
        {imported && (
          <span className="ml-1 rounded bg-success/20 px-1 text-success">
            ✓ Import แล้ว ({msg.imported?.boqIds.length})
          </span>
        )}
      </div>

      {hasResult && result ? (
        <>
          <p className="text-ink-primary">
            ผลใหม่:{' '}
            <span className="font-semibold text-success">{itemCount} items</span>
          </p>
          <ItemPreview items={result.items} />
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="mt-1.5 rounded bg-accent px-2 py-1 text-[11px] font-medium text-ink-inverse hover:bg-accent-hover"
          >
            📥 Import to BOQ ({itemCount} items)
          </button>
          {showPreview && (
            <ImportPreview
              items={result.items ?? []}
              headerLabel={`${DISCIPLINE_LABELS[result.discipline ?? discipline]} — ${pageNameOf(pageId)}`}
              onConfirm={handleConfirm}
              onClose={() => setShowPreview(false)}
            />
          )}
        </>
      ) : isAnswer ? (
        <p className="whitespace-pre-wrap text-ink-primary">
          {extractAnswer(msg.content)}
        </p>
      ) : (
        <pre className="overflow-x-auto whitespace-pre-wrap text-[10px] text-ink-secondary">
          {msg.content.slice(0, 500)}
          {msg.content.length > 500 && '…'}
        </pre>
      )}
    </div>
  );
}

function ResultSummary({
  result,
  drawingType,
}: {
  result: AIAnalysisResponse;
  drawingType?: string;
}) {
  const info = result.building_info;
  return (
    <div className="mb-1 flex flex-wrap gap-2 text-[11px] text-ink-secondary">
      {drawingType && (
        <span>
          ประเภท: <span className="font-mono text-ink-primary">{drawingType}</span>
        </span>
      )}
      {result.scale && (
        <span>
          สเกล: <span className="font-mono text-ink-primary">{result.scale}</span>
        </span>
      )}
      {info?.name && (
        <span>
          🏢 <span className="text-ink-primary">{info.name}</span>
        </span>
      )}
      {info?.dimensions && <span>📐 {info.dimensions}</span>}
      {info?.floor_area != null && info.floor_area > 0 && (
        <span>{info.floor_area} ตร.ม.</span>
      )}
      {info?.stories != null && info.stories > 0 && <span>{info.stories} ชั้น</span>}
    </div>
  );
}

function ItemPreview({
  items,
}: {
  items: AIAnalysisResponse['items'];
}) {
  if (!items || items.length === 0) {
    return <p className="text-[11px] text-ink-muted">ไม่พบรายการ</p>;
  }
  return (
    <div className="space-y-0.5">
      {items.slice(0, 5).map((it, i) => (
        <p key={i} className="truncate text-[11px] text-ink-secondary">
          • {it.name} — {it.quantity} {it.unit}
        </p>
      ))}
      {items.length > 5 && (
        <p className="text-[11px] text-ink-muted">…อีก {items.length - 5} รายการ</p>
      )}
    </div>
  );
}

function NotesList({
  title,
  items,
  warning,
}: {
  title: string;
  items: unknown[];
  warning?: boolean;
}) {
  const cls = warning
    ? 'border-warning/40 bg-warning/5 text-warning'
    : 'border-bg-border bg-bg-base text-ink-secondary';
  return (
    <div className={`mt-1 rounded border ${cls} p-1.5 text-[11px]`}>
      <p className="mb-0.5 font-semibold">{title}</p>
      <ul className="space-y-0.5 pl-3">
        {items.map((n, i) => (
          <li key={i} className="list-disc">
            {renderNote(n)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderNote(note: unknown): string {
  if (typeof note === 'string') return note;
  if (note && typeof note === 'object') {
    const obj = note as Record<string, unknown>;
    if (obj.text) return `${obj.text}${obj.reason ? ` (${obj.reason})` : ''}`;
    return JSON.stringify(obj);
  }
  return String(note);
}

function extractAnswer(raw: string): string {
  try {
    const obj = JSON.parse(cleanJsonResponse(raw));
    if (obj && typeof obj.answer === 'string') return obj.answer;
  } catch {
    // ignore
  }
  return raw;
}

// ═══════════════════════════════════════════════════════════════════════
// Chat input block — preset dropdown + editable prompt + send
// ═══════════════════════════════════════════════════════════════════════
function ChatInputBlock({ latest }: { latest: AIAnalysis | null }) {
  const page = useActivePage();
  const allPages = useDrawingStore((s) => s.pages);
  const files = useDrawingStore((s) => s.files);
  const refIds = useAIReferenceStore((s) => s.pageIds);
  const busy = useAIStore((s) => s.busyPageId === page?.id);
  const chatBusy = useAIStore(
    (s) => s.chatBusyAnalysisId === (latest?.id ?? '__none__'),
  );
  const engine = useAIStore((s) => s.engine);
  const setEngine = useAIStore((s) => s.setEngine);
  const availableEngines = useMemo(() => getAvailableEngines(), []);
  const setChatBusy = useAIStore((s) => s.setChatBusy);
  const appendChatMessage = useAIStore((s) => s.appendChatMessage);

  const [presetId, setPresetId] = useState<string>(() => loadPresetId());
  const [prompt, setPrompt] = useState<string>('');
  const [hd, setHd] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(LOCALSTORAGE_HD) === '1';
  });
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [tallyPreview, setTallyPreview] = useState<string | null>(null);
  const promptDirty = useRef(false);

  // อ่าน tally marker บนหน้า active (geometry!=null) → บล็อก "จำนวนจริงจาก tag"
  const buildPageTagTally = (): string => {
    if (!page) return '';
    const members = useDetectionStore
      .getState()
      .getForPage(page.id)
      .map((m) => ({ mark: m.mark, hasGeometry: m.geometry != null }));
    return buildTagTally(members);
  };

  const preset: PromptPreset =
    getPreset(presetId) ?? DEFAULT_PRESET!;

  // โหมด analyze (ยังไม่มีผล) vs follow-up
  const followUp = Boolean(latest && latest.status === 'success');

  // เลขหน้าหลัก/อ้างอิง (สำหรับเติม placeholder)
  const refPageNumbers = useMemo(() => {
    if (refIds.length === 0) return [];
    const nums: number[] = [];
    for (const id of refIds.slice(0, 4)) {
      if (id === page?.id) continue;
      const p = allPages.find((x) => x.id === id);
      if (p) nums.push(p.pageNumber);
    }
    return nums.sort((a, b) => a - b);
  }, [refIds, allPages, page?.id]);

  // ─── สลับหน้า active → ล้าง dirty เพื่อให้ prompt เติมเลขหน้าใหม่ตามหน้านั้น ──
  useEffect(() => {
    promptDirty.current = false;
  }, [page?.id]);

  // ─── sync prompt textarea กับ preset (เฉพาะ analyze mode + ยังไม่แก้เอง) ──
  // เติม placeholder [หน้าหลัก]/[อ้างอิง] ด้วยเลขหน้าจริง
  useEffect(() => {
    if (followUp) return;
    if (promptDirty.current) return;
    const { main, refs } = buildPageStrings({
      mainPage: page?.pageNumber ?? null,
      refPageNumbers,
    });
    setPrompt(fillPagePlaceholders(preset.prompt, main, refs));
  }, [preset, followUp, page?.pageNumber, refPageNumbers]);

  // ─── เลือก preset → save + reset dirty flag + auto-switch engine ──────
  const handleSetPreset = (id: string) => {
    const p = getPreset(id) ?? DEFAULT_PRESET!;
    setPresetId(p.id);
    savePresetId(p.id);
    promptDirty.current = false; // overwrite textarea ใน useEffect
    // auto-switch engine ตาม preset.defaultEngine (ถ้ามี key)
    if (
      p.defaultEngine !== engine &&
      availableEngines.includes(p.defaultEngine)
    ) {
      setEngine(p.defaultEngine);
    }
  };

  const handleSetHd = (v: boolean) => {
    setHd(v);
    try {
      window.localStorage.setItem(LOCALSTORAGE_HD, v ? '1' : '0');
    } catch {
      // ignore
    }
  };

  // refImages = ภาพอ้างอิงที่แนบได้จริง · refSkipped = หน้าที่เลือกแต่แนบไม่ได้ (เช่น bitmap ยังไม่ render)
  const { referenceImages, refSkipped } = useMemo<{
    referenceImages: AIReferenceImage[];
    refSkipped: number[];
  }>(() => {
    const out: AIReferenceImage[] = [];
    const skipped: number[] = [];
    if (refIds.length === 0) return { referenceImages: out, refSkipped: skipped };
    for (const id of refIds.slice(0, 4)) {
      if (id === page?.id) continue;
      const p = allPages.find((x) => x.id === id);
      if (!p) continue;
      if (!p.bitmap) {
        skipped.push(p.pageNumber);
        continue;
      }
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
        console.warn('[ai-panel] ref image fail:', err);
        skipped.push(p.pageNumber);
      }
    }
    return { referenceImages: out, refSkipped: skipped };
  }, [refIds, allPages, files, page, engine]);

  // ─── analyze: ใช้ preset + (ถ้า dirty) custom prompt ─────────────────
  const handleAnalyze = async () => {
    if (!page || !page.bitmap) return;

    // ── log ก่อนส่ง: ยืนยันจำนวนภาพ (1 หลัก + N อ้างอิง) ──
    console.info(
      `[ai-panel] ส่งภาพ: 1 หลัก (หน้า ${page.pageNumber}) + ${referenceImages.length} อ้างอิง` +
        (referenceImages.length
          ? ` [${referenceImages.map((r) => `หน้า${r.pageNum}`).join(', ')}]`
          : '') +
        (refSkipped.length ? ` ⚠️ ข้าม(ไม่มี bitmap): ${refSkipped.join(',')}` : ''),
    );
    if (refIds.length > 0 && referenceImages.length === 0) {
      setError(
        `⚠️ เลือกหน้าอ้างอิง ${refIds.length} หน้า แต่แนบไม่ได้เลย (bitmap ยังไม่ render) — ` +
          `เปิดหน้าอ้างอิงสักครั้งให้ render ก่อน แล้ววิเคราะห์ใหม่`,
      );
      return;
    }

    const ai = useAIStore.getState();
    const mode = preset.mode; // custom preset = 'auto' (detect schema)
    const analysisId = ai.startAnalyze(page.id, hd, mode, engine);
    setProgress('');
    setError(null);
    try {
      const out = await analyzePage({
        pageId: page.id,
        bitmap: page.bitmap,
        engine,
        mode,
        hd,
        referenceImages,
        customUserPrompt: promptDirty.current ? prompt : undefined,
        tagTally: buildPageTagTally(),
        onProgress: setProgress,
      });
      ai.completeAnalyze(analysisId, out.discipline, out.result, out.raw, {
        model: out.model,
        elapsedMs: out.elapsedMs,
        tokens: {
          in: out.tokens?.prompt_tokens,
          out: out.tokens?.completion_tokens,
        },
        detected: out.detected,
      });
      if (out.truncated) {
        alert('⚠️ AI ตอบไม่ครบ — ลองเปิด HD หรือลดหน้าอ้างอิง');
      }
      // หลัง analyze สำเร็จ: clear prompt textarea เตรียมรับ follow-up
      setPrompt('');
      promptDirty.current = false;
    } catch (err) {
      const msg =
        err instanceof AutoDetectFailed
          ? err.message + ' — แนะนำเลือก mode เฉพาะ'
          : err instanceof Error
            ? err.message
            : String(err);
      ai.failAnalyze(analysisId, msg);
      setError(msg);
    } finally {
      setProgress('');
    }
  };

  // ─── follow-up: ส่งเข้าระบบ chat ──────────────────────────────────────
  const handleFollowUp = async () => {
    if (!latest || !page) return;
    const text = prompt.trim();
    if (!text) return;
    const userMsg = buildUserMessage(text);
    appendChatMessage(latest.id, userMsg);
    setPrompt('');
    promptDirty.current = false;
    setChatBusy(latest.id);
    setError(null);
    setProgress('');
    try {
      const conv = { analysisId: latest.id, pageId: latest.pageId, messages: [userMsg] };
      const res = await sendChatMessage({
        analysis: latest,
        conversation: conv,
        targetBitmap: page.bitmap,
        referenceImages,
        userMessage: text,
        engine,
        hd,
        onProgress: setProgress,
      });
      appendChatMessage(latest.id, res.assistantMessage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      appendChatMessage(latest.id, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `⚠️ ส่งไม่สำเร็จ: ${msg}`,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setChatBusy(null);
      setProgress('');
    }
  };

  const handleSend = () => {
    if (followUp) void handleFollowUp();
    else void handleAnalyze();
  };

  const sending = busy || chatBusy;
  const sendLabel = followUp
    ? sending
      ? progress || '⌛ ส่ง…'
      : '📤 ส่ง'
    : sending
      ? progress || '⌛ AI กำลังวิเคราะห์…'
      : '🤖 วิเคราะห์';

  return (
    <div className="space-y-2 rounded border border-bg-border bg-bg-raised p-2">
      {!followUp && (
        <PresetDropdown
          presetId={preset.id}
          onChange={handleSetPreset}
          disabled={sending}
        />
      )}

      {followUp && (
        <div className="text-[10px] text-ink-muted">
          💬 คุยต่อกับ AI — discipline ปัจจุบัน:{' '}
          <span className="text-ink-primary">
            {DISCIPLINE_LABELS[latest!.discipline]}
          </span>
        </div>
      )}

      {!followUp && referenceImages.length > 0 && (
        <div className="rounded border border-sky-400/30 bg-sky-400/10 px-2 py-1 text-[10px] text-sky-200">
          📎 จะแนบหน้าอ้างอิง {referenceImages.length} หน้า (
          {referenceImages.map((r) => r.pageNum).join(', ')}) เข้า AI
          {refSkipped.length > 0 && (
            <span className="text-amber-300">
              {' '}
              · ⚠️ ข้าม {refSkipped.join(', ')} (ยังไม่ render — เปิดหน้านั้นก่อน)
            </span>
          )}
        </div>
      )}

      <textarea
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          promptDirty.current = true;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !sending) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder={
          followUp
            ? 'พิมพ์คำสั่งต่อ เช่น "F2 คือกระเบื้องกันลื่น"... (Ctrl+Enter ส่ง)'
            : 'แก้ prompt ได้ตามต้องการ (Ctrl+Enter ส่ง)'
        }
        rows={followUp ? 2 : 4}
        disabled={sending}
        className="w-full resize-none rounded border border-bg-border bg-bg-base px-2 py-1.5 text-xs text-ink-primary outline-none focus:border-accent disabled:opacity-50"
      />

      {error && (
        <div className="rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
          {error}
        </div>
      )}

      {!followUp && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setTallyPreview(buildPageTagTally())}
            disabled={sending}
            className="rounded border border-bg-border px-2 py-1 text-[10px] text-ink-muted hover:text-ink-primary disabled:opacity-50"
          >
            🔢 ดูจำนวนที่จะส่ง
          </button>
          {tallyPreview !== null && (
            <div className="rounded border border-bg-border bg-bg-base px-2 py-1 text-[10px] text-ink-secondary">
              {tallyPreview
                ? `📎 แนบอัตโนมัติ: ${tallyPreview}`
                : 'ยังไม่มี marker ที่ tag ไว้บนหน้านี้ — ปักหมุดในแท็บ "ระบาย" ก่อน'}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !page || !prompt.trim()}
          className="flex-1 rounded bg-accent px-3 py-2 text-sm font-medium text-ink-inverse hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sendLabel}
        </button>
        <label
          className="flex cursor-pointer items-center gap-1.5 rounded border border-bg-border bg-bg-base px-2 py-2 text-xs text-ink-secondary"
          title="HD: ภาพคมขึ้น (ช้า/แพง)"
        >
          <input
            type="checkbox"
            checked={hd}
            onChange={(e) => handleSetHd(e.target.checked)}
            disabled={sending}
            className="accent-accent"
          />
          HD
        </label>
      </div>
    </div>
  );
}

function PresetDropdown({
  presetId,
  onChange,
  disabled,
}: {
  presetId: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        Preset
      </div>
      <select
        value={presetId}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded border border-bg-border bg-bg-base px-2 py-1.5 text-xs text-ink-primary outline-none focus:border-accent disabled:opacity-50"
      >
        {PROMPT_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.icon} {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
