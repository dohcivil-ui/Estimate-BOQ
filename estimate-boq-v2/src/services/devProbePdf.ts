/**
 * devProbePdf — DEV ชั่วคราว: เช็ก PDF เป็น vector หรือ raster
 * --------------------------------------------------------------------------
 * โหลดหน้า PDF → getOperatorList() → นับ path ops vs image ops
 *   path  = constructPath / moveTo / lineTo / rectangle / curveTo
 *   image = paintImageXObject / paintInlineImageXObject
 * ตีความ:
 *   paths เยอะ + image น้อย  → VECTOR (click-snap เป๊ะได้)
 *   image 1–2 คลุมทั้งหน้า + paths ~0 → RASTER/scan (ต้องใช้ CV)
 *
 * ⚠️ util ชั่วคราว — ลบทิ้งได้หลังตัดสินวิธี snap
 */
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfProbePage {
  page: number;
  width: number;
  height: number;
  paths: number;
  images: number;
  verdict: 'VECTOR' | 'RASTER' | 'MIXED/?';
}

const OPS = pdfjs.OPS;
const PATH_OPS = new Set<number>([
  OPS.constructPath,
  OPS.moveTo,
  OPS.lineTo,
  OPS.rectangle,
  OPS.curveTo,
  OPS.curveTo2,
  OPS.curveTo3,
]);
const IMAGE_OPS = new Set<number>([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageMaskXObject,
]);

function verdictFor(paths: number, images: number): PdfProbePage['verdict'] {
  if (paths >= 100 && images <= 3) return 'VECTOR';
  if (images >= 1 && images <= 3 && paths < 20) return 'RASTER';
  return 'MIXED/?';
}

/** probe ทุกหน้าของไฟล์ PDF + console.log สรุป */
export async function probePdfVectorRaster(file: File): Promise<PdfProbePage[]> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out: PdfProbePage[] = [];

  console.info(`[pdf-probe] 📄 ${file.name} — ${doc.numPages} หน้า`);

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const opList = await page.getOperatorList();

    let paths = 0;
    let images = 0;
    for (const fn of opList.fnArray) {
      if (PATH_OPS.has(fn)) paths += 1;
      else if (IMAGE_OPS.has(fn)) images += 1;
    }

    const w = Math.round(vp.width);
    const h = Math.round(vp.height);
    const verdict = verdictFor(paths, images);
    out.push({ page: n, width: w, height: h, paths, images, verdict });

    console.info(
      `[pdf-probe] p${n}: paths=${paths} images=${images} ${w}x${h} → ${verdict}`,
    );
    page.cleanup();
  }

  return out;
}
