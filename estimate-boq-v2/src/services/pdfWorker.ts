/**
 * pdf.js worker — MIME-safe loader
 * -----------------------------------------------------------------------------
 * Shared hosting (nginx) เสิร์ฟ .mjs ด้วย Content-Type ผิด (octet-stream)
 * → browser ปฏิเสธ ES module worker → PDF render ไม่ได้
 *
 * แก้: fetch worker bytes (fetch ไม่สน Content-Type) แล้วห่อ Blob ตั้ง type
 * = text/javascript เอง → ใช้เป็น workerSrc (กลไก workerSrc เดิมทุกอย่าง
 * เปลี่ยนแค่ url ที่ชี้ จาก .mjs → blob)
 */
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let ready: Promise<void> | null = null;

/** ตั้ง workerSrc เป็น blob url (idempotent) — await ก่อน getDocument ครั้งแรก */
export function ensurePdfWorker(): Promise<void> {
  if (!ready) {
    ready = fetch(pdfWorkerUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`pdf worker fetch ล้มเหลว: ${res.status}`);
        return res.text();
      })
      .then((code) => {
        const blobUrl = URL.createObjectURL(
          new Blob([code], { type: 'text/javascript' }),
        );
        pdfjs.GlobalWorkerOptions.workerSrc = blobUrl;
      })
      .catch((err) => {
        ready = null; // ให้ retry ได้รอบหน้า
        throw err;
      });
  }
  return ready;
}
