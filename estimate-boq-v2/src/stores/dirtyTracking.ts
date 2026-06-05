/**
 * ติด subscribe ทุก domain store เพื่อ mark dirty ใน currentProject
 * เรียกครั้งเดียวใน main.tsx
 *
 * loadProject() จะ setLastSavedAt() ที่จะ reset dirty=false ตอนจบ —
 * ดังนั้น subscriptions ที่ยิงระหว่าง load จะถูกลบไปด้วย (ไม่กระทบ)
 */
import { useCurrentProject } from './currentProjectStore';
import { setLastProjectId, clearLastProjectId } from '@/services/lastProject';
import { useMeasurementStore } from './measurementStore';
import { useBOQStore } from './boqStore';
import { useScaleStore } from './scaleStore';
import { useRotationStore } from './rotationStore';
import { useProjectMeta } from './projectMetaStore';
import { useDrawingStore } from './drawingStore';

let initialized = false;

export function initDirtyTracking(): void {
  if (initialized) return;
  initialized = true;

  const mark = (): void => {
    const cp = useCurrentProject.getState();
    if (!cp.dirty) cp.setDirty(true);
  };

  // ─── domain stores ───────────────────────────────────────────────────
  useMeasurementStore.subscribe((s, prev) => {
    if (s.measurements !== prev.measurements) mark();
  });
  useBOQStore.subscribe((s, prev) => {
    if (s.items !== prev.items) mark();
  });
  useScaleStore.subscribe((s, prev) => {
    if (s.byPageId !== prev.byPageId) mark();
  });
  useRotationStore.subscribe((s, prev) => {
    if (s.byPageId !== prev.byPageId) mark();
  });
  useProjectMeta.subscribe((s, prev) => {
    if (
      s.name !== prev.name ||
      s.client !== prev.client ||
      s.location !== prev.location ||
      s.province !== prev.province ||
      s.factorF !== prev.factorF ||
      s.vatPct !== prev.vatPct ||
      s.advancePct !== prev.advancePct ||
      s.retentionPct !== prev.retentionPct
    ) {
      mark();
    }
  });
  useDrawingStore.subscribe((s, prev) => {
    if (s.files !== prev.files || s.pages !== prev.pages) mark();
  });

  // mirror projectId -> LS (inc5/R1-C6) — ที่เดียว ครอบ save/load/reset อัตโนมัติ
  useCurrentProject.subscribe((s, prev) => {
    if (s.projectId === prev.projectId) return; // ยิงเฉพาะตอน id เปลี่ยน
    if (s.projectId) setLastProjectId(s.projectId);
    else clearLastProjectId();
  });
}
