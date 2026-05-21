import { useRef, useState } from 'react';
import { useDrawingStore } from '../stores/drawingStore';
import { loadDrawingFile, UnsupportedFormatError } from '../pdf/loadDrawing';

export function FileImportButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addImport = useDrawingStore((s) => s.addImport);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // ให้เลือกไฟล์เดิมซ้ำได้
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { file: df, pages } = await loadDrawingFile(file);
      addImport(df, pages);
    } catch (err) {
      if (err instanceof UnsupportedFormatError) {
        setError(err.message);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Import ล้มเหลว: ${msg}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{ padding: '4px 10px', fontSize: 13 }}
      >
        {busy ? 'กำลังโหลด…' : 'เปิดไฟล์'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf,image/png,image/jpeg,image/webp,.dwg,.dwf"
        style={{ display: 'none' }}
        onChange={onPick}
      />
      {error && (
        <span style={{ color: '#ff8080', fontSize: 12, maxWidth: 280 }}>{error}</span>
      )}
    </span>
  );
}
