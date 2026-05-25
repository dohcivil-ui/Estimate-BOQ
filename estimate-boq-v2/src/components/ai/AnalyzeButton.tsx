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
  const [mode, setMode] = useState<AIMode>(DEFAULT_MODE);
  const [hd, setHd] = useState(false);
  const [progress, setProgress] = useState<string>('');

  useEffect(() => {
    setMode(loadMode());
  }, []);

  const handleSetMode = (m: AIMode) => {
    setMode(m);
    saveMode(m);
  };

  const referenceImages = useMemo<AIReferenceImage[]>(() => {
    if (refIds.length === 0) return [];
    const out: AIReferenceImage[] = [];
    for (const id of refIds.slice(0, 3)) {
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
          }),
        );
      } catch (err) {
        console.warn('[analyze] ref image failed:', err);
      }
    }
    return out;
  }, [refIds, allPages, files, page]);

  const activeLabel =
    mode === 'auto'
      ? AUTO_OPTION.icon + ' ' + AUTO_OPTION.label
      : (() => {
          const d = DISCIPLINE_OPTIONS.find((x) => x.id === mode);
          return d ? `${d.icon} ${d.label}` : '';
        })();

  const handleClick = async () => {
    if (!page || !page.bitmap) return;
    const ai = useAIStore.getState();
    const analysisId = ai.startAnalyze(page.id, hd, mode);
    setProgress('');
    try {
      const out = await analyzePage({
        pageId: page.id,
        bitmap: page.bitmap,
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
      ? `🤖 วิเคราะห์ — ${activeLabel}${referenceImages.length > 0 ? ` (+ ${referenceImages.length} อ้างอิง)` : ''}`
      : 'เปิดแบบก่อน';

  return (
    <div className="space-y-2">
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
          disabled={!page || busy}
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
