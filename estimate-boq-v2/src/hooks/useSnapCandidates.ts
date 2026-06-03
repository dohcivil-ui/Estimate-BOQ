/**
 * รวบรวม segments + nodes ของ measurement ที่ confirmed สำหรับใช้ใน snap
 * memoize ตามชุด measurements ของหน้า active
 */
import { useMemo } from 'react';
import { useMeasurementsForPage } from '@/stores/measurementStore';
import { useToolStore } from '@/stores/toolStore';
import type { SnapSegment } from '@/core/snap';
import type { Point2D } from '@/types/viewport';

export function useSnapCandidates(pageId: string | null): {
  segments: SnapSegment[];
  nodes: Point2D[];
} {
  const measurements = useMeasurementsForPage(pageId);
  // เส้น grid ที่วาดแล้ว (global, ไม่ผูก pageId) — feed เข้า snap เฉพาะตอนวาด grid
  const gridLines = useToolStore((s) => s.gridLines);
  // เครื่องมือปัจจุบัน — ใช้ gate ให้ feed เฉพาะตอน activeTool==='grid'
  const activeTool = useToolStore((s) => s.activeTool);

  return useMemo(() => {
    const segments: SnapSegment[] = [];
    const nodes: Point2D[] = [];

    for (const m of measurements) {
      if (m.type === 'count') {
        // count = node อย่างเดียว ไม่มี segment
        nodes.push(...m.points);
        continue;
      }
      nodes.push(...m.points);
      const pts = m.points;
      const isPolygon = m.type === 'area';
      const segCount = isPolygon ? pts.length : pts.length - 1;
      for (let i = 0; i < segCount; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % pts.length]!;
        segments.push({ a, b });
      }
    }

    // feed เส้น grid เข้า candidate เฉพาะตอนใช้เครื่องมือ grid (แยกจาก length/area/scale)
    if (activeTool === 'grid') {
      for (const ln of gridLines) {
        // ทุกเส้น grid
        segments.push({ a: ln.a, b: ln.b }); // ตัวเส้น → snap "ตามแนว" (project)
        nodes.push(ln.a, ln.b); // ปลายเส้น 2 จุด → snap เข้ามุม
      }
    }

    return { segments, nodes };
  }, [measurements, gridLines, activeTool]);
}
