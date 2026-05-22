// src/services/excelExport.ts — Excel export (spec §17) via SheetJS
// 2 ชีต: BOQ + Measurements — BOQ ทุก row trace กลับ measurement id ได้
import * as XLSX from 'xlsx';
import { useDrawingStore } from '../stores/drawingStore';
import { useMeasurementStore } from '../stores/measurementStore';
import {
  useBOQStore,
  computeBOQViews,
} from '../stores/boqStore';

type BOQRow = {
  code: string;
  description: string;
  workCategory: string;
  quantity: number;
  unit: string;
  unitPrice: number | '';
  amount: number | '';
  source: string;
  pages: string;
  refMeasurementIds: string;
};

type MeasurementRow = {
  id: string;
  page: number;
  type: string;
  quantity: number;
  unit: string;
  label: string;
  categoryId: string;
  /** geometry ใน page-px (float) — JSON serialized */
  geometryJSON: string;
};

export function exportProjectExcel(filename = 'project_boq.xlsx'): void {
  const d = useDrawingStore.getState();
  const m = useMeasurementStore.getState();
  const b = useBOQStore.getState();

  const pageNumberById: Record<string, number> = {};
  for (const p of d.pages) pageNumberById[p.id] = p.pageNumber;

  // ---- BOQ sheet ----
  const views = computeBOQViews(b.items, b.itemOrder, b.links, m.byId);
  const boqRows: BOQRow[] = views.map((v) => {
    // หน้าที่ measurement ที่ผูกอยู่ — แสดงชุดหน้าที่เกี่ยวข้อง (กรณีผูก measurement หลายหน้า)
    const pageSet = new Set<number>();
    for (const l of v.links) {
      const meas = m.byId[l.measurementId];
      if (meas) {
        const num = pageNumberById[meas.drawingPageId];
        if (num != null) pageSet.add(num);
      }
    }
    const pages = Array.from(pageSet).sort((a, b) => a - b).join(',');
    const refIds = v.links.map((l) => l.measurementId).join(',');
    return {
      code: v.code,
      description: v.description,
      workCategory: v.workCategory,
      quantity: Number(v.quantity.toFixed(6)),
      unit: v.unit,
      unitPrice: v.unitPrice ?? '',
      amount: v.amount != null ? Number(v.amount.toFixed(2)) : '',
      source: v.source,
      pages,
      refMeasurementIds: refIds,
    };
  });

  // ---- Measurements sheet ----
  const measRows: MeasurementRow[] = Object.values(m.byId).map((meas) => ({
    id: meas.id,
    page: pageNumberById[meas.drawingPageId] ?? 0,
    type: meas.type,
    quantity: Number(meas.quantity.toFixed(6)),
    unit: meas.unit,
    label: meas.label ?? '',
    categoryId: meas.categoryId ?? '',
    geometryJSON: JSON.stringify(meas.geometry),
  }));

  const wb = XLSX.utils.book_new();
  const wsBOQ = XLSX.utils.json_to_sheet(boqRows, {
    header: [
      'code',
      'description',
      'workCategory',
      'quantity',
      'unit',
      'unitPrice',
      'amount',
      'source',
      'pages',
      'refMeasurementIds',
    ],
  });
  const wsMeas = XLSX.utils.json_to_sheet(measRows, {
    header: ['id', 'page', 'type', 'quantity', 'unit', 'label', 'categoryId', 'geometryJSON'],
  });

  XLSX.utils.book_append_sheet(wb, wsBOQ, 'BOQ');
  XLSX.utils.book_append_sheet(wb, wsMeas, 'Measurements');

  XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
}
