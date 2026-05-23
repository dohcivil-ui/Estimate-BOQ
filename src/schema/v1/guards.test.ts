// src/schema/v1/guards.test.ts — invariants ตามสเปก data-safety v1
import { describe, it, expect } from 'vitest';
import {
  assertSheetMatchesRaster,
  assertMeasurementIntegrity,
  assertLineInvariant,
  isCalibrationVerified,
} from './guards';
import { SCHEMA_VERSION } from './types';
import type {
  Sheet,
  Calibration,
  Measurement,
  Line,
  Envelope,
} from './types';

// --- fixtures -----------------------------------------------------------------
const sheetA: Sheet = {
  id: 'S-A',
  projectId: 'P-1',
  sourceFileId: 'F-1',
  pageIndex: 0,
  renderScale: 2,
  widthPx: 1000,
  heightPx: 700,
  dpi: 144,
  sha256: 'a'.repeat(64),
};
const sheetB: Sheet = { ...sheetA, id: 'S-B', sha256: 'b'.repeat(64) };

// fixtures default = unverified (anisotropy: null) — verifyScale ยังไม่ได้รัน
// ใน tests ที่ทดสอบ "verified-perfect" จะ override เป็น 0 explicit
const calibOnA: Calibration = {
  id: 'C-A',
  sheetId: 'S-A',
  upp: 0.01,
  sourceDim: { label: 'doorway', realM: 1 },
  anisotropy: null,
  ts: '2026-05-23T00:00:00Z',
};
const calibOnB: Calibration = { ...calibOnA, id: 'C-B', sheetId: 'S-B' };

const sheetById = new Map<string, Sheet>([
  [sheetA.id, sheetA],
  [sheetB.id, sheetB],
]);
const calibById = new Map<string, Calibration>([
  [calibOnA.id, calibOnA],
  [calibOnB.id, calibOnB],
]);

// --- Sheet load: canonical px + sha256 frozen ---------------------------------
describe('schema v1: Sheet load — canonical px + sha256 frozen', () => {
  it('width+height+sha256 match → no throw', () => {
    expect(() =>
      assertSheetMatchesRaster(sheetA, {
        widthPx: 1000,
        heightPx: 700,
        sha256: sheetA.sha256,
      }),
    ).not.toThrow();
  });
  it('width mismatch → throw', () => {
    expect(() =>
      assertSheetMatchesRaster(sheetA, {
        widthPx: 999,
        heightPx: 700,
        sha256: sheetA.sha256,
      }),
    ).toThrow(/raster mismatch — dimensions/);
  });
  it('height mismatch → throw', () => {
    expect(() =>
      assertSheetMatchesRaster(sheetA, {
        widthPx: 1000,
        heightPx: 800,
        sha256: sheetA.sha256,
      }),
    ).toThrow(/raster mismatch — dimensions/);
  });
  it('sha256 mismatch → throw (กันสลับ raster ขนาดเหมือนกัน)', () => {
    expect(() =>
      assertSheetMatchesRaster(sheetA, {
        widthPx: 1000,
        heightPx: 700,
        sha256: 'c'.repeat(64),
      }),
    ).toThrow(/raster mismatch — sha256/);
  });
  it('dimensions + sha256 ทั้งคู่ผิด → throw (รวมใน message เดียว)', () => {
    expect(() =>
      assertSheetMatchesRaster(sheetA, {
        widthPx: 999,
        heightPx: 700,
        sha256: 'c'.repeat(64),
      }),
    ).toThrow(/dimensions.*sha256/s);
  });
});

// --- Measurement ↔ Calibration integrity --------------------------------------
describe('schema v1: Measurement ↔ Calibration integrity', () => {
  it('measurement on S-A using calib on S-A → ok', () => {
    const m: Measurement = {
      id: 'M-1',
      sheetId: 'S-A',
      calibrationId: 'C-A',
      kind: 'length',
      pointsPx: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    };
    expect(() =>
      assertMeasurementIntegrity(m, sheetById, calibById),
    ).not.toThrow();
  });

  it('measurement on S-A using calib on S-B → throw (upp ข้ามแผ่นไม่ได้)', () => {
    const m: Measurement = {
      id: 'M-2',
      sheetId: 'S-A',
      calibrationId: 'C-B',
      kind: 'length',
      pointsPx: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    };
    expect(() => assertMeasurementIntegrity(m, sheetById, calibById)).toThrow(
      /upp cannot cross sheets/,
    );
  });

});

// --- Dangling-ref guards (must throw, not silent) -----------------------------
describe('schema v1: dangling references — assertMeasurementIntegrity throws', () => {
  it('dangling sheetId (lookup ไม่มี) → throw', () => {
    const m: Measurement = {
      id: 'M-dangle-sheet',
      sheetId: 'S-MISSING',
      calibrationId: 'C-A',
      kind: 'length',
      pointsPx: [],
    };
    expect(() => assertMeasurementIntegrity(m, sheetById, calibById)).toThrow(
      /sheetId .* not found/,
    );
  });

  it('dangling calibrationId (lookup ไม่มี) → throw', () => {
    const m: Measurement = {
      id: 'M-dangle-calib',
      sheetId: 'S-A',
      calibrationId: 'C-MISSING',
      kind: 'length',
      pointsPx: [],
    };
    expect(() => assertMeasurementIntegrity(m, sheetById, calibById)).toThrow(
      /calibrationId .* not found/,
    );
  });

  it('empty sheetById map → throw on sheetId first (สเปก: sheet existence ก่อน)', () => {
    const empty = new Map<string, Sheet>();
    const m: Measurement = {
      id: 'M-empty-sheets',
      sheetId: 'S-A',
      calibrationId: 'C-A',
      kind: 'length',
      pointsPx: [],
    };
    expect(() => assertMeasurementIntegrity(m, empty, calibById)).toThrow(
      /sheetId .* not found/,
    );
  });

  it('empty calibrationById map → throw on calibrationId', () => {
    const empty = new Map<string, Calibration>();
    const m: Measurement = {
      id: 'M-empty-calibs',
      sheetId: 'S-A',
      calibrationId: 'C-A',
      kind: 'length',
      pointsPx: [],
    };
    expect(() => assertMeasurementIntegrity(m, sheetById, empty)).toThrow(
      /calibrationId .* not found/,
    );
  });

  it('both maps empty → sheetId reported first (fail-fast at first missing ref)', () => {
    const m: Measurement = {
      id: 'M-empty-both',
      sheetId: 'S-A',
      calibrationId: 'C-A',
      kind: 'length',
      pointsPx: [],
    };
    expect(() =>
      assertMeasurementIntegrity(m, new Map(), new Map()),
    ).toThrow(/sheetId .* not found/);
  });
});

// --- isCalibrationVerified — null vs 0 distinction ----------------------------
describe('schema v1: isCalibrationVerified', () => {
  it('anisotropy=null → false (ยังไม่ verify)', () => {
    const c: Calibration = { ...calibOnA, anisotropy: null };
    expect(isCalibrationVerified(c)).toBe(false);
  });
  it('anisotropy=0 → true (verify แล้ว, isotropic perfect — ต่างจาก null!)', () => {
    const c: Calibration = { ...calibOnA, anisotropy: 0 };
    expect(isCalibrationVerified(c)).toBe(true);
  });
  it('anisotropy=0.005 → true (verify แล้ว, deviation < 1% threshold)', () => {
    const c: Calibration = { ...calibOnA, anisotropy: 0.005 };
    expect(isCalibrationVerified(c)).toBe(true);
  });
  it('fixtures default (calibOnA) = unverified', () => {
    expect(isCalibrationVerified(calibOnA)).toBe(false);
  });
});

// --- TODO(gate-layer): assertMeasurementIntegrity ห้าม throw บน unverified calib
//     เป็น warning ของ gate layer (data-safety v2+). ตรวจที่ schema layer = block UX flow.
describe('schema v1: assertMeasurementIntegrity — unverified calibration is NOT a schema-layer error', () => {
  it('measurement ใช้ calib ที่ anisotropy=null → ผ่าน (gate layer จะ warn เอง)', () => {
    const m: Measurement = {
      id: 'M-unverified-calib',
      sheetId: 'S-A',
      calibrationId: 'C-A', // calibOnA.anisotropy = null
      kind: 'length',
      pointsPx: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    };
    expect(() =>
      assertMeasurementIntegrity(m, sheetById, calibById),
    ).not.toThrow();
  });
});

// --- Line: manual ⇒ excludedFromGate ------------------------------------------
describe('schema v1: Line — manual ⇒ excludedFromGate', () => {
  it('derived + included → ok', () => {
    const l: Line = { id: 'L-1', origin: 'derived', excludedFromGate: false };
    expect(() => assertLineInvariant(l)).not.toThrow();
  });
  it('derived + excluded → ok (อนุญาต — ไม่บังคับ)', () => {
    const l: Line = { id: 'L-2', origin: 'derived', excludedFromGate: true };
    expect(() => assertLineInvariant(l)).not.toThrow();
  });
  it('manual + excludedFromGate=true → ok', () => {
    const l: Line = { id: 'L-3', origin: 'manual', excludedFromGate: true };
    expect(() => assertLineInvariant(l)).not.toThrow();
  });
  it('manual + excludedFromGate=false → throw', () => {
    const l: Line = { id: 'L-4', origin: 'manual', excludedFromGate: false };
    expect(() => assertLineInvariant(l)).toThrow(
      /must have excludedFromGate=true/,
    );
  });
});

// --- Envelope: projectId + schemaVersion --------------------------------------
describe('schema v1: Envelope shape', () => {
  it('envelope has projectId + schemaVersion + entity arrays', () => {
    const env: Envelope = {
      projectId: 'P-1',
      schemaVersion: SCHEMA_VERSION,
      sheets: [sheetA, sheetB],
      calibrations: [calibOnA, calibOnB],
      measurements: [],
      overrides: [],
      lines: [],
    };
    expect(env.projectId).toBe('P-1');
    expect(env.schemaVersion).toBe(1);
    expect(env.sheets).toHaveLength(2);
    expect(env.calibrations).toHaveLength(2);
  });
  it('SCHEMA_VERSION literal is 1', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
