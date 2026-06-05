// เก็บ id โปรเจกต์ล่าสุดใน localStorage — รอด reload (inc5/R1-C6)
// ใช้ร่วม: 6a เขียน (subscribe ใน dirtyTracking) · 6b อ่าน (boot restore)
const KEY = 'boq:last_project_id'; // ตาม convention boq:... เดิม

/** อ่าน id ล่าสุด (ไม่มี/อ่านพลาด/ว่าง → null) */
export function getLastProjectId(): string | null {
  try {
    const v = localStorage.getItem(KEY); // อาจ throw ใน private mode
    return v && v.length > 0 ? v : null; // กัน id ว่าง/เพี้ยน
  } catch {
    return null; // LS ปิด → ถือว่าไม่มี
  }
}

/** บันทึก id ล่าสุด (เขียนไม่ได้ → ข้ามเงียบ ไม่ให้ล้ม) */
export function setLastProjectId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

/** ล้าง id (ตอน reset / โปรเจกต์ถูกลบ) */
export function clearLastProjectId(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
