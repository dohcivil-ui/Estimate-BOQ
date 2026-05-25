/**
 * Snap controls panel — toggle ทั้งหมด + image-snap sensitivity
 */
import {
  useSnapStore,
  type ImageSnapSensitivity,
} from '@/stores/snapStore';
import { useActivePage } from '@/stores/drawingStore';

export function SnapControls() {
  const enabled = useSnapStore((s) => s.enabled);
  const toggles = useSnapStore((s) => s.toggles);
  const imageSnap = useSnapStore((s) => s.imageSnap);
  const sensitivity = useSnapStore((s) => s.imageSensitivity);
  const setEnabled = useSnapStore((s) => s.setEnabled);
  const setToggle = useSnapStore((s) => s.setToggle);
  const setImageSnap = useSnapStore((s) => s.setImageSnap);
  const setSensitivity = useSnapStore((s) => s.setImageSensitivity);
  const page = useActivePage();

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="accent-success"
        />
        <span className="font-medium text-ink-primary">🧲 Snap (F3)</span>
      </label>

      {enabled && (
        <div className="space-y-1.5 rounded border border-bg-border bg-bg-raised p-2">
          <SnapCheck
            label="● ปลายเส้น"
            color="text-success"
            checked={toggles.endpoint}
            onChange={(v) => setToggle('endpoint', v)}
          />
          <SnapCheck
            label="▲ กลาง"
            color="text-warning"
            checked={toggles.midpoint}
            onChange={(v) => setToggle('midpoint', v)}
          />
          <SnapCheck
            label="✕ จุดตัด"
            color="text-pink-400"
            checked={toggles.intersection}
            onChange={(v) => setToggle('intersection', v)}
          />
          <SnapCheck
            label="⊾ ตั้งฉาก"
            color="text-cyan-400"
            checked={toggles.perpendicular}
            onChange={(v) => setToggle('perpendicular', v)}
          />
          <SnapCheck
            label="◇ บนเส้น"
            color="text-orange-400"
            checked={toggles.onEdge}
            onChange={(v) => setToggle('onEdge', v)}
          />
        </div>
      )}

      {/* image snap */}
      <div className="rounded border border-cyan-500/30 bg-cyan-500/5 p-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={imageSnap}
            disabled={!page}
            onChange={(e) => setImageSnap(e.target.checked)}
            className="accent-cyan-400"
          />
          <span className="font-medium text-cyan-300">✛ Snap เส้นในแบบ</span>
          {!page && (
            <span className="text-[10px] text-ink-muted">
              (เปิดแบบก่อน)
            </span>
          )}
        </label>
        {imageSnap && page && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-muted">
            <span>ความไว:</span>
            <select
              value={sensitivity}
              onChange={(e) =>
                setSensitivity(e.target.value as ImageSnapSensitivity)
              }
              className="rounded border border-bg-border bg-bg-base px-1 py-0.5 text-[11px] text-ink-primary"
            >
              <option value="dark">เส้นเข้มจัด</option>
              <option value="normal">ปกติ</option>
              <option value="faint">เส้นจาง/สแกน</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

function SnapCheck({
  label,
  color,
  checked,
  onChange,
}: {
  label: string;
  color: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
      <span className={color}>{label}</span>
    </label>
  );
}
