// src/core/__fixtures__/validation/raster-test-utils.ts
// ===========================================================================
// Test-only utilities สำหรับ raster fixtures — ใช้ node:fs / node:crypto
// **ห้าม import จาก src/<app code>** — ไฟล์นี้ถูก exclude จาก app tsconfig
// (อยู่ใต้ __fixtures__ + node types เปิดเฉพาะใน tsconfig.test.json)
// ===========================================================================
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RasterMeasuredCase } from './raster-types';

const FIXTURE_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * อ่าน PNG จากดิสก์ + คำนวณ sha256 (hex lowercase)
 * คืน null ถ้าไฟล์ไม่อยู่ — caller ตัดสินใจว่าจะ throw หรือ skip test
 */
export function readImageSha256(imageFileRelative: string): string | null {
  const p = resolve(FIXTURE_DIR, 'raster', imageFileRelative);
  try {
    const buf = readFileSync(p);
    return createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

/**
 * ตรวจว่า PNG ที่ commit ตรงกับ sha256 ที่ fixture จดไว้
 * ใช้ก่อนรัน assertion จริง — กัน PNG ถูกแก้แล้ว px ที่จดไว้เลื่อนตามไม่ทัน
 *
 * - imageSha256 ใน fixture = null → throw "fill sha256 first"
 * - PNG ไม่อยู่บนดิสก์ → throw "image missing"
 * - sha256 ไม่ตรง → throw "image edited?" (fail loud)
 */
export function verifyRasterCase(c: RasterMeasuredCase): void {
  if (c.imageSha256 == null) {
    throw new Error(
      `[${c.sourceSheet}] imageSha256 = null — ต้อง rasterize PDF → PNG แล้วเติม sha256 ลง fixture ` +
        '(ดู src/core/__fixtures__/validation/raster/README.md)',
    );
  }
  const actual = readImageSha256(c.imageFile);
  if (actual == null) {
    throw new Error(
      `[${c.sourceSheet}] image ${c.imageFile} ไม่อยู่บนดิสก์ — rasterize PDF แล้ววางใน raster/ ก่อน`,
    );
  }
  if (actual !== c.imageSha256) {
    throw new Error(
      `[${c.sourceSheet}] sha256 mismatch — image ถูกแก้?\n` +
        `  expected: ${c.imageSha256}\n  actual:   ${actual}`,
    );
  }
}
