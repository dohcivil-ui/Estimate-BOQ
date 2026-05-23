// src/schema/v1/importPolicy.ts — data-safety v1: import policy (PURE)
//
// SCOPE: pure validation + scale resolution + sheet construction.
//   ห้ามต่อ pdfjs/IndexedDB/IO ที่นี่ — sha256 + raster bytes คำนวณที่ IO
//   boundary แล้วส่งค่าเข้ามาเป็น string/number (guard ยังคง pure).
//
// References:
//   - schema types: ./types
//   - guard (canonical-px frozen): ./guards.assertSheetMatchesRaster
//
// Constants ทุกตัวเป็น export เพื่อใช้เทียบใน tests + ให้ caller เปลี่ยน strategy
// ได้โดยอ่านค่ามาเทียบ (ไม่ใช่ค่าวิ่ง config ใน runtime — bump เป็น code change).

import type { Sheet } from './types';

// =============================================================================
// Limits (binary MiB; PDF point = 1/72 inch)
// =============================================================================

/** soft cap → warn (50 MiB) */
export const SOFT_CAP_BYTES = 50 * 1024 * 1024;
/** hard cap → throw (200 MiB) */
export const HARD_CAP_BYTES = 200 * 1024 * 1024;

/** ~30 megapixels total — กัน canvas อ้วน RAM */
export const MAX_PIXELS_TOTAL = 30_000_000;
/** per-side cap (เกินนี้ canvas API บางตัวคืน blank หรือ truncate เงียบ) */
export const MAX_PIXELS_PER_SIDE = 16384;

/** PDF convention */
export const POINTS_PER_INCH = 72;

// =============================================================================
// 1) validateImportFile — soft 50MB warn, hard 200MB throw, pageCount unrestricted
// =============================================================================

export type ImportValidation = {
  /** human-readable warning when over soft cap; undefined when clean */
  warning?: string;
};

/**
 * ตรวจไฟล์ที่กำลังจะ import (sizeBytes + pageCount):
 *   - sizeBytes > HARD_CAP_BYTES (200 MiB) → throw (refuse to import)
 *   - sizeBytes > SOFT_CAP_BYTES (50 MiB)  → warning (ผู้ใช้เลือกต่อ/ไม่ต่อ)
 *   - pageCount ไม่จำกัด (decode lazy ต่อหน้า) — เช็คแค่ > 0 กัน input pathological
 *
 * PURE: ไม่อ่านไฟล์, ไม่ console.warn, return warning เป็น string ให้ caller จัดการ.
 */
export function validateImportFile({
  sizeBytes,
  pageCount,
}: {
  sizeBytes: number;
  pageCount: number;
}): ImportValidation {
  // !(x > 0) จับ NaN/0/ลบ พร้อมกัน (เหมือน scale.ts)
  if (!(sizeBytes > 0)) {
    throw new Error('validateImportFile: sizeBytes must be > 0');
  }
  if (!(pageCount > 0)) {
    throw new Error('validateImportFile: pageCount must be > 0');
  }
  // page count ไม่จำกัด ต่อจากนี้ — decode lazy per page

  if (sizeBytes > HARD_CAP_BYTES) {
    throw new Error(
      `validateImportFile: file size ${formatMiB(sizeBytes)} exceeds hard cap ` +
        `${formatMiB(HARD_CAP_BYTES)} — refuse to import`,
    );
  }
  if (sizeBytes > SOFT_CAP_BYTES) {
    return {
      warning:
        `file size ${formatMiB(sizeBytes)} exceeds soft cap ` +
        `${formatMiB(SOFT_CAP_BYTES)} — import may be slow / memory-heavy`,
    };
  }
  return {};
}

// =============================================================================
// 2) resolveRenderScale — target DPI → effective renderScale/dpi/widthPx/heightPx
//    downscale อัตโนมัติถ้าเกิน MAX_PIXELS_TOTAL หรือ MAX_PIXELS_PER_SIDE
//    downscale ต้อง explicit (downscaled:true + warning) — ไม่เงียบ
// =============================================================================

export type ResolveRenderScaleResult = {
  /** pixels per PDF point (คูณกับ pageWidthPt/pageHeightPt → widthPx/heightPx) */
  renderScale: number;
  /** effective DPI = renderScale × 72 (อาจน้อยกว่า targetDpi ถ้า downscaled) */
  dpi: number;
  /** canonical page-pixel width (floor — กันเกิน per-side หลัง round) */
  widthPx: number;
  /** canonical page-pixel height (floor) */
  heightPx: number;
  /** true ถ้า effective dpi < target dpi เนื่องจากชน MP/per-side cap */
  downscaled: boolean;
  /** human-readable เมื่อ downscaled; undefined ถ้าใช้ targetDpi ตามขอ */
  warning?: string;
};

// TODO(import-policy v2): "ค่าขั้นต่ำ DPI ที่ถือว่าไม่เบลอ" ยังไม่ได้กำหนดในสเปก
//   v1 บังคับเฉพาะ widthPx/heightPx >= 1 (กัน canvas ว่าง). เพิ่ม MIN_DPI guard
//   ในรอบถัดไปเมื่อมีค่าระบุ (เช่น 50? 72?). อย่าตั้งค่า floor ตามใจ — caller
//   ที่ตั้ง targetDpi เล็กมากต้องตั้งใจตั้งเอง.

/**
 * แปลง target DPI → renderScale + canonical pixel dims:
 *   renderScale = dpi / 72
 *   widthPx = floor(pageWidthPt × renderScale)  (floor: กันเกิน per-side cap)
 *   heightPx = floor(pageHeightPt × renderScale)
 *
 * ถ้า requested scale ทำให้:
 *   - widthPx × heightPx > MAX_PIXELS_TOTAL  หรือ
 *   - widthPx > MAX_PIXELS_PER_SIDE  หรือ  heightPx > MAX_PIXELS_PER_SIDE
 * → ลด scale ลงให้ชนขอบที่เข้มงวดที่สุด แล้วตั้ง downscaled:true + warning.
 *
 * widthPx/heightPx ที่ออกมา < 1 → throw (canvas ว่าง = bug ขั้นปลาย).
 */
export function resolveRenderScale({
  pageWidthPt,
  pageHeightPt,
  targetDpi,
}: {
  pageWidthPt: number;
  pageHeightPt: number;
  targetDpi: number;
}): ResolveRenderScaleResult {
  if (!(pageWidthPt > 0) || !(pageHeightPt > 0)) {
    throw new Error(
      `resolveRenderScale: page dimensions must be > 0 ` +
        `(got ${pageWidthPt}×${pageHeightPt}pt)`,
    );
  }
  if (!(targetDpi > 0)) {
    throw new Error(`resolveRenderScale: targetDpi must be > 0 (got ${targetDpi})`);
  }

  const requestedScale = targetDpi / POINTS_PER_INCH;

  // pageW×scale × pageH×scale ≤ MAX_PIXELS_TOTAL → scale² ≤ MAX/(pageW×pageH)
  const scaleMaxByMP = Math.sqrt(
    MAX_PIXELS_TOTAL / (pageWidthPt * pageHeightPt),
  );
  // pageW×scale ≤ MAX_PER_SIDE → scale ≤ MAX_PER_SIDE / pageW
  const scaleMaxBySide = Math.min(
    MAX_PIXELS_PER_SIDE / pageWidthPt,
    MAX_PIXELS_PER_SIDE / pageHeightPt,
  );
  const maxAllowedScale = Math.min(scaleMaxByMP, scaleMaxBySide);

  const effectiveScale = Math.min(requestedScale, maxAllowedScale);
  const downscaled = effectiveScale < requestedScale;

  // floor: กันเกิน per-side cap หลัง round (เช่น 16384.4 → 16384, ไม่ใช่ 16385)
  const widthPx = Math.floor(pageWidthPt * effectiveScale);
  const heightPx = Math.floor(pageHeightPt * effectiveScale);

  // empty-canvas guard (Golden Rule: ห้ามคืนค่าที่ทำ canvas ว่าง)
  if (widthPx < 1 || heightPx < 1) {
    throw new Error(
      `resolveRenderScale: computed canvas ${widthPx}×${heightPx} is empty ` +
        `(targetDpi=${targetDpi}, page=${pageWidthPt}×${pageHeightPt}pt)`,
    );
  }

  const effectiveDpi = effectiveScale * POINTS_PER_INCH;

  if (downscaled) {
    return {
      renderScale: effectiveScale,
      dpi: effectiveDpi,
      widthPx,
      heightPx,
      downscaled: true,
      warning:
        `downscaled from ${targetDpi.toFixed(0)} DPI → ${effectiveDpi.toFixed(0)} DPI ` +
        `(page ${pageWidthPt}×${pageHeightPt}pt → ${widthPx}×${heightPx}px; ` +
        `caps: ${MAX_PIXELS_TOTAL / 1_000_000}MP total, ${MAX_PIXELS_PER_SIDE}px/side)`,
    };
  }
  return {
    renderScale: effectiveScale,
    dpi: effectiveDpi,
    widthPx,
    heightPx,
    downscaled: false,
  };
}

// =============================================================================
// 3) freezeSheet — สร้าง Sheet (schema v1) ที่ frozen ทั้ง values + object identity
//    inputs ทั้งหมดเป็น caller-provided (id, sha256 มาจากชั้นนอก) → ยังคง pure.
// =============================================================================

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

export function freezeSheet(input: {
  id: string;
  projectId: string;
  sourceFileId: string;
  pageIndex: number;
  renderScale: number;
  dpi: number;
  widthPx: number;
  heightPx: number;
  sha256: string;
}): Readonly<Sheet> {
  if (!input.id || !input.projectId || !input.sourceFileId) {
    throw new Error(
      'freezeSheet: id, projectId, sourceFileId must be non-empty strings',
    );
  }
  if (!Number.isInteger(input.pageIndex) || input.pageIndex < 0) {
    throw new Error(
      `freezeSheet: pageIndex must be a non-negative integer (got ${input.pageIndex})`,
    );
  }
  if (!(input.renderScale > 0)) {
    throw new Error(
      `freezeSheet: renderScale must be > 0 (got ${input.renderScale})`,
    );
  }
  if (!(input.dpi > 0)) {
    throw new Error(`freezeSheet: dpi must be > 0 (got ${input.dpi})`);
  }
  if (
    !Number.isInteger(input.widthPx) ||
    !Number.isInteger(input.heightPx) ||
    input.widthPx < 1 ||
    input.heightPx < 1 ||
    input.widthPx > MAX_PIXELS_PER_SIDE ||
    input.heightPx > MAX_PIXELS_PER_SIDE
  ) {
    throw new Error(
      `freezeSheet: widthPx/heightPx must be integers in ` +
        `[1, ${MAX_PIXELS_PER_SIDE}] (got ${input.widthPx}×${input.heightPx})`,
    );
  }
  if (!SHA256_HEX_RE.test(input.sha256)) {
    throw new Error(
      `freezeSheet: sha256 must be 64-char lowercase hex (got "${input.sha256}")`,
    );
  }
  return Object.freeze({
    id: input.id,
    projectId: input.projectId,
    sourceFileId: input.sourceFileId,
    pageIndex: input.pageIndex,
    renderScale: input.renderScale,
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    dpi: input.dpi,
    sha256: input.sha256,
  });
}

// =============================================================================
// internal
// =============================================================================

function formatMiB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MiB`;
}
