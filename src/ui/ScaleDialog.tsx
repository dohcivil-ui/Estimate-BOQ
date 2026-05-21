// src/ui/ScaleDialog.tsx — Scale Tool dialog (spec §9.2)
// 2 โหมด: calibrate (หน้านี้ยังไม่มี scale) | verify (มี scale อยู่แล้ว → ตรวจสอบ ±%)
import { useEffect, useMemo, useState } from 'react';
import {
  useScaleStore,
  SHORT_PIXEL_DISTANCE_THRESHOLD,
} from '../stores/scaleStore';
import { toMeters } from '../core/scale';
import type { LengthUnit } from '../types';

export function ScaleDialog() {
  const draft = useScaleStore((s) => s.draft);
  const profile = useScaleStore((s) =>
    draft.phase === 'pendingConfirm' ? (s.byPageId[draft.pageId] ?? null) : null,
  );
  const confirmCalibration = useScaleStore((s) => s.confirmCalibration);
  const cancelDraft = useScaleStore((s) => s.cancelDraft);
  const closeVerify = useScaleStore((s) => s.closeVerify);

  const [realDistanceTxt, setRealDistanceTxt] = useState('');
  const [unit, setUnit] = useState<LengthUnit>('m');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // เปิด dialog ใหม่ทุกครั้ง → reset input + error
  useEffect(() => {
    if (draft.phase === 'pendingConfirm') {
      setRealDistanceTxt('');
      setUnit('m');
      setSubmitError(null);
    }
  }, [draft.phase]);

  // คำนวณค่าที่จะใช้ — destructure ภายใน เพื่อให้ TS narrow draft ได้ + เลี่ยง TDZ
  const computed = useMemo(() => {
    if (draft.phase !== 'pendingConfirm') return null;
    const { mode, pixelDistance } = draft;
    const parsed = parseFloat(realDistanceTxt);
    const realMeters =
      Number.isFinite(parsed) && parsed > 0 ? toMeters(parsed, unit) : null;
    // strict > 0 ทั้งคู่ — กัน Infinity/NaN poison BOQ
    const validInput =
      realMeters !== null && realMeters > 0 && pixelDistance > 0;

    let measuredMeters: number | null = null;
    let errorPct: number | null = null;
    if (mode === 'verify' && profile) {
      measuredMeters = pixelDistance * profile.unitPerPixel;
      if (validInput) {
        errorPct = ((measuredMeters - realMeters) / realMeters) * 100;
      }
    }

    const previewUnitPerPixel = validInput ? realMeters / pixelDistance : null;
    return { validInput, parsed, realMeters, measuredMeters, errorPct, previewUnitPerPixel };
  }, [draft, realDistanceTxt, unit, profile]);

  if (draft.phase !== 'pendingConfirm') return null;

  // ดึงค่าออกมาเป็น const หลัง narrow — TS ไม่ preserve narrowing เข้า closure
  const { mode, pixelDistance } = draft;
  const isShortDistance = pixelDistance < SHORT_PIXEL_DISTANCE_THRESHOLD;
  const c = computed!;

  function tryConfirm() {
    if (!c.validInput) return;
    setSubmitError(null);
    try {
      confirmCalibration(c.parsed, unit);
    } catch (err) {
      // dialog stays open — แสดง error ใน UI ไม่ปล่อย crash
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  }

  function onSubmitCalibrate(e: React.FormEvent) {
    e.preventDefault();
    tryConfirm();
  }

  function onClose() {
    if (mode === 'verify') closeVerify();
    else cancelDraft();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={onSubmitCalibrate}
        style={{
          minWidth: 340,
          maxWidth: 420,
          background: '#1f1f1f',
          color: '#eee',
          border: '1px solid #444',
          borderRadius: 6,
          padding: 18,
          fontSize: 13,
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 10, fontSize: 15, color: '#fff' }}>
          {mode === 'calibrate' ? 'ตั้ง scale หน้านี้' : 'ตรวจสอบ scale'}
        </h3>

        <div style={{ marginBottom: 12, color: '#bbb' }}>
          ระยะที่คลิก: <b style={{ color: '#fff' }}>{pixelDistance.toFixed(2)} px</b>
          {mode === 'verify' && c.measuredMeters !== null && (
            <>
              <br />
              คำนวณจาก scale ปัจจุบัน:{' '}
              <b style={{ color: '#7dd87d' }}>{c.measuredMeters.toFixed(3)} m</b>
            </>
          )}
        </div>

        {mode === 'verify' && (
          <div
            style={{
              padding: '6px 10px',
              marginBottom: 12,
              background: '#14283a',
              border: '1px solid #5b9dff',
              borderRadius: 4,
              color: '#b9d4ff',
              fontSize: 12,
            }}
          >
            💡 เพื่อพิสูจน์ความแม่นยำ — ควรวัด <b>ระยะอ้างอิงตัวอื่น</b>ที่รู้ค่าจริง
            (ไม่ใช่เส้นเดิมที่ใช้ตั้ง scale) เพราะวัดเส้นเดิมจะได้ %error ≈ 0 เสมอ
            ไม่ได้พิสูจน์อะไร
          </div>
        )}

        {isShortDistance && (
          <div
            style={{
              padding: '6px 10px',
              marginBottom: 12,
              background: '#3a2a14',
              border: '1px solid #e6b450',
              borderRadius: 4,
              color: '#e6b450',
              fontSize: 12,
            }}
          >
            ⚠ ระยะที่คลิกสั้น ({pixelDistance.toFixed(0)} px) ความแม่นยำของ scale แปรผกผัน
            กับระยะ calibrate — แนะนำคลิกบนระยะที่ยาวที่สุดที่ทราบค่า (เช่น grid 5–10 m, หรือ scale bar)
          </div>
        )}

        <label style={{ display: 'block', marginBottom: 4, color: '#bbb' }}>
          {mode === 'calibrate' ? 'ระยะจริงที่ทราบ' : 'ระยะจริงที่ทราบ (ถ้ามี)'}:
        </label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input
            type="number"
            step="any"
            min="0"
            autoFocus
            placeholder={mode === 'calibrate' ? 'เช่น 5.00' : 'กรอกค่าจริงเพื่อตรวจ %error'}
            value={realDistanceTxt}
            onChange={(e) => setRealDistanceTxt(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: 13,
              background: '#0f0f0f',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: 3,
            }}
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as LengthUnit)}
            style={{
              padding: '6px 8px',
              fontSize: 13,
              background: '#0f0f0f',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: 3,
            }}
          >
            <option value="m">m</option>
            <option value="mm">mm</option>
          </select>
        </div>

        {c.previewUnitPerPixel !== null && (
          <div style={{ marginBottom: 12, color: '#999', fontSize: 12 }}>
            ค่าที่จะได้: <code style={{ color: '#7dd87d' }}>{c.previewUnitPerPixel.toFixed(6)} m/px</code>{' '}
            (= {(1 / c.previewUnitPerPixel).toFixed(2)} px/m)
          </div>
        )}

        {mode === 'verify' && c.errorPct !== null && (
          <div
            style={{
              marginBottom: 12,
              padding: '6px 10px',
              borderRadius: 4,
              fontSize: 12,
              background: Math.abs(c.errorPct) < 2 ? '#16321a' : '#3a1a1a',
              border: `1px solid ${Math.abs(c.errorPct) < 2 ? '#7dd87d' : '#ff8080'}`,
              color: Math.abs(c.errorPct) < 2 ? '#7dd87d' : '#ff8080',
            }}
          >
            %error เทียบกับค่าจริง: <b>{c.errorPct >= 0 ? '+' : ''}{c.errorPct.toFixed(2)}%</b>{' '}
            {Math.abs(c.errorPct) < 2 ? '✓ ใกล้เคียง' : '— อาจต้อง re-calibrate'}
          </div>
        )}

        {submitError && (
          <div
            style={{
              padding: '6px 10px',
              marginBottom: 12,
              background: '#3a1a1a',
              border: '1px solid #ff8080',
              borderRadius: 4,
              color: '#ff8080',
              fontSize: 12,
            }}
          >
            ✗ ตั้ง scale ไม่สำเร็จ: {submitError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              background: '#2a2a2a',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {mode === 'verify' ? 'ปิด' : 'ยกเลิก'}
          </button>
          {mode === 'calibrate' ? (
            <button
              type="submit"
              disabled={!c.validInput}
              style={{
                padding: '6px 14px',
                fontSize: 13,
                background: c.validInput ? '#284a7a' : '#1f2a3a',
                color: c.validInput ? '#fff' : '#666',
                border: `1px solid ${c.validInput ? '#5b9dff' : '#333'}`,
                borderRadius: 3,
                cursor: c.validInput ? 'pointer' : 'not-allowed',
              }}
            >
              ตั้ง scale
            </button>
          ) : (
            <button
              type="button"
              onClick={tryConfirm}
              disabled={!c.validInput}
              style={{
                padding: '6px 14px',
                fontSize: 13,
                background: c.validInput ? '#7a3d28' : '#3a2a1f',
                color: c.validInput ? '#fff' : '#666',
                border: `1px solid ${c.validInput ? '#e6b450' : '#333'}`,
                borderRadius: 3,
                cursor: c.validInput ? 'pointer' : 'not-allowed',
              }}
              title="แทนที่ scale เดิมด้วยค่านี้"
            >
              ตั้งใหม่ (overwrite)
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
