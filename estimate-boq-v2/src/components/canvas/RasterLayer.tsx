/**
 * Raster background — รูปต้นฉบับ พร้อม rotation (visual-only)
 * วาดผ่าน Konva.Image ที่ scaled และหมุนรอบศูนย์
 */
import { Layer, Image as KonvaImage } from 'react-konva';
import type { DrawingPage } from '@/types/drawing';
import type { ViewTransform } from '@/types/viewport';

interface Props {
  page: DrawingPage;
  transform: ViewTransform;
  /** องศาหมุน (clockwise, degrees) — visual-only ไม่กระทบ canonical page coord */
  rotationDeg: number;
}

export function RasterLayer({ page, transform, rotationDeg }: Props) {
  if (!page.bitmap) return null;

  const cx = page.pageWidth / 2;
  const cy = page.pageHeight / 2;

  return (
    <Layer listening={false}>
      <KonvaImage
        image={page.bitmap}
        x={transform.panX + cx * transform.zoom}
        y={transform.panY + cy * transform.zoom}
        offsetX={cx}
        offsetY={cy}
        scaleX={transform.zoom}
        scaleY={transform.zoom}
        rotation={rotationDeg}
        perfectDrawEnabled={false}
        listening={false}
      />
    </Layer>
  );
}
