// src/services/measurementOps.ts — operations ที่ครอบ measurement + boq link cascade
// (เพื่อไม่ให้ measurementStore ↔ boqStore import วน — handle ที่ชั้น service)
import { useMeasurementStore } from '../stores/measurementStore';
import { useBOQStore } from '../stores/boqStore';

/**
 * ลบ measurement พร้อมเตือนผลกระทบ BOQ (spec §16.1)
 * คืน true ถ้าลบสำเร็จ, false ถ้าผู้ใช้ยกเลิก
 */
export function deleteMeasurementWithCascade(id: string): boolean {
  const boqState = useBOQStore.getState();
  const links = boqState.linksForMeasurement(id);
  if (links.length > 0) {
    const itemNames = links
      .map((l) => {
        const it = boqState.items[l.boqItemId];
        return it ? `${it.code}` : '?';
      })
      .filter(Boolean)
      .join(', ');
    const ok = window.confirm(
      `measurement นี้ผูกกับ BOQ ${links.length} รายการ (${itemNames})\n` +
        `ปริมาณ BOQ จะลดลงเมื่อลบ measurement\n\nยืนยันลบ?`,
    );
    if (!ok) return false;
    boqState.unlinkAllForMeasurement(id);
  }
  useMeasurementStore.getState().deleteMeasurement(id);
  return true;
}

/** ลบทุก measurement ที่ถูก select (ใช้ตอนกด Delete จาก keyboard) — warning รวมครั้งเดียว */
export function deleteSelectedWithCascade(): boolean {
  const ms = useMeasurementStore.getState();
  const selected = ms.selectedIds.slice();
  if (selected.length === 0) return false;
  const boqState = useBOQStore.getState();
  const affectedItems = new Set<string>();
  for (const mid of selected) {
    for (const l of boqState.linksForMeasurement(mid)) affectedItems.add(l.boqItemId);
  }
  if (affectedItems.size > 0) {
    const names = Array.from(affectedItems)
      .map((bid) => boqState.items[bid]?.code)
      .filter(Boolean)
      .join(', ');
    const ok = window.confirm(
      `เลือก ${selected.length} measurement ที่ผูกกับ BOQ ${affectedItems.size} รายการ (${names})\n\nยืนยันลบทั้งหมด?`,
    );
    if (!ok) return false;
  }
  for (const mid of selected) boqState.unlinkAllForMeasurement(mid);
  ms.deleteSelected();
  return true;
}
