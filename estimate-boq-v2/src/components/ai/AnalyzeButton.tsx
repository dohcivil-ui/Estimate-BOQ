/**
 * Analyze button — 5 mode buttons + HD toggle + reference images + progress
 */
import { useEffect, useMemo, useState } from 'react';
import { useActivePage, useDrawingStore } from '@/stores/drawingStore';
import { useAIStore } from '@/stores/aiStore';
import { useAIReferenceStore } from '@/stores/aiReferenceStore';
import {
  analyzePage,
  AutoDetectFailed,
  buildReferenceImage,
} from '@/services/aiAnalyze';
import { DISCIPLINE_OPTIONS } from '@/services/aiPrompts';
import {
  getAvailableEngines,
  getEngineConfig,
  type AIEngine,
} from '@/services/aiEngines';
import type { AIMode, AIReferenceImage } from '@/types/ai';

const LOCALSTORAGE_KEY = 'boq:ai_mode';
const DEFAULT_MODE: AIMode = 'auto';

function loadMode(): AIMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  const raw = window.localStorage.getItem(LOCALSTORAGE_KEY);
  if (
    raw === 'auto' ||
    raw === 'architectural' ||
    raw === 'structural' ||
    raw === 'electrical' ||
    raw === 'sanitary'
  ) {
    return raw;
  }
  return DEFAULT_MODE;
}

function saveMode(mode: AIMode): void {
  try {
    window.localStorage.setItem(LOCALSTORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

const AUTO_OPTION = {
  id: 'auto' as const,
  label: 'อัตโนมัติ',
  icon: '🔄',
  description: 'AI ตรวจจับประเภทแบบเอง',
  color: 'slate',
};

export function AnalyzeButton() {
  const page = useActivePage();
  const allPages = useDrawingStore((s) => s.pages);
  const files = useDrawingStore((s) => s.files);
  const refIds = useAIReferenceStore((s) => s.pageIds);
  const busy = useAIStore((s) => s.busyPageId === page?.id);
  const engine = useAIStore((s) => s.engine);
  const setEngine = useAIStore((s) => s.setEngine);
  const [mode, setMode] = useState<AIMode>(DEFAULT_MODE);
  const [hd, setHd] = useState(false);
  const [progress, setProgress] = useState<string>('');

  const availableEngines = getAvailableEngines();

  useEffect(() => {
    setMode(loadMode());
  }, []);

  useEffect(() => {
    if (availableEngines.length === 1 && engine !== availableEngines[0]) {
      setEngine(availableEngines[0]!);
    }
  }, [availableEngines, engine, setEngine]);

  const handleSetMode = (m: AIMode) => {
    setMode(m);
    saveMode(m);
  };

  const referenceImages = useMemo<AIReferenceImage[]>(() => {
    if (refIds.length === 0) return [];
    const out: AIReferenceImage[] = [];
    for (const id of refIds.slice(0, 4)) {
      // ห้ามใช้หน้า target เป็น reference ของตัวเอง
      if (id === page?.id) continue;
      const p = allPages.find((x) => x.id === id);
      if (!p || !p.bitmap) continue;
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
        console.warn('[analyze] ref image failed:', err);
      }
    }
    return out;
  }, [refIds, allPages, files, page, engine]);

  const activeLabel =
    mode === 'auto'
      ? AUTO_OPTION.icon + ' ' + AUTO_OPTION.label
      : (() => {
          const d = DISCIPLINE_OPTIONS.find((x) => x.id === mode);
          return d ? `${d.icon} ${d.label.replace(/^งาน/, '')}` : '';
        })();

  const handleClick = async () => {
    if (!page || !page.bitmap) return;
    if (availableEngines.length === 0) return;
    const ai = useAIStore.getState();
    const analysisId = ai.startAnalyze(page.id, hd, mode, engine);
    setProgress('');
    try {
      const out = await analyzePage({
        pageId: page.id,
        bitmap: page.bitmap,
        engine,
        mode,
        hd,
        referenceImages,
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
    } catch (err) {
      const msg =
        err instanceof AutoDetectFailed
          ? err.message + ' — แนะนำเลือก mode เฉพาะ'
          : err instanceof Error
            ? err.message
            : String(err);
      ai.failAnalyze(analysisId, msg);
    } finally {
      setProgress('');
    }
  };

  const buttonLabel = busy
    ? progress || '⌛ AI กำลังวิเคราะห์…'
    : page
      ? `🤖 วิเคราะห์ (${getEngineShortLabel(engine)}) — ${activeLabel}${referenceImages.length > 0 ? ` (+ ${referenceImages.length} อ้างอิง)` : ''}`
      : 'เปิดแบบก่อน';

  return (
    <div className="space-y-2">
      <EngineSelector
        engine={engine}
        availableEngines={availableEngines}
        onChange={setEngine}
        disabled={busy}
      />

      {/* 5 mode buttons */}
      <div className="grid grid-cols-5 gap-1">
        <ModeButton
          icon={AUTO_OPTION.icon}
          label={AUTO_OPTION.label}
          color={AUTO_OPTION.color}
          active={mode === 'auto'}
          disabled={busy}
          onClick={() => handleSetMode('auto')}
          description={AUTO_OPTION.description}
        />
        {DISCIPLINE_OPTIONS.map((d) => (
          <ModeButton
            key={d.id}
            icon={d.icon}
            label={d.label}
            color={d.color}
            active={mode === d.id}
            disabled={busy}
            onClick={() => handleSetMode(d.id)}
            description={d.description}
          />
        ))}
      </div>

      {/* analyze + HD */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={!page || busy || availableEngines.length === 0}
          className="flex-1 rounded bg-accent px-3 py-2 text-sm font-medium text-ink-inverse hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {buttonLabel}
        </button>
        <label
          className="flex cursor-pointer items-center gap-1.5 rounded border border-bg-border bg-bg-raised px-2 py-2 text-xs text-ink-secondary"
          title="ใช้รุ่น HD (qwen-vl-max) — ละเอียดกว่า/แพง/ช้า"
        >
          <input
            type="checkbox"
            checked={hd}
            onChange={(e) => setHd(e.target.checked)}
            disabled={busy}
            className="accent-accent"
          />
          HD
        </label>
      </div>
    </div>
  );
}

function getEngineShortLabel(engine: AIEngine): string {
  const config = getEngineConfig(engine);
  return `${config.icon} ${config.shortLabel}`;
}

/**
 * สีต่อ engine — ใช้ตอน active (pill state)
 *   claude=orange, gpt54=green, gpt41mini=amber, gemini-pro=teal, gemini-flash=sky, qwen=purple
 */
const ENGINE_ACTIVE_CLASS: Record<AIEngine, string> = {
  claude: 'border-orange-400 bg-orange-400/15 text-orange-200',
  gpt54: 'border-green-400 bg-green-400/15 text-green-200',
  gpt41mini: 'border-amber-400 bg-amber-400/15 text-amber-200',
  'gemini-pro': 'border-teal-400 bg-teal-400/15 text-teal-200',
  'gemini-flash': 'border-sky-400 bg-sky-400/15 text-sky-200',
  qwen: 'border-purple-400 bg-purple-400/15 text-purple-200',
};

function EngineSelector({
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
        <span className="ml-1 text-[10px] text-ink-muted">
          (VITE_OPENROUTER_API_KEY / VITE_GEMINI_API_KEY /
          VITE_QWEN_API_KEY_DEV)
        </span>
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
              className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? `${ENGINE_ACTIVE_CLASS[e]} font-semibold`
                  : 'border-slate-600 bg-transparent text-ink-secondary hover:border-slate-400 hover:text-ink-primary'
              }`}
              title={config.label}
            >
              {config.icon} {config.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModeButton({
  icon,
  label,
  color,
  active,
  disabled,
  onClick,
  description,
}: {
  icon: string;
  label: string;
  color: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  description: string;
}) {
  const activeColors: Record<string, string> = {
    slate: 'border-slate-400 bg-slate-400/20 text-slate-200',
    sky: 'border-sky-400 bg-sky-400/20 text-sky-200',
    orange: 'border-orange-400 bg-orange-400/20 text-orange-200',
    amber: 'border-amber-400 bg-amber-400/20 text-amber-200',
    green: 'border-green-400 bg-green-400/20 text-green-200',
  };
  const activeClass = activeColors[color] ?? activeColors.slate!;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${label} — ${description}`}
      className={`flex flex-col items-center gap-0.5 rounded border px-1 py-1.5 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? activeClass
          : 'border-bg-border bg-bg-raised text-ink-secondary hover:bg-bg-hover hover:text-ink-primary'
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="truncate text-[9px] leading-tight">
        {label.replace('งาน', '')}
      </span>
    </button>
  );
}
