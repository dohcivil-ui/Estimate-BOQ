/** transform หน่วยเดียวที่ใช้แปลง page <-> screen */
export interface ViewTransform {
  /** scale factor: screen = page * zoom + pan */
  zoom: number;
  /** pan ในหน่วย screen pixel */
  panX: number;
  panY: number;
  /** สำหรับ Step 2.3 ขึ้นไป (auto-deskew); ตอนนี้ default 0 */
  rotationDeg: number;
}

export interface Point2D {
  x: number;
  y: number;
}
