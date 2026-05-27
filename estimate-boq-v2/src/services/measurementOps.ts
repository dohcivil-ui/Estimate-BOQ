/**
 * Operation: commit draft → measurement
 * ทำงานบนข้อมูลที่ store เก็บอยู่ — เรียกจาก mouse/keyboard handlers
 */
import {
  formatArea,
  formatLength,
  type ScaleProfile,
} from '@/core/scale';
import {
  lineQuantity,
  polygonPerimeter,
  polygonQuantity,
} from '@/core/formula';
import type {
  AreaMeasurement,
  CountMeasurement,
  LengthMeasurement,
  Measurement,
} from '@/types/measurement';
import type { Point2D } from '@/types/viewport';
import type { Tool } from '@/types/tool';
import { useMeasurementStore } from '@/stores/measurementStore';
import { useToolStore } from '@/stores/toolStore';

const now = (): string => new Date().toISOString();
const uid = (): string => crypto.randomUUID();

/**
 * คำนวณค่าวัดทั้งหน้าใหม่ตาม scale profile ใหม่ (เรียกหลังตั้ง/แก้สเกล)
 * - length → lengthM + label
 * - area   → areaM2 + perimeterM + label
 * - count/scale → คงเดิม
 * history push ครั้งเดียว (ผ่าน mutatePage)
 */
export function recalcMeasurementsForPage(
  pageId: string,
  profile: ScaleProfile,
): void {
  const upp = profile.unitPerPixel;
  useMeasurementStore.getState().mutatePage(pageId, (m) => {
    if (m.type === 'length') {
      const lengthM = lineQuantity(m.points, upp);
      return { ...m, lengthM, label: formatLength(lengthM), updatedAt: now() };
    }
    if (m.type === 'area') {
      const areaM2 = polygonQuantity(m.points, upp);
      const perimeterM = polygonPerimeter(m.points, upp);
      return {
        ...m,
        areaM2,
        perimeterM,
        label: formatArea(areaM2),
        updatedAt: now(),
      };
    }
    return m;
  });
}

/**
 * Commit draftPoints → confirmed measurement
 * คืน true ถ้า commit สำเร็จ (= มีจุดพอ)
 */
export function commitDraft(
  tool: Tool,
  pageId: string,
  draftPoints: Point2D[],
  scaleProfile: ScaleProfile | null,
): boolean {
  if (draftPoints.length === 0) return false;

  // ─── length / area ต้องมี scale ─────────────────────────────────────
  if (
    (tool === 'length' || tool === 'area') &&
    !scaleProfile
  ) {
    return false;
  }

  if (tool === 'length' && draftPoints.length >= 2) {
    const upp = scaleProfile!.unitPerPixel;
    const lengthM = lineQuantity(draftPoints, upp);
    const m: LengthMeasurement = {
      id: uid(),
      pageId,
      type: 'length',
      status: 'confirmed',
      layer: 'ทั่วไป',
      label: formatLength(lengthM),
      lengthM,
      points: draftPoints.slice(),
      createdAt: now(),
      updatedAt: now(),
    };
    useMeasurementStore.getState().add(m);
    useToolStore.getState().clearDraft();
    return true;
  }

  if (tool === 'area' && draftPoints.length >= 3) {
    const upp = scaleProfile!.unitPerPixel;
    const areaM2 = polygonQuantity(draftPoints, upp);
    const perimeterM = polygonPerimeter(draftPoints, upp);
    const m: AreaMeasurement = {
      id: uid(),
      pageId,
      type: 'area',
      status: 'confirmed',
      layer: 'ทั่วไป',
      label: formatArea(areaM2),
      areaM2,
      perimeterM,
      points: draftPoints.slice(),
      createdAt: now(),
      updatedAt: now(),
    };
    useMeasurementStore.getState().add(m);
    useToolStore.getState().clearDraft();
    return true;
  }

  if (tool === 'count' && draftPoints.length >= 1) {
    const m: CountMeasurement = {
      id: uid(),
      pageId,
      type: 'count',
      status: 'confirmed',
      layer: 'ทั่วไป',
      label: `${draftPoints.length} จุด`,
      count: draftPoints.length,
      points: draftPoints.slice(),
      createdAt: now(),
      updatedAt: now(),
    };
    useMeasurementStore.getState().add(m);
    useToolStore.getState().clearDraft();
    return true;
  }

  // scale: ไม่ commit ที่นี่ — ต้องเปิด ScaleDialog ก่อน
  return false;
}

/** หา measurement ที่ใกล้ click ที่สุด (ไว้ใช้ตอน select tool) */
export function findMeasurementAt(
  measurements: Measurement[],
  pagePoint: Point2D,
  nodeRadiusPx: number,
  segmentTolerancePx: number,
): { measurement: Measurement; kind: 'node' | 'segment' | 'inside'; index: number } | null {
  // priority: node > segment > polygon-inside
  for (const m of measurements) {
    for (let i = 0; i < m.points.length; i++) {
      const p = m.points[i]!;
      const d = Math.hypot(p.x - pagePoint.x, p.y - pagePoint.y);
      if (d <= nodeRadiusPx) {
        return { measurement: m, kind: 'node', index: i };
      }
    }
  }
  // segments
  for (const m of measurements) {
    if (m.type === 'count' || m.points.length < 2) continue;
    const closed = m.type === 'area';
    const last = closed ? m.points.length : m.points.length - 1;
    for (let i = 0; i < last; i++) {
      const a = m.points[i]!;
      const b = m.points[(i + 1) % m.points.length]!;
      const d = pointToSegmentDist(pagePoint, a, b);
      if (d <= segmentTolerancePx) {
        return { measurement: m, kind: 'segment', index: i };
      }
    }
  }
  return null;
}

function pointToSegmentDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const fx = a.x + t * dx;
  const fy = a.y + t * dy;
  return Math.hypot(p.x - fx, p.y - fy);
}
