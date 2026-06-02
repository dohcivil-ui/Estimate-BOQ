/**
 * boqAdapter.ts — แปลงผล AI (analyzePage items[]) → spec ของ compute layer
 * --------------------------------------------------------------------------
 * เปลี่ยนจากเดิม: Box engine ถูกถอดออกแล้ว → "count + มิติ + เหล็ก" มาจาก AI extract
 *   ทั้งหมด (Claude นับฐานจากกริด ตามกฎ 11-12 ใน structural prompt)
 *
 * หลักการ:
 *   - count = item.quantity ของฐานนั้น (AI นับจากกริด) — ถ้า ≤ 0 → ❓ ไม่เดา
 *   - มิติ/เหล็ก/ตอม่อ = parse จาก dimensions/name/rebar/notes ของ item
 *   - ข้อมูลไม่ครบ → push warning ❓ (กฎ 6: ไม่เดาเงียบ)
 *
 * pure module: ไม่มี dependency กับ store/supabase/react
 */
import type { AIItem } from '@/types/ai';
import type { FootingSpec, RebarLayer, PedestalSpec } from './footingCompute.ts';
import type { BeamSpec, BeamBar, SlabSpec } from './beamCompute.ts';
import { parseBeamBars } from './parseBeamBars';
// type-only — ไม่ดึง zustand เข้า pure module (erased ตอน compile)
import type { MarkDims } from '@/stores/detectionStore';

// ─────────────────────────────────────────────────────────────
// คู่ ฐาน ↔ ตอม่อ (กฎผู้ใช้: F2↔C2, F1↔C3) — ตอม่ออ่านจาก Column Schedule
// ─────────────────────────────────────────────────────────────
export const PEDESTAL_OF: Record<string, string> = {
  F2: 'C2',
  F1: 'C3',
};

export interface AdapterInput {
  /** ผลถอดจาก AI (analyzePage().result.items) — count + มิติ + เหล็ก */
  extract: AIItem[];
}

export interface AdapterResult {
  footings: FootingSpec[];
  beams: BeamSpec[];
  slabs: SlabSpec[];
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────
// parsing helpers (tolerant — AI output เป็นข้อความอิสระ)
// ─────────────────────────────────────────────────────────────
/** ดึงรหัสชนิด F#/C# จากข้อความ เช่น "F2 ฐานราก..." → "F2" */
function typeCode(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/\b([FfCc]\d+)\b/);
  return m ? m[1]!.toUpperCase() : null;
}

/** ดึงตัวเลขทุกตัวจากข้อความ "1.50×1.50×0.35" → [1.5,1.5,0.35] */
function numbers(s: string | undefined): number[] {
  if (!s) return [];
  return Array.from(s.matchAll(/(\d+(?:\.\d+)?)/g)).map((m) =>
    parseFloat(m[1]!),
  );
}

/** ระยะเรียงอาจมาเป็น มม. (150) หรือ ม. (0.15) → normalize เป็น ม. */
function toMeterSpacing(v: number): number {
  return v > 3 ? v / 1000 : v;
}

/** หา depth (ระดับก้นหลุม) จาก notes/description — keyword ลึก/ระดับ/depth */
function parseDepth(...texts: Array<string | undefined>): number | null {
  for (const t of texts) {
    if (!t) continue;
    const m = t.match(
      /(?:ลึก|ระดับก้น|ก้นหลุม|จมดิน|depth|d)\s*[=:]?\s*(-?\d+(?:\.\d+)?)/i,
    );
    if (m) return Math.abs(parseFloat(m[1]!));
  }
  return null;
}

/** parse เหล็กตะแกรงฐาน เช่น "DB12@0.15", "DB12 @ 150", "16-DB12" */
function parseFootingRebar(...texts: Array<string | undefined>): RebarLayer[] {
  const joined = texts.filter(Boolean).join(' ');
  const out: RebarLayer[] = [];
  // โหมด spacing: (DB|RB)d @ s
  for (const m of joined.matchAll(/\b(DB|RB)\s?(\d+)\s*@\s*(\d+(?:\.\d+)?)/gi)) {
    out.push({
      size: `${m[1]!.toUpperCase()}${m[2]}`,
      spacing: toMeterSpacing(parseFloat(m[3]!)),
    });
  }
  if (out.length > 0) return out;
  // โหมดจำนวนเส้น: n-(DB|RB)d  หรือ  n (DB|RB)d (n = จำนวนรวมทั้ง 2 ทิศ)
  for (const m of joined.matchAll(/\b(\d+)\s*[-xX×]?\s*(DB|RB)\s?(\d+)/gi)) {
    out.push({
      size: `${m[2]!.toUpperCase()}${m[3]}`,
      bars: parseInt(m[1]!, 10),
    });
  }
  return out;
}

/** parse เหล็กยืน "8-DB12" / "8DB12" → {size,count} */
function parseVBars(
  text: string | undefined,
): { size: string; count: number } | null {
  if (!text) return null;
  const m = text.match(/(\d+)\s*[-xX×]?\s*(DB|RB)\s?(\d+)/i);
  if (!m) return null;
  return { size: `${m[2]!.toUpperCase()}${m[3]}`, count: parseInt(m[1]!, 10) };
}

/** parse ปลอก "RB6@0.15" → {size,spacing} */
function parseTie(
  text: string | undefined,
): { size: string; spacing: number } | null {
  if (!text) return null;
  const m = text.match(/(DB|RB)\s?(\d+)\s*@\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  return {
    size: `${m[1]!.toUpperCase()}${m[2]}`,
    spacing: toMeterSpacing(parseFloat(m[3]!)),
  };
}

/** parse เหล็กรัดรอบฐาน count-size เช่น "1-RB9 รัดรอบ" / "RB9 รัดรอบ" / "2-RB9" → {size,count} (ไม่มี count = 1) */
function parseTieRebar(
  text: string | undefined,
): { size: string; count: number } | null {
  if (!text) return null;
  const m = text.match(/(?:(\d+)\s*[-xX×]?\s*)?(DB|RB)\s?(\d+)/i);
  if (!m) return null;
  return {
    size: `${m[2]!.toUpperCase()}${m[3]}`,
    count: m[1] ? parseInt(m[1], 10) : 1,
  };
}

/** หา extract item ตามรหัสชนิด (match จาก name → category → dimensions) */
function findByType(extract: AIItem[], code: string): AIItem | undefined {
  return extract.find(
    (it) =>
      typeCode(it.name) === code ||
      typeCode(it.category) === code ||
      typeCode(it.description) === code,
  );
}

/** item นี้เป็น "ฐานราก" หรือไม่ */
function isFootingItem(it: AIItem): boolean {
  const hay = `${it.category ?? ''} ${it.name ?? ''}`;
  return /ฐานราก|ฐาน\b|footing/i.test(hay) || /\bF\d+\b/.test(hay);
}

// ─────────────────────────────────────────────────────────────
// ฐานราก: count + มิติ + เหล็ก + ตอม่อ — ทั้งหมดจาก AI extract
// ─────────────────────────────────────────────────────────────
function buildFooting(
  item: AIItem,
  extract: AIItem[],
  warnings: string[],
): FootingSpec {
  const code = typeCode(item.name) ?? typeCode(item.category) ?? item.name ?? 'F?';
  const count = typeof item.quantity === 'number' ? item.quantity : 0;
  const dims = numbers(item.dimensions ?? item.name);
  const [W = 0, L = 0, T = 0] = dims;
  const depth = parseDepth(item.notes, item.description, item.dimensions);

  if (count <= 0) {
    warnings.push(
      `❓ ${code}: AI ไม่ได้ระบุจำนวนฐาน (quantity=${item.quantity ?? '—'}) — ตรวจการนับจากกริด`,
    );
  }
  if (!W || !L || !T) {
    warnings.push(
      `❓ ${code}: อ่านมิติ W/L/T ไม่ครบจาก "${item.dimensions ?? item.name}" — ต้องแนบ detail sheet (Footing Schedule S2-02) แล้ววิเคราะห์ใหม่`,
    );
  }
  // depth ว่างได้ — footingCompute คำนวณก้นหลุมจาก สูงตอม่อ+หนาฐาน+lean+sand เอง

  const rebar = parseFootingRebar(item.rebar, item.description, item.notes);
  if (rebar.length === 0) {
    warnings.push(
      `❓ ${code}: อ่านเหล็กตะแกรงฐานไม่ออกจาก "${item.rebar ?? '—'}"`,
    );
  }

  // ── ตอม่อ (Column Schedule — คู่ตาม PEDESTAL_OF) ──
  let pedestal: PedestalSpec | undefined;
  const pedCode = PEDESTAL_OF[code];
  if (pedCode) {
    const pItem = findByType(extract, pedCode);
    if (pItem) {
      const pdims = numbers(pItem.dimensions ?? pItem.name);
      const [pW = 0, pL = 0, pH = 0] = pdims;
      const vBars = parseVBars(pItem.rebar ?? pItem.description);
      const tie = parseTie(pItem.rebar ?? pItem.description);
      if (pW && pL && pH && vBars && tie) {
        pedestal = { type: pedCode, W: pW, L: pL, H: pH, vBars, tie };
      } else {
        warnings.push(
          `❓ ${code}/${pedCode}: ตอม่ออ่านมิติ/เหล็กไม่ครบ — คิดเฉพาะฐาน (ไม่รวมตอม่อ)`,
        );
      }
    } else {
      warnings.push(
        `❓ ${code}: ไม่พบตอม่อ ${pedCode} ใน extract — คิดเฉพาะฐาน (ตรวจ Column Schedule S2-04)`,
      );
    }
  }

  return {
    type: code,
    W,
    L,
    T,
    depth: depth ?? 0,
    count,
    rebar: rebar.length > 0 ? rebar : undefined,
    pedestal,
    refSheet: 'S2-02',
  };
}

// ─────────────────────────────────────────────────────────────
// คาน / พื้น: provisional (ข้อมูลยังไม่ครบ → ❓ ไม่เดาความยาว)
// ─────────────────────────────────────────────────────────────
function buildBeams(extract: AIItem[], warnings: string[]): BeamSpec[] {
  const out: BeamSpec[] = [];
  for (const it of extract) {
    const isBeam = /คาน|\bGB\d|\bB\d|beam/i.test(`${it.category} ${it.name}`);
    if (!isBeam) continue;
    const dims = numbers(it.dimensions ?? it.name);
    const [W = 0, H = 0] = dims;
    out.push({
      type: typeCode(it.name) ?? it.name ?? 'คาน',
      W,
      H,
      pieces: [], // ❗ ยังไม่รู้ความยาว/จำนวนช่วง — ไม่เดา
      mainBars: [],
      stirrup: { size: 'RB6', spacing: 0.15 },
    });
    warnings.push(
      `❓ คาน ${it.name}: ยังไม่มีความยาว/จำนวนช่วง (ต้องอ่าน S2-01) — ขึ้นเป็น provisional`,
    );
  }
  return out;
}

function buildSlabs(extract: AIItem[], warnings: string[]): SlabSpec[] {
  const out: SlabSpec[] = [];
  for (const it of extract) {
    const isSlab = /พื้น|\bGS\b|\bPS\b|slab/i.test(`${it.category} ${it.name}`);
    if (!isSlab) continue;
    const area =
      typeof it.quantity === 'number' && /ตร\.?ม|m2|m²/i.test(it.unit ?? '')
        ? it.quantity
        : 0;
    const thk = numbers(it.dimensions).find((n) => n > 0 && n < 1) ?? 0;
    out.push({
      name: typeCode(it.name) ?? it.name ?? 'พื้น',
      area_m2: area,
      thickness: thk,
      provisional: true,
    });
    warnings.push(
      `📝 พื้น ${it.name}: เป็นร่างจาก AI — ต้องเติมมิติ/ยืนยันพื้นที่+ความหนาก่อนใช้จริง` +
        (!area || !thk ? ' · พื้นที่/ความหนายังไม่ครบ' : ''),
    );
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
export function buildSpecs(input: AdapterInput): AdapterResult {
  const warnings: string[] = [];
  const extract = input.extract ?? [];

  const footings: FootingSpec[] = [];
  for (const it of extract) {
    if (!isFootingItem(it)) continue;
    footings.push(buildFooting(it, extract, warnings));
  }
  if (footings.length === 0) {
    warnings.push('❓ ไม่พบรายการฐานราก (F#) ในผล AI — ตรวจ prompt/หน้าที่วิเคราะห์');
  }

  const beams = buildBeams(extract, warnings);
  const slabs = buildSlabs(extract, warnings);

  return { footings, beams, slabs, warnings };
}

// ─────────────────────────────────────────────────────────────
// ทาง A — สเปกจาก "tag count + มิติที่ผู้ใช้พิมพ์" (ไม่พึ่ง AI)
//   count ← tag (footingByMark/beamByMark/slabAreaByMark)
//   มิติ/เหล็ก ← markDims dict (ผู้ใช้พิมพ์)
//   ไม่มีมิติ → ❓ 'ยังไม่เติมมิติ {mark}' แล้วข้าม (ไม่เดา)
// ─────────────────────────────────────────────────────────────
export interface MarksSpecInput {
  /** subset ของ MemberTally — เฉพาะ map ที่ต้องใช้ (เลี่ยง circular dep ที่ runtime) */
  tally: {
    footingByMark: Map<string, number>;
    beamByMark: Map<string, number>;
    slabAreaByMark: Map<string, number>;
  };
  markDims: Record<string, MarkDims>;
}

export function specsFromMarks(input: MarksSpecInput): AdapterResult {
  const warnings: string[] = [];
  const { tally, markDims } = input;
  const footings: FootingSpec[] = [];
  const beams: BeamSpec[] = [];
  const slabs: SlabSpec[] = [];

  // ── ฐานราก ──
  for (const [mark, count] of tally.footingByMark) {
    const d = markDims[mark];
    if (!d || d.kind !== 'footing') {
      warnings.push(`❓ ยังไม่เติมมิติ ${mark} (ฐานราก) — กดปุ่ม ✏️ เพื่อเติม`);
      continue;
    }
    const rebar = parseFootingRebar(d.rebar);
    if (rebar.length === 0) {
      warnings.push(`❓ ${mark}: อ่านเหล็กตะแกรงฐานไม่ออกจาก "${d.rebar || '—'}"`);
    }

    // เหล็กรัดรอบฐาน (RB9) — optional · parse count-size เช่น "1-RB9 รัดรอบ"
    let tieRebar: { size: string; count: number } | undefined;
    if (d.tieRebar && d.tieRebar.trim()) {
      const parsed = parseTieRebar(d.tieRebar);
      if (parsed) tieRebar = parsed;
      else
        warnings.push(
          `❓ ${mark}: อ่านเหล็กรัดรอบไม่ออกจาก "${d.tieRebar}" — ข้าม (รูปแบบ เช่น 1-RB9 รัดรอบ)`,
        );
    }

    // ตอม่อ (คู่ตาม PEDESTAL_OF — มิติจาก markDims[pedMark] kind=column)
    let pedestal: PedestalSpec | undefined;
    const pedMark = PEDESTAL_OF[mark];
    if (pedMark) {
      const pd = markDims[pedMark];
      if (pd && pd.kind === 'column') {
        const vBars = parseVBars(pd.vBars);
        const tie = parseTie(pd.tie);
        if (pd.W && pd.L && pd.H && vBars && tie) {
          pedestal = { type: pedMark, W: pd.W, L: pd.L, H: pd.H, vBars, tie };
        } else {
          warnings.push(
            `❓ ${mark}/${pedMark}: ตอม่ออ่านมิติ/เหล็กไม่ครบ — คิดเฉพาะฐาน`,
          );
        }
      } else {
        warnings.push(
          `❓ ${mark}: ยังไม่เติมมิติตอม่อ ${pedMark} — คิดเฉพาะฐาน`,
        );
      }
    }

    footings.push({
      type: mark,
      W: d.W,
      L: d.L,
      T: d.T,
      depth: d.depth ?? 0, // 0 = ให้ footingCompute คำนวณก้นหลุมเอง
      count,
      sandThk: d.sandThk, // เว้นว่าง = footingCompute ใช้ CONST default
      leanThk: d.leanThk,
      rebar: rebar.length > 0 ? rebar : undefined,
      tieRebar,
      pedestal,
      refSheet: 'S2-02',
    });
  }

  // ── คาน ──
  for (const [mark, tagCount] of tally.beamByMark) {
    const d = markDims[mark];
    if (!d || d.kind !== 'beam') {
      warnings.push(`❓ ยังไม่เติมมิติ ${mark} (คาน) — กดปุ่ม ✏️ เพื่อเติม`);
      continue;
    }
    const mainBars: BeamBar[] = parseBeamBars(d.mainBars);
    if (mainBars.length === 0) {
      warnings.push(`❓ ${mark}: อ่านเหล็กยืนหลักไม่ออกจาก "${d.mainBars || '—'}"`);
    }
    const stirrup = parseTie(d.stirrup) ?? { size: 'RB6', spacing: 0.15 };
    if (!parseTie(d.stirrup)) {
      warnings.push(`❓ ${mark}: อ่านปลอกไม่ออกจาก "${d.stirrup || '—'}" — ใช้ RB6@0.15`);
    }
    // cross-check: จำนวนช่วงใน dict vs จำนวน tag (ไม่ block)
    const piecesCount = d.pieces.reduce((s, p) => s + p.count, 0);
    if (piecesCount !== tagCount) {
      warnings.push(
        `⚠️ ${mark}: จำนวนช่วงในมิติ (${piecesCount}) ≠ จำนวน tag บนแบบ (${tagCount}) — ตรวจซ้ำ`,
      );
    }
    beams.push({
      type: mark,
      W: d.W,
      H: d.H,
      pieces: d.pieces.map((p) => ({ length: p.length, count: p.count })),
      mainBars,
      stirrup,
    });
  }

  // ── พื้น ──
  for (const [mark, tagSum] of tally.slabAreaByMark) {
    const d = markDims[mark];
    if (!d || d.kind !== 'slab') {
      warnings.push(`❓ ยังไม่เติมมิติ ${mark} (พื้น) — กดปุ่ม ✏️ เพื่อเติม`);
      continue;
    }
    if (tagSum > 0 && d.areaSqm > 0) {
      const diffPct = Math.abs(tagSum - d.areaSqm) / tagSum;
      if (diffPct > 0.05) {
        warnings.push(
          `⚠️ ${mark}: พื้นที่ที่กรอก (${d.areaSqm} ตร.ม.) ต่างจาก tag รวม (${tagSum} ตร.ม.) เกิน 5% (${(diffPct * 100).toFixed(1)}%) — ตรวจซ้ำ`,
        );
      }
    }
    slabs.push({
      name: mark,
      area_m2: d.areaSqm,
      thickness: d.thickness,
      mesh: { wireMM: d.meshWireMM, spacing: d.meshSpacing },
      sandThk: d.sandThk,
    });
  }

  return { footings, beams, slabs, warnings };
}
