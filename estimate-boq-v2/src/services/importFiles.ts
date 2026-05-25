/**
 * Helper เรียกใช้ได้จากทุกที่ (button, drag-drop, paste)
 * เพื่อโหลดไฟล์เข้า drawingStore พร้อม progress feedback
 * + เก็บ Blob ดิบใน rawFileStore (สำหรับ upload ตอน save project)
 */
import {
  loadDrawingFile,
  UnsupportedFormatError,
  type ImportProgress,
} from './loadDrawing';
import { useDrawingStore } from '@/stores/drawingStore';
import { useRawFileStore } from '@/stores/rawFileStore';
import { useCurrentProject } from '@/stores/currentProjectStore';

export async function importFilesIntoStore(files: File[]): Promise<void> {
  const store = useDrawingStore.getState();
  store.setImporting(true);
  store.setImportError(null);
  store.setImportProgress(null);

  const onProgress = (p: ImportProgress) => {
    useDrawingStore.getState().setImportProgress(p);
  };

  const errors: string[] = [];
  try {
    for (const file of files) {
      try {
        const result = await loadDrawingFile(file, onProgress);
        useDrawingStore.getState().addImport(result);
        // เก็บ Blob ดิบไว้ใช้ตอน save ขึ้น Storage
        useRawFileStore.getState().setBlob(result.file.id, file);
        useCurrentProject.getState().setDirty(true);
      } catch (err) {
        if (err instanceof UnsupportedFormatError) {
          errors.push(`${file.name}: ${err.message}`);
        } else {
          errors.push(
            `${file.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  } finally {
    store.setImporting(false);
    store.setImportProgress(null);
    if (errors.length > 0) {
      store.setImportError(errors.join('\n'));
    }
  }
}
