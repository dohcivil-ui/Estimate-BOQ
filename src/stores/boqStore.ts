// src/stores/boqStore.ts — BOQ items + links (spec §11)
//
// บทเรียน Phase 2 (hasScale): ค่าที่ derive ได้ห้ามเก็บซ้ำเป็น state
//  - BOQItem.quantity = Σ link.quantityContribution (DERIVED จาก measurement + factor + waste)
//  - BOQItem.amount   = quantity × unitPrice          (DERIVED)
//  - link.quantityContribution = measurement.quantity × factor × (1 + wasteFactor ?? 0)  (DERIVED)
// → "store" จะเก็บเฉพาะ field ที่เป็น input ของผู้ใช้ ไม่เก็บค่า derived
//   selector computeBOQViews() เปิดออกมาให้ UI ใช้ มี measurement state เป็น input
import { create } from 'zustand';
import type {
  BOQItem,
  BOQSource,
  BOQUnit,
  Measurement,
  MeasurementBOQLink,
  WorkCategory,
} from '../types';
import { PROJECT_ID } from './measurementStore';

/** Stored BOQ item — ไม่มี quantity / amount / links (derived) */
export type BOQItemStored = {
  id: string;
  projectId: string;
  code: string;
  description: string;
  workCategory: WorkCategory;
  unit: BOQUnit;
  unitPrice?: number;
  source: BOQSource;
};

/** Stored link — ไม่มี quantityContribution (derived) */
export type BOQLinkStored = {
  id: string;
  measurementId: string;
  boqItemId: string;
  formulaId: string;
  factor: number;
  wasteFactor?: number;
  note?: string;
};

type BOQState = {
  items: Record<string, BOQItemStored>;
  /** ลำดับการแสดงผล */
  itemOrder: string[];
  /** links เก็บเป็น array — query ผ่าน selector */
  links: BOQLinkStored[];

  /** selection สำหรับ traceability UI */
  selectedBOQId: string | null;
  hoverBOQId: string | null;

  // mutations
  createItem: (
    input: Omit<BOQItemStored, 'id' | 'projectId'> & { projectId?: string },
  ) => string;
  updateItem: (id: string, patch: Partial<Omit<BOQItemStored, 'id' | 'projectId'>>) => void;
  deleteItem: (id: string) => void;
  setUnitPrice: (id: string, price: number | undefined) => void;

  linkMeasurement: (
    measurementId: string,
    boqItemId: string,
    factor?: number,
    wasteFactor?: number,
    formulaId?: string,
    note?: string,
  ) => string;
  updateLink: (
    linkId: string,
    patch: Partial<Pick<BOQLinkStored, 'factor' | 'wasteFactor' | 'note' | 'formulaId'>>,
  ) => void;
  unlink: (linkId: string) => void;
  /** ลบลิงก์ทั้งหมดที่ชี้ไป measurement (เรียกตอน measurement ถูกลบ) */
  unlinkAllForMeasurement: (measurementId: string) => void;

  setSelectedBOQ: (id: string | null) => void;
  setHoverBOQ: (id: string | null) => void;

  /** linksForMeasurement / linksForBOQ — ใช้ทั้งใน UI และตอนคำนวณ */
  linksForMeasurement: (measurementId: string) => BOQLinkStored[];
  linksForBOQ: (boqItemId: string) => BOQLinkStored[];

  /** สำหรับ persistence: bulk load */
  loadFromSnapshot: (snap: {
    items: Record<string, BOQItemStored>;
    itemOrder: string[];
    links: BOQLinkStored[];
  }) => void;
  reset: () => void;
};

let _seq = 0;
function nextId(prefix: string) {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq.toString(36)}`;
}

export function defaultFormulaIdFor(m: Measurement): string {
  switch (m.type) {
    case 'line':
      return 'line_length';
    case 'polyline':
      return 'polyline_length';
    case 'polygon_area':
    case 'lasso_area':
      return 'polygon_area';
    case 'rectangle_area':
    case 'region_selection':
      return 'rectangle_area';
    case 'count_marker':
      return 'count';
    default:
      return 'custom';
  }
}

export const useBOQStore = create<BOQState>((set, get) => ({
  items: {},
  itemOrder: [],
  links: [],
  selectedBOQId: null,
  hoverBOQId: null,

  createItem: (input) => {
    const id = nextId('boq');
    const item: BOQItemStored = {
      id,
      projectId: input.projectId ?? PROJECT_ID,
      code: input.code,
      description: input.description,
      workCategory: input.workCategory,
      unit: input.unit,
      unitPrice: input.unitPrice,
      source: input.source,
    };
    set((s) => ({
      items: { ...s.items, [id]: item },
      itemOrder: [...s.itemOrder, id],
    }));
    return id;
  },

  updateItem: (id, patch) => {
    const prev = get().items[id];
    if (!prev) return;
    set((s) => ({ items: { ...s.items, [id]: { ...prev, ...patch } } }));
  },

  deleteItem: (id) => {
    set((s) => {
      const { [id]: _drop, ...restItems } = s.items;
      return {
        items: restItems,
        itemOrder: s.itemOrder.filter((x) => x !== id),
        links: s.links.filter((l) => l.boqItemId !== id),
        selectedBOQId: s.selectedBOQId === id ? null : s.selectedBOQId,
        hoverBOQId: s.hoverBOQId === id ? null : s.hoverBOQId,
      };
    });
  },

  setUnitPrice: (id, price) => {
    const prev = get().items[id];
    if (!prev) return;
    set((s) => ({ items: { ...s.items, [id]: { ...prev, unitPrice: price } } }));
  },

  linkMeasurement: (
    measurementId,
    boqItemId,
    factor = 1,
    wasteFactor,
    formulaId = 'custom',
    note,
  ) => {
    const id = nextId('lnk');
    const link: BOQLinkStored = {
      id,
      measurementId,
      boqItemId,
      factor,
      wasteFactor,
      formulaId,
      note,
    };
    set((s) => ({ links: [...s.links, link] }));
    return id;
  },

  updateLink: (linkId, patch) => {
    set((s) => ({
      links: s.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)),
    }));
  },

  unlink: (linkId) => {
    set((s) => ({ links: s.links.filter((l) => l.id !== linkId) }));
  },

  unlinkAllForMeasurement: (measurementId) => {
    set((s) => ({ links: s.links.filter((l) => l.measurementId !== measurementId) }));
  },

  setSelectedBOQ: (id) => set({ selectedBOQId: id }),
  setHoverBOQ: (id) => set({ hoverBOQId: id }),

  linksForMeasurement: (measurementId) =>
    get().links.filter((l) => l.measurementId === measurementId),
  linksForBOQ: (boqItemId) => get().links.filter((l) => l.boqItemId === boqItemId),

  loadFromSnapshot: (snap) =>
    set({
      items: snap.items,
      itemOrder: snap.itemOrder,
      links: snap.links,
      selectedBOQId: null,
      hoverBOQId: null,
    }),

  reset: () =>
    set({ items: {}, itemOrder: [], links: [], selectedBOQId: null, hoverBOQId: null }),
}));

// =============================================================================
// PURE DERIVED VIEW COMPUTATION (selector)
// =============================================================================

/**
 * คำนวณ quantityContribution ของลิงก์ — DERIVED (ห้ามเก็บใน state)
 * contribution = measurement.quantity × factor × (1 + wasteFactor ?? 0)
 * ถ้า measurement หาย → contribution = 0 (orphan link)
 */
export function computeContribution(
  link: BOQLinkStored,
  measurementsById: Record<string, Measurement>,
): number {
  const m = measurementsById[link.measurementId];
  if (!m) return 0;
  const waste = link.wasteFactor ?? 0;
  return m.quantity * link.factor * (1 + waste);
}

/** สร้าง MeasurementBOQLink view (spec shape) จาก stored link + measurement state */
export function buildLinkView(
  link: BOQLinkStored,
  measurementsById: Record<string, Measurement>,
): MeasurementBOQLink {
  return {
    id: link.id,
    measurementId: link.measurementId,
    boqItemId: link.boqItemId,
    formulaId: link.formulaId,
    factor: link.factor,
    wasteFactor: link.wasteFactor,
    quantityContribution: computeContribution(link, measurementsById),
    note: link.note,
  };
}

/**
 * สร้าง BOQItem view ตามสเปก §11 — quantity & amount derived
 * โครงสร้างเดียวที่ UI/export ควรใช้แสดง BOQ
 */
export function computeBOQView(
  item: BOQItemStored,
  allLinks: BOQLinkStored[],
  measurementsById: Record<string, Measurement>,
): BOQItem {
  const myLinks = allLinks.filter((l) => l.boqItemId === item.id);
  const linkViews = myLinks.map((l) => buildLinkView(l, measurementsById));
  const quantity = linkViews.reduce((s, l) => s + l.quantityContribution, 0);
  const amount = item.unitPrice == null ? undefined : quantity * item.unitPrice;
  return {
    id: item.id,
    projectId: item.projectId,
    code: item.code,
    description: item.description,
    workCategory: item.workCategory,
    unit: item.unit,
    quantity,
    unitPrice: item.unitPrice,
    amount,
    source: item.source,
    links: linkViews,
  };
}

export function computeBOQViews(
  items: Record<string, BOQItemStored>,
  itemOrder: string[],
  allLinks: BOQLinkStored[],
  measurementsById: Record<string, Measurement>,
): BOQItem[] {
  const views: BOQItem[] = [];
  for (const id of itemOrder) {
    const item = items[id];
    if (!item) continue;
    views.push(computeBOQView(item, allLinks, measurementsById));
  }
  return views;
}

/** Preset BOQ templates ที่ใช้บ่อย (helper สำหรับ "Create BOQ" UX) */
export const BOQ_PRESETS: Array<Omit<BOQItemStored, 'id' | 'projectId' | 'source'>> = [
  { code: 'AR-FL-01', description: 'งานปูกระเบื้องพื้น 60×60', workCategory: 'architecture', unit: 'm2' },
  { code: 'AR-WL-01', description: 'งานก่อผนัง (อิฐมวลเบา)', workCategory: 'architecture', unit: 'm2' },
  { code: 'AR-PT-01', description: 'งานทาสีผนัง', workCategory: 'architecture', unit: 'm2' },
  { code: 'AR-DR-D1', description: 'ประตู D1', workCategory: 'architecture', unit: 'ea' },
  { code: 'AR-WN-W1', description: 'หน้าต่าง W1', workCategory: 'architecture', unit: 'ea' },
  { code: 'ST-CL-C1', description: 'เสา C1 (คอนกรีต)', workCategory: 'structure', unit: 'ea' },
];
