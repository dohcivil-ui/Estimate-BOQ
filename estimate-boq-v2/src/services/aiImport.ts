/**
 * นำเข้า JSON จาก Custom GPT → BOQ items
 *
 * Format ที่รับ (ดู PROMPT-Claude-Code-Phase2.md):
 * {
 *   "project": "...",
 *   "factorF": 1.3,
 *   "boq": [
 *     {
 *       "name": "...",
 *       "unit": "ตัน",
 *       "rate": 3900,
 *       "qty": 0.38,
 *       "isMat": false,
 *       "waste": 7,
 *       "category": "งานโครงสร้าง",   // optional
 *       "thick": 0.12,                  // optional (แค่ slab)
 *       "notes": "..."                  // optional
 *     }
 *   ]
 * }
 */
import type { AIImportPayload, BOQItem } from '@/types/boq';
import { cleanJsonResponse } from './aiAnalyze';

export class AIImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIImportError';
  }
}

/** parse + validate (loose) — ใช้ cleanJsonResponse ก่อนเสมอ */
export function parseAIPayload(raw: string): AIImportPayload {
  const trimmed = raw.trim();
  if (!trimmed) throw new AIImportError('โปรดวาง JSON ก่อน');

  const txt = cleanJsonResponse(trimmed);

  let parsed: unknown;
  try {
    parsed = JSON.parse(txt);
  } catch (err) {
    throw new AIImportError(
      `JSON ไม่ถูกต้อง: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new AIImportError('payload ไม่ใช่ object');
  }

  const p = parsed as Record<string, unknown>;

  if (!Array.isArray(p.boq)) {
    throw new AIImportError('ต้องมี field "boq" เป็น array');
  }

  const items = p.boq as Array<Record<string, unknown>>;

  // validate ทีละ row (loose — แค่ field สำคัญ)
  for (let i = 0; i < items.length; i++) {
    const r = items[i]!;
    if (typeof r.name !== 'string' || !r.name.trim())
      throw new AIImportError(`row #${i + 1}: ต้องมี "name"`);
    if (typeof r.unit !== 'string' || !r.unit.trim())
      throw new AIImportError(`row #${i + 1}: ต้องมี "unit"`);
    if (!isFiniteNumber(r.rate))
      throw new AIImportError(`row #${i + 1}: "rate" ต้องเป็นตัวเลข`);
    if (!isFiniteNumber(r.qty))
      throw new AIImportError(`row #${i + 1}: "qty" ต้องเป็นตัวเลข`);
    if (typeof r.isMat !== 'boolean')
      throw new AIImportError(`row #${i + 1}: "isMat" ต้องเป็น boolean`);
  }

  return parsed as AIImportPayload;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v);
}

/** แปลง payload → BOQItem[] พร้อมใส่ metadata */
export function payloadToBOQItems(payload: AIImportPayload): BOQItem[] {
  const now = new Date().toISOString();
  return payload.boq.map((r) => ({
    id: crypto.randomUUID(),
    category: r.category ?? 'จาก AI',
    name: r.name,
    unit: r.unit,
    quantity: r.qty,
    unitPrice: r.rate,
    isMaterial: r.isMat,
    wastePct: r.waste ?? 0,
    thickness: r.thick,
    source: 'ai' as const,
    sourceRef: undefined,
    notes: r.notes,
    createdAt: now,
    updatedAt: now,
  }));
}
