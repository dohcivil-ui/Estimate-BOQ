/**
 * Ortho lock — snap ทิศทางเป็น multiples ของ 45°
 * จาก "from" ไป "to" → return จุดใหม่ที่อยู่บนทิศที่ใกล้สุดของ 0/45/90/135/180/...°
 * ระยะคงเดิม
 */
import type { Pt } from './geometry';

const STEP = Math.PI / 4; // 45°

export function applyOrthoLock(from: Pt, to: Pt): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: to.x, y: to.y };
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / STEP) * STEP;
  return {
    x: from.x + Math.cos(snapped) * len,
    y: from.y + Math.sin(snapped) * len,
  };
}

/** applyHVLock — ล็อกปลายเส้นเป็นแนวนอน/แนวตั้งล้วน (ฉาก) เทียบจุดเริ่ม
 *  ใช้กับเครื่องมือ grid: เลือกแกนที่ระยะมากกว่าเป็นตัวล็อก แล้ว "ยืดปลายตามเคอร์เซอร์"
 *  ต่างจาก applyOrthoLock (snap 45° + คงความยาว) — ตัวนี้ project ไป H หรือ V เท่านั้น */
export function applyHVLock(from: Pt, to: Pt): Pt {
  const dx = to.x - from.x; // ระยะแกน x จากจุดเริ่มถึงเคอร์เซอร์
  const dy = to.y - from.y; // ระยะแกน y จากจุดเริ่มถึงเคอร์เซอร์
  if (Math.abs(dx) >= Math.abs(dy)) {
    // x เด่น (หรือเท่ากัน) → ล็อกแนวนอน: คง y จุดเริ่ม, ยืด x ตามเคอร์เซอร์
    return { x: to.x, y: from.y };
  }
  // y เด่น → ล็อกแนวตั้ง: คง x จุดเริ่ม, ยืด y ตามเคอร์เซอร์
  return { x: from.x, y: to.y };
}
