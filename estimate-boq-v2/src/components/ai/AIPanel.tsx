/**
 * AI tab v2 — analyze button + status + building_info + summary + items table + notes/unreadable
 */
import { useActivePage } from '@/stores/drawingStore';
import {
  useAIStore,
  useLatestAnalysisForPage,
  useSuggestionsForAnalysis,
} from '@/stores/aiStore';
import { DISCIPLINE_LABELS } from '@/types/ai';
import { AnalyzeButton } from './AnalyzeButton';
import { AIElementsTable } from './AIElementsTable';
import { RefPagesBlock } from './RefPagesBlock';
import { AiChat } from './AiChat';

export function AIPanel() {
  const page = useActivePage();
  const latest = useLatestAnalysisForPage(page?.id ?? null);
  const suggestions = useSuggestionsForAnalysis(latest?.id ?? null);
  const removeAnalysesForPage = useAIStore((s) => s.removeAnalysesForPage);

  return (
    <div className="space-y-3">
      <RefPagesBlock />

      <div className="rounded border border-bg-border bg-bg-raised p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
          🤖 วิเคราะห์แบบด้วย AI
        </h3>
        <AnalyzeButton />
        <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
          AI วิเคราะห์ → แยกวัสดุ+ค่าแรง → ระบุ confidence + source
          คุณตรวจ/แก้ก่อน Accept → BOQ
          <br />
          <span className="text-warning">
            ⚠️ AI ไม่แก้ BOQ เอง — เพิ่มเฉพาะตอนกด accept
          </span>
        </p>
      </div>

      {latest && (
        <div className="space-y-2">
          <StatusBlock />
          {latest.status === 'success' && latest.result && (
            <>
              <SummaryBlock
                summary={latest.result.items.length > 0 ? `พบ ${latest.result.items.length} รายการ` : 'ไม่พบรายการในหน้านี้'}
                pageType={latest.result.drawing_type ?? '—'}
                scale={latest.result.scale}
                discipline={latest.discipline}
                buildingInfo={latest.result.building_info}
                mode={latest.mode}
                detected={latest.detected?.detected_discipline}
              />
              <AIElementsTable suggestions={suggestions} />
              {(latest.result.notes?.length ?? 0) > 0 && (
                <NotesBlock title="📝 หมายเหตุ" items={latest.result.notes!} />
              )}
              {(latest.result.unreadable?.length ?? 0) > 0 && (
                <NotesBlock
                  title="❓ อ่านไม่ชัด — ต้องยืนยัน"
                  items={latest.result.unreadable!}
                  color="warning"
                />
              )}
              <AiChat />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (page && confirm('ล้างผลวิเคราะห์ของหน้านี้?')) {
                      removeAnalysesForPage(page.id);
                    }
                  }}
                  className="text-[10px] text-ink-muted hover:text-danger"
                >
                  🗑️ ล้างผลของหน้านี้
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBlock() {
  const page = useActivePage();
  const latest = useLatestAnalysisForPage(page?.id ?? null);
  if (!latest) return null;

  if (latest.status === 'pending') {
    return (
      <div className="flex items-center gap-2 rounded border border-bg-border bg-bg-raised p-2 text-xs text-ink-secondary">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border border-bg-border border-t-accent" />
        🤖 AI กำลังวิเคราะห์{
          latest.mode === 'auto'
            ? ' (ตรวจจับประเภท → วิเคราะห์)'
            : ` — ${DISCIPLINE_LABELS[latest.discipline]}`
        }…
      </div>
    );
  }

  if (latest.status === 'error') {
    return (
      <div className="rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
        <p className="font-semibold">⚠️ วิเคราะห์ไม่สำเร็จ</p>
        <p className="mt-1 whitespace-pre-line">{latest.error}</p>
      </div>
    );
  }

  if (latest.status === 'success') {
    return (
      <div className="rounded border border-success/40 bg-success/10 p-2 text-[11px] text-ink-secondary">
        <p className="text-success">✅ วิเคราะห์เสร็จ</p>
        <p className="mt-0.5">
          model: <span className="font-mono">{latest.model}</span>
          {latest.elapsedMs != null && (
            <>
              {' · '}
              <span className="font-mono">
                {(latest.elapsedMs / 1000).toFixed(1)}s
              </span>
            </>
          )}
          {latest.tokens && (
            <>
              {' · '}
              <span className="font-mono text-ink-muted">
                tokens {latest.tokens.in ?? '—'}/{latest.tokens.out ?? '—'}
              </span>
            </>
          )}
          {latest.hd && (
            <span className="ml-1 rounded bg-warning/20 px-1 text-[10px] text-warning">
              HD
            </span>
          )}
        </p>
      </div>
    );
  }

  return null;
}

function SummaryBlock({
  summary,
  pageType,
  scale,
  discipline,
  buildingInfo,
  mode,
  detected,
}: {
  summary: string;
  pageType: string;
  scale?: string;
  discipline: keyof typeof DISCIPLINE_LABELS;
  buildingInfo?: {
    name?: string;
    dimensions?: string;
    floor_area?: number;
    stories?: number;
  };
  mode: string;
  detected?: string;
}) {
  return (
    <div className="rounded border border-bg-border bg-bg-raised p-2 text-xs">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] text-ink-muted">
        <span className="rounded bg-accent-subtle px-1.5 py-0.5 text-accent">
          {DISCIPLINE_LABELS[discipline]}
        </span>
        {mode === 'auto' && detected && (
          <span className="text-ink-muted">
            (auto-detect → {DISCIPLINE_LABELS[detected as keyof typeof DISCIPLINE_LABELS] ?? detected})
          </span>
        )}
        <span>
          ประเภท: <span className="font-mono text-ink-secondary">{pageType}</span>
        </span>
        {scale && (
          <span>
            สเกล: <span className="font-mono text-ink-secondary">{scale}</span>
          </span>
        )}
      </div>
      {buildingInfo &&
        (buildingInfo.name ||
          buildingInfo.dimensions ||
          buildingInfo.floor_area ||
          buildingInfo.stories) && (
          <div className="mb-1 flex flex-wrap gap-2 text-[11px] text-ink-secondary">
            {buildingInfo.name && (
              <span>
                🏢 <span className="text-ink-primary">{buildingInfo.name}</span>
              </span>
            )}
            {buildingInfo.dimensions && (
              <span>📐 {buildingInfo.dimensions}</span>
            )}
            {buildingInfo.floor_area && buildingInfo.floor_area > 0 && (
              <span>{buildingInfo.floor_area} ตร.ม.</span>
            )}
            {buildingInfo.stories && buildingInfo.stories > 0 && (
              <span>{buildingInfo.stories} ชั้น</span>
            )}
          </div>
        )}
      <p className="leading-relaxed text-ink-primary">{summary}</p>
    </div>
  );
}

function NotesBlock({
  title,
  items,
  color = 'ink',
}: {
  title: string;
  items: string[];
  color?: 'ink' | 'warning';
}) {
  const cls =
    color === 'warning'
      ? 'border-warning/40 bg-warning/5 text-warning'
      : 'border-bg-border bg-bg-raised text-ink-secondary';
  return (
    <div className={`rounded border ${cls} p-2 text-[11px]`}>
      <p className="mb-1 font-semibold">{title}</p>
      <ul className="space-y-0.5 pl-3">
        {items.map((n, i) => (
          <li key={i} className="list-disc">
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}
