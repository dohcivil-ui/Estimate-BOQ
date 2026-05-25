import { useRef } from 'react';
import { useDrawingStore } from '@/stores/drawingStore';
import { importFilesIntoStore } from '@/services/importFiles';

const ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.bmp,application/pdf,image/png,image/jpeg,image/webp,image/bmp';

interface Props {
  /** label custom สำหรับครั้งแรก vs ครั้งต่อๆ ไป */
  variant?: 'primary' | 'compact';
}

export function FileImportButton({ variant = 'compact' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importing = useDrawingStore((s) => s.importing);

  const handleClick = () => {
    if (importing) return;
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    await importFilesIntoStore(files);
  };

  const baseCls =
    variant === 'primary'
      ? 'rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink-inverse hover:bg-accent-hover'
      : 'rounded border border-bg-border bg-bg-raised px-3 py-1.5 text-sm text-ink-primary hover:bg-bg-hover';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={importing}
        className={`${baseCls} transition-colors disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {importing ? 'กำลังโหลด…' : 'เปิดแบบ PDF/JPG'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={handleChange}
      />
    </>
  );
}
