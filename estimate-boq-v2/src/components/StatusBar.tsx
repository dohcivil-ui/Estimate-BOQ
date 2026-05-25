/**
 * StatusBar — เครื่องมือ / สเกล / พิกัด / snap / zoom
 */
import { useActivePage } from '@/stores/drawingStore';
import { useCursorStore } from '@/stores/cursorStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useScaleFor } from '@/stores/scaleStore';
import { useActiveTool, useToolStore } from '@/stores/toolStore';
import { useSnapStore } from '@/stores/snapStore';
import { useOrthoStore } from '@/stores/orthoStore';
import { TOOL_LABELS } from '@/types/tool';
import { pxToMeters } from '@/core/scale';

export function StatusBar() {
  const page = useActivePage();
  const zoom = useViewportStore((s) =>
    page ? (s.byPageId[page.id]?.zoom ?? 1) : 1,
  );
  const cursor = useCursorStore();
  const scale = useScaleFor(page?.id ?? null);
  const tool = useActiveTool();
  const draftCount = useToolStore((s) => s.draftPoints.length);
  const snapEnabled = useSnapStore((s) => s.enabled);
  const imageSnap = useSnapStore((s) => s.imageSnap);
  const orthoActive = useOrthoStore((s) => s.enabled || s.shiftDown);

  const coordStr =
    cursor.visible && cursor.pageX != null && cursor.pageY != null
      ? scale
        ? `x: ${pxToMeters(cursor.pageX, scale).toFixed(2)} m, y: ${pxToMeters(
            cursor.pageY,
            scale,
          ).toFixed(2)} m`
        : `x: ${cursor.pageX.toFixed(0)}, y: ${cursor.pageY.toFixed(0)} px`
      : 'x: —, y: —';

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-bg-border bg-bg-panel px-3 text-[11px] text-ink-muted">
      <div className="flex items-center gap-4">
        <StatusItem
          label="เครื่องมือ"
          value={`${TOOL_LABELS[tool]}${draftCount > 0 ? ` · ${draftCount} จุด` : ''}`}
        />
        <StatusItem
          label="สเกล"
          value={
            scale
              ? `1 m = ${scale.pixelPerUnit.toFixed(1)} px`
              : 'ยังไม่ตั้ง'
          }
        />
        <StatusItem label="พิกัด" value={coordStr} />
      </div>
      <div className="flex items-center gap-4">
        <StatusItem
          label="Snap"
          value={
            snapEnabled
              ? imageSnap
                ? 'on + image'
                : 'on'
              : 'off'
          }
        />
        {orthoActive && (
          <span className="rounded bg-warning/20 px-1.5 py-0.5 text-warning">
            ⊾ ortho
          </span>
        )}
        <StatusItem label="Zoom" value={`${(zoom * 100).toFixed(0)}%`} />
      </div>
    </footer>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-ink-muted">{label}:</span>
      <span className="text-ink-secondary">{value}</span>
    </span>
  );
}
