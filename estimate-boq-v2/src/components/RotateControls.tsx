/**
 * Image rotation controls (visual-only) — ±0.1° / ±1° / รีเซ็ต / auto-deskew
 */
import { useState } from 'react';
import { useActivePage } from '@/stores/drawingStore';
import { useRotationFor, useRotationStore } from '@/stores/rotationStore';
import { detectMedianEdgeAngle, type RasterData } from '@/core/imageEdges';

const MAX_SAMPLE_WIDTH = 600;

export function RotateControls() {
  const page = useActivePage();
  const rot = useRotationFor(page?.id ?? null);
  const setRot = useRotationStore((s) => s.set);
  const addRot = useRotationStore((s) => s.add);
  const reset = useRotationStore((s) => s.reset);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!page) return null;

  const handleAuto = () => {
    if (!page.bitmap) return;
    setBusy(true);
    setMsg(null);
    try {
      // downsample เพื่อ speed
      const iw = page.bitmap.width;
      const ih = page.bitmap.height;
      const ratio = Math.min(MAX_SAMPLE_WIDTH / iw, MAX_SAMPLE_WIDTH / ih, 1);
      const w = Math.round(iw * ratio);
      const h = Math.round(ih * ratio);
      const oc = document.createElement('canvas');
      oc.width = w;
      oc.height = h;
      const ctx = oc.getContext('2d');
      if (!ctx) throw new Error('ไม่สามารถสร้าง canvas เพื่อตรวจวิเคราะห์');
      ctx.drawImage(page.bitmap, 0, 0, w, h);
      const raster: RasterData = ctx.getImageData(0, 0, w, h);

      const median = detectMedianEdgeAngle(raster);
      if (median === null) {
        setMsg('ไม่พบเส้นในแบบเพียงพอ — ลองหมุนด้วยมือ');
        return;
      }
      const correction = -median;
      if (Math.abs(correction) < 0.05) {
        setMsg(`ภาพตั้งฉากดีแล้ว (เอียง ${median.toFixed(2)}°)`);
        return;
      }
      setRot(page.id, rot + correction);
      setMsg(
        `ตรวจพบเอียง ${median.toFixed(1)}° → หมุนแก้ ${correction.toFixed(1)}°`,
      );
    } catch (err) {
      setMsg(
        `ไม่สามารถวิเคราะห์ภาพ: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-secondary">🔄 หมุนภาพ (แก้แบบเอียง)</span>
        <span className="font-mono text-ink-primary">{rot.toFixed(1)}°</span>
      </div>

      <div className="grid grid-cols-5 gap-1">
        <button
          type="button"
          onClick={() => addRot(page.id, -1)}
          className="rounded border border-bg-border bg-bg-raised px-1 py-1 text-[11px] text-ink-secondary hover:bg-bg-hover hover:text-ink-primary"
        >
          −1°
        </button>
        <button
          type="button"
          onClick={() => addRot(page.id, -0.1)}
          className="rounded border border-bg-border bg-bg-raised px-1 py-1 text-[11px] text-ink-secondary hover:bg-bg-hover hover:text-ink-primary"
        >
          −0.1°
        </button>
        <button
          type="button"
          onClick={() => reset(page.id)}
          className="rounded border border-bg-border bg-bg-raised px-1 py-1 text-[11px] text-ink-secondary hover:bg-bg-hover hover:text-ink-primary"
        >
          ⟲
        </button>
        <button
          type="button"
          onClick={() => addRot(page.id, 0.1)}
          className="rounded border border-bg-border bg-bg-raised px-1 py-1 text-[11px] text-ink-secondary hover:bg-bg-hover hover:text-ink-primary"
        >
          +0.1°
        </button>
        <button
          type="button"
          onClick={() => addRot(page.id, 1)}
          className="rounded border border-bg-border bg-bg-raised px-1 py-1 text-[11px] text-ink-secondary hover:bg-bg-hover hover:text-ink-primary"
        >
          +1°
        </button>
      </div>

      <button
        type="button"
        onClick={handleAuto}
        disabled={busy}
        className="w-full rounded bg-warning/20 px-2 py-1.5 text-xs font-medium text-warning hover:bg-warning/30 disabled:opacity-60"
      >
        {busy ? 'กำลังตรวจวิเคราะห์…' : '🤖 ตรวจจับอัตโนมัติ (Sobel)'}
      </button>

      {msg && <p className="text-[11px] text-ink-muted">{msg}</p>}
    </div>
  );
}
