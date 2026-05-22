// src/services/persistence.ts — Offline persistence ผ่าน IndexedDB (Golden Rule #6)
// + JSON export/import + Excel export (spec §17)
//
// บันทึก: project, drawing pages (bitmap = Blob), scales, measurements (geometry page-px),
//         BOQ items, links — ทุกอย่างเก็บใน-browser ไม่มี network
import { openDB, type IDBPDatabase } from 'idb';
import type { DrawingFile, DrawingPage, Measurement } from '../types';
import { useDrawingStore } from '../stores/drawingStore';
import { useMeasurementStore, PROJECT_ID } from '../stores/measurementStore';
import { useScaleStore } from '../stores/scaleStore';
import { useBOQStore, type BOQItemStored, type BOQLinkStored } from '../stores/boqStore';

const DB_NAME = 'estimate_boq';
const DB_VERSION = 1;

type ProjectSnapshot = {
  schemaVersion: 1;
  projectId: string;
  savedAt: string;
  files: DrawingFile[];
  pages: Array<{
    id: string;
    fileId: string;
    pageNumber: number;
    pageWidth: number;
    pageHeight: number;
    renderScale: number;
    thumbnailDataUrl: string | null;
    /** bitmap เก็บเป็น Blob (PNG) แยกใน object store 'bitmaps' */
  }>;
  scales: Record<string, ReturnType<typeof useScaleStore.getState>['byPageId'][string]>;
  measurements: Measurement[];
  /** measurement ordering per page */
  measurementOrder: Record<string, string[]>;
  boqItems: Record<string, BOQItemStored>;
  boqItemOrder: string[];
  boqLinks: BOQLinkStored[];
};

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots'); // key = projectId
      }
      if (!db.objectStoreNames.contains('bitmaps')) {
        db.createObjectStore('bitmaps'); // key = pageId, value = Blob
      }
    },
  });
}

/** แปลง HTMLCanvasElement → Blob (PNG) แบบ async */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('canvas.toBlob failed'));
    }, 'image/png');
  });
}

/** แปลง Blob → HTMLCanvasElement (decode ผ่าน Image element) */
async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image decode failed'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** สร้าง snapshot จาก stores ปัจจุบัน — ไม่รวม bitmap (เก็บแยก) */
function buildSnapshot(): ProjectSnapshot {
  const d = useDrawingStore.getState();
  const m = useMeasurementStore.getState();
  const s = useScaleStore.getState();
  const b = useBOQStore.getState();
  return {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    savedAt: new Date().toISOString(),
    files: d.files,
    pages: d.pages.map((p) => ({
      id: p.id,
      fileId: p.fileId,
      pageNumber: p.pageNumber,
      pageWidth: p.pageWidth,
      pageHeight: p.pageHeight,
      renderScale: p.renderScale,
      thumbnailDataUrl: p.thumbnailDataUrl,
    })),
    scales: s.byPageId,
    measurements: Object.values(m.byId),
    measurementOrder: m.byPageId,
    boqItems: b.items,
    boqItemOrder: b.itemOrder,
    boqLinks: b.links,
  };
}

/** บันทึก project ทั้งหมดลง IndexedDB */
export async function saveProject(): Promise<void> {
  const db = await getDB();
  const snap = buildSnapshot();

  // บันทึก snapshot
  await db.put('snapshots', snap, snap.projectId);

  // บันทึก bitmap แต่ละหน้า (HTMLCanvasElement → PNG Blob)
  const tx = db.transaction('bitmaps', 'readwrite');
  const pages = useDrawingStore.getState().pages;
  for (const page of pages) {
    if (!page.bitmap) continue;
    const blob = await canvasToBlob(page.bitmap);
    await tx.store.put(blob, page.id);
  }
  await tx.done;
  db.close();
}

/** โหลด project ล่าสุดจาก IndexedDB */
export async function loadProject(): Promise<boolean> {
  const db = await getDB();
  const snap: ProjectSnapshot | undefined = await db.get('snapshots', PROJECT_ID);
  if (!snap) {
    db.close();
    return false;
  }

  // โหลด bitmap + assert ขนาดต้องตรง pageWidth/pageHeight (E2: ห้าม silently misalign)
  const restoredPages: DrawingPage[] = [];
  for (const pMeta of snap.pages) {
    const blob: Blob | undefined = await db.get('bitmaps', pMeta.id);
    let bitmap: HTMLCanvasElement | null = null;
    if (blob) {
      const canvas = await blobToCanvas(blob);
      if (canvas.width !== pMeta.pageWidth || canvas.height !== pMeta.pageHeight) {
        // ขนาด bitmap ไม่ตรง canonical → fail ดังๆ (กัน geometry เพี้ยน)
        throw new Error(
          `bitmap size mismatch on page ${pMeta.id}: ` +
            `expected ${pMeta.pageWidth}×${pMeta.pageHeight}, ` +
            `got ${canvas.width}×${canvas.height}`,
        );
      }
      bitmap = canvas;
    }
    restoredPages.push({
      id: pMeta.id,
      fileId: pMeta.fileId,
      pageNumber: pMeta.pageNumber,
      pageWidth: pMeta.pageWidth,
      pageHeight: pMeta.pageHeight,
      renderScale: pMeta.renderScale,
      bitmap,
      thumbnailDataUrl: pMeta.thumbnailDataUrl,
      measurementCount: snap.measurementOrder[pMeta.id]?.length ?? 0,
    });
  }
  db.close();

  // ฉีดเข้า stores
  useDrawingStore.setState({
    files: snap.files,
    pages: restoredPages,
    activePageId: restoredPages[0]?.id ?? null,
  });

  useScaleStore.setState({
    byPageId: snap.scales,
    draft: { phase: 'idle' },
  });

  // measurementStore: rebuild byId + byPageId; เคลียร์ history (state จาก disk เป็น baseline)
  const byId: Record<string, Measurement> = {};
  for (const m of snap.measurements) byId[m.id] = m;
  useMeasurementStore.setState({
    byId,
    byPageId: snap.measurementOrder,
    selectedIds: [],
    past: [],
    future: [],
  });

  useBOQStore.getState().loadFromSnapshot({
    items: snap.boqItems,
    itemOrder: snap.boqItemOrder,
    links: snap.boqLinks,
  });

  return true;
}

/** auto-load ตอน app start — silent fail (เป็น optional) */
export async function autoLoadProject(): Promise<void> {
  try {
    await loadProject();
  } catch (err) {
    console.warn('auto-load skipped:', err);
  }
}

/** ลบ project ออกจาก IndexedDB */
export async function clearProject(): Promise<void> {
  const db = await getDB();
  await db.delete('snapshots', PROJECT_ID);
  // ลบทุก bitmap
  const tx = db.transaction('bitmaps', 'readwrite');
  const keys = await tx.store.getAllKeys();
  for (const k of keys) await tx.store.delete(k);
  await tx.done;
  db.close();
}

/** Export JSON ของ project (รวมทุกอย่าง พอ reconstruct ได้) */
export function exportProjectJSON(): string {
  // bitmap ไม่รวมใน JSON (binary blob); JSON เก็บเฉพาะ geometry + scale + BOQ
  // ที่พอ reconstruct ได้ถ้า user import แบบเดียวกันใหม่ (ดู note ใน E2)
  const snap = buildSnapshot();
  return JSON.stringify(snap, null, 2);
}

/** download JSON เป็นไฟล์ */
export function downloadProjectJSON(filename = 'project.json'): void {
  const json = exportProjectJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
