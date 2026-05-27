/**
 * Snap finder — รวมทุก mode (endpoint/midpoint/intersection/perpendicular/on-edge)
 * ทำงานใน canonical page-px space; image-snap (Sobel-like) แยกอยู่ใน imageEdges.ts
 */
import {
  distancePx,
  projectPointOnSegment,
  segmentIntersection,
  type Pt,
} from './geometry';

export type SnapType =
  | 'endpoint'
  | 'midpoint'
  | 'intersection'
  | 'perpendicular'
  | 'onEdge'
  | 'grid'
  | 'image';

export interface SnapPoint {
  x: number;
  y: number;
  type: SnapType;
}

export interface SnapToggles {
  endpoint: boolean;
  midpoint: boolean;
  intersection: boolean;
  perpendicular: boolean;
  onEdge: boolean;
  grid: boolean;
}

/** segment ของ measurement (ไม่รวม count/scale) — closed=true สำหรับ polygon */
export interface SnapSegment {
  a: Pt;
  b: Pt;
}

export interface SnapInput {
  /** จุดที่ cursor อยู่ (page-px) */
  cursor: Pt;
  /** รัศมีจับ snap (page-px) — caller ควรแปลงจาก screen px ก่อน */
  radius: number;
  /** ทุก segment ของ measurement ที่ confirmed (page-px) */
  segments: SnapSegment[];
  /** ทุก node (vertex) ของ measurement (page-px) */
  nodes: Pt[];
  /** จุดล่าสุดของ draft (ใช้สำหรับ perpendicular) */
  lastDraftPoint?: Pt | null;
  /** toggles แต่ละโหมด */
  toggles: SnapToggles;
  /** ระยะห่าง grid (page-px) — undefined/0 = ปิด grid snap */
  gridSpacing?: number;
  /** จุดอ้างอิงของ grid (page-px) — default (0,0) */
  gridOrigin?: Pt;
}

/** หา snap candidate ที่ใกล้สุด — null ถ้าไม่มี */
export function findSnap(input: SnapInput): SnapPoint | null {
  const { cursor, radius, segments, nodes, lastDraftPoint, toggles } = input;
  let best: { sp: SnapPoint; d: number } | null = null;

  const tryUpdate = (sp: SnapPoint, d: number) => {
    if (d > radius) return;
    if (!best || d < best.d) best = { sp, d };
  };

  // endpoint — node ของ measurements
  if (toggles.endpoint) {
    for (const n of nodes) {
      const d = distancePx(cursor, n);
      tryUpdate({ x: n.x, y: n.y, type: 'endpoint' }, d);
    }
  }

  // midpoint — กลาง segment
  if (toggles.midpoint) {
    for (const seg of segments) {
      const m = { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 };
      tryUpdate({ x: m.x, y: m.y, type: 'midpoint' }, distancePx(cursor, m));
    }
  }

  // intersection — ทุกคู่ segment
  if (toggles.intersection) {
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const ip = segmentIntersection(
          segments[i]!.a,
          segments[i]!.b,
          segments[j]!.a,
          segments[j]!.b,
        );
        if (ip) {
          tryUpdate({ ...ip, type: 'intersection' }, distancePx(cursor, ip));
        }
      }
    }
  }

  // perpendicular — projection ของ lastDraftPoint ลง segment (ถ้า project foot ใกล้ cursor)
  if (toggles.perpendicular && lastDraftPoint) {
    for (const seg of segments) {
      const proj = projectPointOnSegment(lastDraftPoint, seg.a, seg.b);
      // จุด proj ต้องอยู่ "ใน segment" และต้องอยู่ใกล้ cursor
      tryUpdate(
        { x: proj.point.x, y: proj.point.y, type: 'perpendicular' },
        distancePx(cursor, proj.point),
      );
    }
  }

  // on-edge — projection ของ cursor ลง segment (foot ที่ใกล้ cursor สุด)
  if (toggles.onEdge) {
    for (const seg of segments) {
      const proj = projectPointOnSegment(cursor, seg.a, seg.b);
      tryUpdate(
        { x: proj.point.x, y: proj.point.y, type: 'onEdge' },
        proj.distance,
      );
    }
  }

  // grid — priority ต่ำสุด: ใช้ก็ต่อเมื่อไม่เจอ vertex/edge snap อื่นเลย
  if (!best && toggles.grid && input.gridSpacing && input.gridSpacing > 0) {
    const s = input.gridSpacing;
    const ox = input.gridOrigin?.x ?? 0;
    const oy = input.gridOrigin?.y ?? 0;
    const gx = ox + Math.round((cursor.x - ox) / s) * s;
    const gy = oy + Math.round((cursor.y - oy) / s) * s;
    const gp = { x: gx, y: gy };
    tryUpdate({ x: gx, y: gy, type: 'grid' }, distancePx(cursor, gp));
  }

  return best ? (best as { sp: SnapPoint }).sp : null;
}
