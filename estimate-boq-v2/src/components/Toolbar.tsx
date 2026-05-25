/**
 * Toolbar — แถบเครื่องมือใต้ TopBar
 * เลือก tool + แสดง snap/ortho toggle + scale status
 */
import { useActiveTool, useToolStore } from '@/stores/toolStore';
import { useSnapStore } from '@/stores/snapStore';
import { useOrthoStore } from '@/stores/orthoStore';
import { useScaleFor } from '@/stores/scaleStore';
import { useActivePage } from '@/stores/drawingStore';
import {
  TOOL_HOTKEYS,
  TOOL_LABELS,
  type Tool,
} from '@/types/tool';

const TOOLS: Tool[] = ['select', 'pan', 'scale', 'length', 'area', 'count'];

export function Toolbar() {
  const active = useActiveTool();
  const setTool = useToolStore((s) => s.setActiveTool);
  const snapEnabled = useSnapStore((s) => s.enabled);
  const toggleSnap = useSnapStore((s) => s.toggleEnabled);
  const orthoEnabled = useOrthoStore((s) => s.enabled);
  const toggleOrtho = useOrthoStore((s) => s.toggleEnabled);
  const page = useActivePage();
  const scale = useScaleFor(page?.id ?? null);

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-bg-border bg-bg-panel px-3">
      {/* tool buttons */}
      <div className="flex items-center gap-1">
        {TOOLS.map((t) => {
          const isActive = active === t;
          const disabled =
            (t === 'length' || t === 'area') && !scale;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTool(t)}
              disabled={disabled}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isActive
                  ? 'bg-accent text-ink-inverse'
                  : 'text-ink-secondary hover:bg-bg-hover hover:text-ink-primary'
              }`}
              title={`${TOOL_LABELS[t]} (${TOOL_HOTKEYS[t]})${disabled ? ' — ต้องตั้งสเกลก่อน' : ''}`}
            >
              {TOOL_LABELS[t]}
            </button>
          );
        })}
      </div>

      <Separator />

      {/* snap + ortho */}
      <button
        type="button"
        onClick={toggleSnap}
        className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
          snapEnabled
            ? 'bg-success/20 text-success'
            : 'text-ink-muted hover:bg-bg-hover'
        }`}
        title="Snap (F3)"
      >
        🧲 Snap
      </button>
      <button
        type="button"
        onClick={toggleOrtho}
        className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
          orthoEnabled
            ? 'bg-warning/20 text-warning'
            : 'text-ink-muted hover:bg-bg-hover'
        }`}
        title="Ortho (F8) — กด Shift ค้าง = ชั่วคราว"
      >
        ⊾ Ortho
      </button>

      <Separator />

      {/* scale status */}
      <span className="text-xs text-ink-muted">
        สเกล:{' '}
        {scale ? (
          <span className="font-mono text-ink-primary">
            {scale.pixelPerUnit.toFixed(1)} px/ม.
          </span>
        ) : (
          <span className="text-warning">ยังไม่ตั้ง</span>
        )}
      </span>
    </div>
  );
}

function Separator() {
  return <div className="mx-1 h-5 w-px bg-bg-border" />;
}
