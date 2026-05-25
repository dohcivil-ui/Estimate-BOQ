/**
 * Image-edge snap + auto-deskew — ทำงานบน ImageData (Uint8ClampedArray)
 * ไม่ import React/Konva/DOM
 *
 * snap-to-edge: หา dark pixel ใกล้ cursor (ภายในรัศมี) → คืนจุดที่ใกล้สุด
 * auto-deskew: Sobel gradient → median angle ของ edge pixels
 */
import type { Pt } from './geometry';

export interface RasterData {
  data: Uint8ClampedArray; // RGBA
  width: number;
  height: number;
}

/**
 * หา dark pixel (luminance < threshold) ใน "วงกลม" รัศมี radius รอบจุด cursor
 * คืน pixel ที่ใกล้สุด หรือ null ถ้าไม่เจอ
 */
export function findDarkPixelNear(
  raster: RasterData,
  cursor: Pt,
  radius: number,
  threshold = 130,
): Pt | null {
  const { data, width: W, height: H } = raster;
  const cx = Math.round(cursor.x);
  const cy = Math.round(cursor.y);
  const R = Math.max(1, Math.min(35, Math.round(radius)));
  const R2 = R * R;

  let bestD2 = R2;
  let best: Pt | null = null;

  for (let dy = -R; dy <= R; dy++) {
    const yy = cy + dy;
    if (yy < 0 || yy >= H) continue;
    for (let dx = -R; dx <= R; dx++) {
      const xx = cx + dx;
      if (xx < 0 || xx >= W) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 > bestD2) continue;
      const i = (yy * W + xx) * 4;
      if (data[i + 3]! < 20) continue; // โปร่งใส
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < threshold && d2 < bestD2) {
        bestD2 = d2;
        best = { x: xx, y: yy };
      }
    }
  }

  return best;
}

/**
 * Auto-deskew — median angle ของ gradient (Sobel) ที่ edge pixels
 *
 * ขั้นตอน:
 *   1. resize image ลง maxW (สำหรับ speed) — ผู้เรียกควรส่ง downsampled มาแล้ว
 *   2. grayscale luminance
 *   3. Sobel gradient gx, gy ที่ทุก interior pixel
 *   4. edge pixel ที่ |g| > threshold → angle = atan2(gy, gx)
 *   5. normalize ลง range [-45°, 45°] (โดยลบ/บวก 90° จนเข้าช่วง)
 *   6. median ของ angles
 *
 * คืนมุมเป็น degrees — ค่าจริงที่จะหมุน "แก้" = -medianAngle
 * ถ้า edge pixels < minSamples → คืน null (รูปไม่มีเส้นพอ)
 */
export function detectMedianEdgeAngle(
  raster: RasterData,
  options: { magnitudeThreshold?: number; minSamples?: number } = {},
): number | null {
  const { magnitudeThreshold = 50, minSamples = 100 } = options;
  const { data, width: w, height: h } = raster;

  // ─── grayscale ─────────────────────────────────────────────────────
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    gray[i] = 0.299 * data[j]! + 0.587 * data[j + 1]! + 0.114 * data[j + 2]!;
  }

  // ─── Sobel gradient + collect angles ────────────────────────────────
  const angles: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      // Sobel X kernel
      const gx =
        gray[(y - 1) * w + x + 1]! -
        gray[(y - 1) * w + x - 1]! +
        2 * (gray[y * w + x + 1]! - gray[y * w + x - 1]!) +
        gray[(y + 1) * w + x + 1]! -
        gray[(y + 1) * w + x - 1]!;
      // Sobel Y kernel
      const gy =
        gray[(y + 1) * w + x - 1]! -
        gray[(y - 1) * w + x - 1]! +
        2 * (gray[(y + 1) * w + x]! - gray[(y - 1) * w + x]!) +
        gray[(y + 1) * w + x + 1]! -
        gray[(y - 1) * w + x + 1]!;
      const mag = Math.hypot(gx, gy);
      if (mag > magnitudeThreshold) {
        let a = (Math.atan2(gy, gx) * 180) / Math.PI;
        // normalize ลง [-45, 45] — รวมเส้น horizontal + vertical
        while (a > 45) a -= 90;
        while (a < -45) a += 90;
        angles.push(a);
      }
    }
  }

  if (angles.length < minSamples) return null;
  angles.sort((a, b) => a - b);
  return angles[Math.floor(angles.length / 2)]!;
}
