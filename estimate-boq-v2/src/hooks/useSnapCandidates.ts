/**
 * รวบรวม segments + nodes ของ measurement ที่ confirmed สำหรับใช้ใน snap
 * memoize ตามชุด measurements ของหน้า active
 */
import { useMemo } from 'react';
import { useMeasurementsForPage } from '@/stores/measurementStore';
import type { SnapSegment } from '@/core/snap';
import type { Point2D } from '@/types/viewport';

export function useSnapCandidates(pageId: string | null): {
  segments: SnapSegment[];
  nodes: Point2D[];
} {
  const measurements = useMeasurementsForPage(pageId);

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

    return { segments, nodes };
  }, [measurements]);
}
