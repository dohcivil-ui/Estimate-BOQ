import { useEffect, useState } from 'react';

interface Options {
  onDrop: (files: File[]) => void;
  /** ปิด drag-drop ชั่วคราว (เช่นระหว่างกำลัง import) */
  disabled?: boolean;
}

/** ฟัง drag/drop ที่ระดับ document — เพื่อเปิดไฟล์ได้ทุกที่ในแอป */
export function useDocumentDrop({ onDrop, disabled }: Options): {
  dragging: boolean;
} {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (disabled) return;

    let depth = 0;

    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      depth += 1;
      if (depth === 1) setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDropEvt = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) onDrop(files);
    };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDropEvt);

    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDropEvt);
    };
  }, [onDrop, disabled]);

  return { dragging };
}
