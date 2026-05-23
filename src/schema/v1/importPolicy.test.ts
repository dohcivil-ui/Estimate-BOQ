// src/schema/v1/importPolicy.test.ts — data-safety v1 import policy
import { describe, it, expect } from 'vitest';
import {
  validateImportFile,
  resolveRenderScale,
  freezeSheet,
  SOFT_CAP_BYTES,
  HARD_CAP_BYTES,
  MAX_PIXELS_TOTAL,
  MAX_PIXELS_PER_SIDE,
  POINTS_PER_INCH,
} from './importPolicy';

// =============================================================================
// validateImportFile — soft/hard cap, pageCount unrestricted
// =============================================================================
describe('validateImportFile: caps + pageCount', () => {
  it('small file → no warning', () => {
    const r = validateImportFile({ sizeBytes: 1_000_000, pageCount: 5 });
    expect(r.warning).toBeUndefined();
  });
  it('exactly at soft cap → no warning (boundary uses >)', () => {
    const r = validateImportFile({ sizeBytes: SOFT_CAP_BYTES, pageCount: 1 });
    expect(r.warning).toBeUndefined();
  });
  it('above soft cap (50 MiB +1) → warning, no throw', () => {
    const r = validateImportFile({ sizeBytes: SOFT_CAP_BYTES + 1, pageCount: 1 });
    expect(r.warning).toMatch(/exceeds soft cap/);
  });
  it('exactly at hard cap → still warning, not throw', () => {
    const r = validateImportFile({ sizeBytes: HARD_CAP_BYTES, pageCount: 1 });
    expect(r.warning).toMatch(/exceeds soft cap/);
  });
  it('above hard cap → throw', () => {
    expect(() =>
      validateImportFile({ sizeBytes: HARD_CAP_BYTES + 1, pageCount: 1 }),
    ).toThrow(/exceeds hard cap/);
  });
  it('huge pageCount → not limited (no throw, no warning from pages)', () => {
    const r = validateImportFile({ sizeBytes: 1_000_000, pageCount: 50_000 });
    expect(r.warning).toBeUndefined();
  });
  it('sizeBytes <= 0 → throw', () => {
    expect(() => validateImportFile({ sizeBytes: 0, pageCount: 1 })).toThrow();
    expect(() => validateImportFile({ sizeBytes: -1, pageCount: 1 })).toThrow();
    expect(() =>
      validateImportFile({ sizeBytes: Number.NaN, pageCount: 1 }),
    ).toThrow();
  });
  it('pageCount <= 0 → throw', () => {
    expect(() => validateImportFile({ sizeBytes: 1000, pageCount: 0 })).toThrow();
  });
});

// =============================================================================
// resolveRenderScale — target DPI, downscale on MP/per-side cap, explicit flag
// =============================================================================
describe('resolveRenderScale: typical (A4-ish @ 150 DPI)', () => {
  // A4 ≈ 595 × 842 pt @ 150 DPI: scale=2.083 → ≈1239×1754 px (~2.17 MP)
  const r = resolveRenderScale({
    pageWidthPt: 595,
    pageHeightPt: 842,
    targetDpi: 150,
  });
  it('no downscale', () => {
    expect(r.downscaled).toBe(false);
    expect(r.warning).toBeUndefined();
  });
  it('renderScale = 150/72', () => {
    expect(r.renderScale).toBeCloseTo(150 / 72);
  });
  it('dpi ≈ 150', () => {
    expect(r.dpi).toBeCloseTo(150);
  });
  it('widthPx/heightPx = floor(pt × scale)', () => {
    expect(r.widthPx).toBe(Math.floor(595 * (150 / 72)));
    expect(r.heightPx).toBe(Math.floor(842 * (150 / 72)));
  });
});

describe('resolveRenderScale: downscale by MP cap (> 30MP)', () => {
  // 6000×5000pt @ 73 DPI → 6083×5069 ≈ 30.84 MP → must downscale
  const r = resolveRenderScale({
    pageWidthPt: 6000,
    pageHeightPt: 5000,
    targetDpi: 73,
  });
  it('downscaled flag = true (explicit, not silent)', () => {
    expect(r.downscaled).toBe(true);
  });
  it('warning present (downscale must not be silent)', () => {
    expect(r.warning).toMatch(/downscaled/);
  });
  it('effective dpi < target dpi', () => {
    expect(r.dpi).toBeLessThan(73);
  });
  it('total pixels ≤ MAX_PIXELS_TOTAL (with floor safety)', () => {
    expect(r.widthPx * r.heightPx).toBeLessThanOrEqual(MAX_PIXELS_TOTAL);
  });
});

describe('resolveRenderScale: downscale by per-side cap (> 16384)', () => {
  // 10000pt wide × 1000pt tall @ 150 DPI → width 20833 > 16384 → downscale
  const r = resolveRenderScale({
    pageWidthPt: 10000,
    pageHeightPt: 1000,
    targetDpi: 150,
  });
  it('downscaled = true', () => {
    expect(r.downscaled).toBe(true);
  });
  it('widthPx <= MAX_PIXELS_PER_SIDE', () => {
    expect(r.widthPx).toBeLessThanOrEqual(MAX_PIXELS_PER_SIDE);
  });
  it('heightPx <= MAX_PIXELS_PER_SIDE', () => {
    expect(r.heightPx).toBeLessThanOrEqual(MAX_PIXELS_PER_SIDE);
  });
  it('warning explains downscale', () => {
    expect(r.warning).toMatch(/downscaled.*DPI.*DPI/);
  });
});

describe('resolveRenderScale: at-boundary cases', () => {
  it('exactly at MAX_PIXELS_TOTAL (6000×5000pt @ 72 DPI = 30M) → no downscale', () => {
    // scale=1.0; 6000*5000 = 30,000,000 exactly
    const r = resolveRenderScale({
      pageWidthPt: 6000,
      pageHeightPt: 5000,
      targetDpi: POINTS_PER_INCH, // = 72 → scale=1
    });
    expect(r.downscaled).toBe(false);
    expect(r.widthPx * r.heightPx).toBe(MAX_PIXELS_TOTAL);
  });
});

describe('resolveRenderScale: input guards', () => {
  it('pageWidthPt <= 0 → throw', () => {
    expect(() =>
      resolveRenderScale({ pageWidthPt: 0, pageHeightPt: 100, targetDpi: 150 }),
    ).toThrow();
  });
  it('pageHeightPt <= 0 → throw', () => {
    expect(() =>
      resolveRenderScale({ pageWidthPt: 100, pageHeightPt: -1, targetDpi: 150 }),
    ).toThrow();
  });
  it('targetDpi <= 0 → throw', () => {
    expect(() =>
      resolveRenderScale({ pageWidthPt: 100, pageHeightPt: 100, targetDpi: 0 }),
    ).toThrow();
  });
  it('combination producing empty canvas (huge page, tiny dpi) → throw', () => {
    // tiny dpi + huge page would still produce >=1 px due to constraints; force
    // edge case: 1pt × 1pt @ 0.0001 DPI → < 1 px
    expect(() =>
      resolveRenderScale({
        pageWidthPt: 1,
        pageHeightPt: 1,
        targetDpi: 0.0001,
      }),
    ).toThrow(/empty/);
  });
});

// =============================================================================
// freezeSheet — schema-v1 Sheet construction, validated + Object.frozen
// =============================================================================
describe('freezeSheet: happy path', () => {
  const ok = freezeSheet({
    id: 'S-1',
    projectId: 'P-1',
    sourceFileId: 'F-1',
    pageIndex: 0,
    renderScale: 2,
    dpi: 144,
    widthPx: 1190,
    heightPx: 1684,
    sha256: 'a'.repeat(64),
  });
  it('returns Sheet with all fields', () => {
    expect(ok).toMatchObject({
      id: 'S-1',
      projectId: 'P-1',
      sourceFileId: 'F-1',
      pageIndex: 0,
      renderScale: 2,
      dpi: 144,
      widthPx: 1190,
      heightPx: 1684,
      sha256: 'a'.repeat(64),
    });
  });
  it('output is Object.frozen (runtime immutability)', () => {
    expect(Object.isFrozen(ok)).toBe(true);
  });
});

describe('freezeSheet: validation throws', () => {
  const base = {
    id: 'S-1',
    projectId: 'P-1',
    sourceFileId: 'F-1',
    pageIndex: 0,
    renderScale: 2,
    dpi: 144,
    widthPx: 1190,
    heightPx: 1684,
    sha256: 'a'.repeat(64),
  };
  it('empty id → throw', () => {
    expect(() => freezeSheet({ ...base, id: '' })).toThrow();
  });
  it('empty projectId → throw', () => {
    expect(() => freezeSheet({ ...base, projectId: '' })).toThrow();
  });
  it('negative pageIndex → throw', () => {
    expect(() => freezeSheet({ ...base, pageIndex: -1 })).toThrow();
  });
  it('non-integer pageIndex → throw', () => {
    expect(() => freezeSheet({ ...base, pageIndex: 1.5 })).toThrow();
  });
  it('renderScale <= 0 → throw', () => {
    expect(() => freezeSheet({ ...base, renderScale: 0 })).toThrow();
  });
  it('dpi <= 0 → throw', () => {
    expect(() => freezeSheet({ ...base, dpi: 0 })).toThrow();
  });
  it('zero widthPx → throw', () => {
    expect(() => freezeSheet({ ...base, widthPx: 0 })).toThrow();
  });
  it('negative heightPx → throw', () => {
    expect(() => freezeSheet({ ...base, heightPx: -1 })).toThrow();
  });
  it('non-integer dimension → throw', () => {
    expect(() => freezeSheet({ ...base, widthPx: 1190.5 })).toThrow();
  });
  it('widthPx > MAX_PIXELS_PER_SIDE → throw', () => {
    expect(() =>
      freezeSheet({ ...base, widthPx: MAX_PIXELS_PER_SIDE + 1 }),
    ).toThrow();
  });
  it('uppercase hex sha256 → throw (require lowercase)', () => {
    expect(() => freezeSheet({ ...base, sha256: 'A'.repeat(64) })).toThrow(
      /sha256/,
    );
  });
  it('short sha256 → throw', () => {
    expect(() => freezeSheet({ ...base, sha256: 'a'.repeat(63) })).toThrow(
      /sha256/,
    );
  });
  it('non-hex sha256 → throw', () => {
    expect(() => freezeSheet({ ...base, sha256: 'z'.repeat(64) })).toThrow(
      /sha256/,
    );
  });
});
