/**
 * Modal สำหรับใส่ระยะจริงหลังคลิก 2 จุดด้วย scale tool
 * - กรอกระยะ + เลือกหน่วย (m/cm/mm)
 * - confirm → calibrateScale + บันทึก ScaleMeasurement
 */
import { useEffect, useRef, useState } from 'react';
import { calibrateScale, type LengthUnit } from '@/core/scale';
import { useScaleStore } from '@/stores/scaleStore';
import { useMeasurementStore } from '@/stores/measurementStore';
import { useToolStore } from '@/stores/toolStore';
import type { Point2D } from '@/types/viewport';
import type { ScaleMeasurement } from '@/types/measurement';

interface Props {
  pageId: string;
  p1: Point2D;
  p2: Point2D;
  onClose: () => void;
}

export function ScaleDialog({ pageId, p1, p2, onClose }: Props) {
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<LengthUnit>('m');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const pixelDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = Number(value);
    if (!isFinite(num) || num <= 0) {
      setError('กรุณากรอกระยะจริงเป็นตัวเลขมากกว่า 0');
      return;
    }
    try {
      const profile = calibrateScale(p1, p2, num, unit);
      useScaleStore.getState().setScale(pageId, profile);

      const sm: ScaleMeasurement = {
        id: crypto.randomUUID(),
        pageId,
        type: 'scale',
        status: 'confirmed',
        layer: 'สเกล',
        label: `${num} ${unit} ≡ ${pixelDist.toFixed(0)} px`,
        points: [p1, p2],
        realDistance: num,
        unit,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      useMeasurementStore.getState().add(sm);
      useToolStore.getState().clearDraft();
      // หลังตั้งสเกล กลับไปที่ select tool ให้ผู้ใช้ดูผล
      useToolStore.getState().setActiveTool('select');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCancel = () => {
    useToolStore.getState().clearDraft();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-bg-border bg-bg-panel p-5 shadow-2xl"
      >
        <h2 className="mb-1 text-base font-semibold text-ink-primary">
          📐 ตั้งสเกล
        </h2>
        <p className="mb-4 text-xs text-ink-secondary">
          ระยะที่วัดได้ในรูป: <span className="font-mono text-ink-primary">{pixelDist.toFixed(1)} px</span>
          <br />
          กรอกระยะจริงที่ตรงกันบนแบบ
        </p>

        <div className="mb-3 flex gap-2">
          <input
            ref={inputRef}
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="เช่น 5.00"
            className="flex-1 rounded border border-bg-border bg-bg-raised px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as LengthUnit)}
            className="rounded border border-bg-border bg-bg-raised px-2 py-2 text-sm text-ink-primary outline-none focus:border-accent"
          >
            <option value="m">เมตร</option>
            <option value="cm">เซนติเมตร</option>
            <option value="mm">มิลลิเมตร</option>
          </select>
        </div>

        {error && (
          <p className="mb-3 rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded border border-bg-border bg-bg-raised px-3 py-1.5 text-sm text-ink-secondary hover:bg-bg-hover"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-ink-inverse hover:bg-accent-hover"
          >
            ตั้งสเกล
          </button>
        </div>
      </form>
    </div>
  );
}
