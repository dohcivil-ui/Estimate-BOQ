import { useState } from 'react';
import { useDrawingStore } from '../stores/drawingStore';
import { useMeasurementStore, COUNT_CATEGORIES } from '../stores/measurementStore';
import { useViewportStore } from '../stores/viewportStore';
import { useCanvasSizeStore } from '../stores/canvasSizeStore';
import {
  useBOQStore,
  computeBOQViews,
  defaultFormulaIdFor,
  BOQ_PRESETS,
} from '../stores/boqStore';
import { useAIStore } from '../stores/aiStore';
import { useRightPanelStore, type RightPanelTab } from '../stores/rightPanelStore';
import { deleteMeasurementWithCascade } from '../services/measurementOps';
import { acceptSuggestion, rejectSuggestion } from '../ai/aiService';
import { SUGGESTION_TYPE_LABEL } from '../ai/AIReviewAdapter';
import type {
  AISeverity,
  AISuggestionRecord,
  BOQItem,
  Measurement,
  MeasurementGeometry,
  WorkCategory,
  BOQUnit,
} from '../types';

const TABS: { id: RightPanelTab; label: string; phase: number }[] = [
  { id: 'measurements', label: 'Measurements', phase: 3 },
  { id: 'boq', label: 'BOQ', phase: 4 },
  { id: 'ai', label: 'AI', phase: 5 },
];

function geometryBBox(g: MeasurementGeometry): { x: number; y: number; w: number; h: number } | null {
  let pts: { x: number; y: number }[] = [];
  switch (g.kind) {
    case 'point':
      pts = [g.point];
      break;
    case 'line':
      pts = [g.points[0], g.points[1]];
      break;
    case 'polyline':
    case 'polygon':
    case 'lasso':
      pts = g.points;
      break;
    case 'rectangle':
      pts = [
        { x: g.x, y: g.y },
        { x: g.x + g.width, y: g.y + g.height },
      ];
      break;
  }
  if (pts.length === 0) return null;
  let minX = pts[0]!.x;
  let minY = pts[0]!.y;
  let maxX = minX;
  let maxY = minY;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

/** รวม bbox ของหลาย measurement → bbox เดียว */
function combinedBBox(measurements: Measurement[]): { x: number; y: number; w: number; h: number } | null {
  let result: { x: number; y: number; w: number; h: number } | null = null;
  for (const m of measurements) {
    const b = geometryBBox(m.geometry);
    if (!b) continue;
    if (!result) {
      result = { ...b };
      continue;
    }
    const minX = Math.min(result.x, b.x);
    const minY = Math.min(result.y, b.y);
    const maxX = Math.max(result.x + result.w, b.x + b.w);
    const maxY = Math.max(result.y + result.h, b.y + b.h);
    result = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  return result;
}

function typeBadge(t: Measurement['type']): string {
  if (t === 'line') return 'Line';
  if (t === 'polyline') return 'Poly';
  if (t === 'polygon_area') return 'Area';
  if (t === 'rectangle_area') return 'Rect';
  if (t === 'count_marker') return 'Cnt';
  return t;
}

function formatQuantity(m: Measurement): string {
  const noScale = m.metadata && (m.metadata as Record<string, unknown>).noScale;
  if (noScale) return '—';
  const u = m.unit === 'm2' ? 'm²' : m.unit;
  return `${m.quantity.toFixed(m.unit === 'ea' ? 0 : 3)} ${u}`;
}

/** zoom canvas viewport → bbox (page-coord) — ใช้ canvasSize จริงไม่ใช่ magic number */
function useZoomToBBox() {
  const activePageId = useDrawingStore((s) => s.activePageId);
  const transform = useViewportStore((s) =>
    activePageId ? s.byPageId[activePageId] ?? null : null,
  );
  const setTransform = useViewportStore((s) => s.setTransform);
  const cw = useCanvasSizeStore((s) => s.width);
  const ch = useCanvasSizeStore((s) => s.height);

  return (bbox: { x: number; y: number; w: number; h: number }) => {
    if (!activePageId || !transform) return;
    const padX = Math.max(bbox.w * 0.3, 40);
    const padY = Math.max(bbox.h * 0.3, 40);
    const tw = bbox.w + padX * 2;
    const th = bbox.h + padY * 2;
    const center = { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
    // zoom: ใช้ค่าเดิมถ้าใหญ่กว่า bbox; ถ้า bbox ใหญ่กว่า viewport → ลด zoom พอดี
    const fitZoom = Math.min(cw / tw, ch / th);
    const finalZoom = Math.max(0.05, Math.min(fitZoom, transform.zoom * 1.5));
    const panX = cw / 2 - center.x * finalZoom;
    const panY = ch / 2 - center.y * finalZoom;
    setTransform(activePageId, { zoom: finalZoom, panX, panY, rotationDeg: 0 });
  };
}

export function RightPanel() {
  const tab = useRightPanelStore((s) => s.tab);
  const setTab = useRightPanelStore((s) => s.setTab);

  return (
    <div
      style={{
        width: 340,
        background: '#171717',
        borderLeft: '1px solid #2a2a2a',
        color: '#ddd',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', borderBottom: '1px solid #2a2a2a' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: 12,
              background: tab === t.id ? '#1f1f1f' : 'transparent',
              color: tab === t.id ? '#fff' : '#888',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #5b9dff' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'measurements' && <MeasurementsTab />}
        {tab === 'boq' && <BOQTab />}
        {tab === 'ai' && <AITab />}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Measurements tab
// ----------------------------------------------------------------------------
function MeasurementsTab() {
  const activePageId = useDrawingStore((s) => s.activePageId);
  const measurements = useMeasurementStore((s) =>
    activePageId ? (s.byPageId[activePageId] ?? []).map((id) => s.byId[id]!).filter(Boolean) : [],
  );
  const selectedIds = useMeasurementStore((s) => s.selectedIds);
  const selectAction = useMeasurementStore((s) => s.select);
  const setLabel = useMeasurementStore((s) => s.setLabel);
  const setCategoryId = useMeasurementStore((s) => s.setCategoryId);
  const zoomToBBox = useZoomToBBox();
  const boqLinks = useBOQStore((s) => s.links);
  const boqItems = useBOQStore((s) => s.items);

  const selectedSet = new Set(selectedIds);

  if (!activePageId) {
    return (
      <p style={{ padding: 12, fontSize: 12, color: '#888' }}>เลือกหน้าแบบเพื่อดู measurement</p>
    );
  }

  if (measurements.length === 0) {
    return (
      <p style={{ padding: 12, fontSize: 12, color: '#888' }}>
        ยังไม่มี measurement บนหน้านี้ — ใช้เครื่องมือ Line/Polyline/Area/Rect/Count
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 84px 32px',
          gap: 6,
          padding: '6px 8px',
          fontSize: 10,
          color: '#888',
          borderBottom: '1px solid #2a2a2a',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          position: 'sticky',
          top: 0,
          background: '#171717',
        }}
      >
        <span>Type</span>
        <span>Label / Category</span>
        <span style={{ textAlign: 'right' }}>Quantity</span>
        <span></span>
      </div>
      {measurements.map((m) => {
        const isSelected = selectedSet.has(m.id);
        const myLinks = boqLinks.filter((l) => l.measurementId === m.id);
        return (
          <div
            key={m.id}
            onClick={() => {
              selectAction([m.id]);
              const b = geometryBBox(m.geometry);
              if (b) zoomToBBox(b);
            }}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 84px 32px',
              gap: 6,
              padding: '6px 8px',
              alignItems: 'center',
              fontSize: 11,
              background: isSelected ? '#243d63' : 'transparent',
              borderLeft: isSelected ? '3px solid #ff9e3d' : '3px solid transparent',
              borderBottom: '1px solid #1f1f1f',
              cursor: 'pointer',
              color: '#ddd',
            }}
          >
            <span
              style={{
                background: '#2a2a2a',
                color: '#5b9dff',
                padding: '1px 4px',
                borderRadius: 3,
                fontSize: 10,
                textAlign: 'center',
              }}
            >
              {typeBadge(m.type)}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <input
                type="text"
                placeholder="label..."
                value={m.label ?? ''}
                onChange={(e) => setLabel(m.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'transparent',
                  color: '#ddd',
                  border: 'none',
                  fontSize: 11,
                  padding: 0,
                  outline: 'none',
                  width: '100%',
                  minWidth: 0,
                }}
              />
              {m.type === 'count_marker' ? (
                <select
                  value={m.categoryId ?? ''}
                  onChange={(e) => setCategoryId(m.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: '#1f1f1f',
                    color: '#aaa',
                    border: '1px solid #2a2a2a',
                    fontSize: 10,
                    padding: '1px 3px',
                    borderRadius: 2,
                  }}
                >
                  {COUNT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="category..."
                  value={m.categoryId ?? ''}
                  onChange={(e) => setCategoryId(m.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'transparent',
                    color: '#888',
                    border: 'none',
                    fontSize: 10,
                    padding: 0,
                    outline: 'none',
                  }}
                />
              )}
              {myLinks.length > 0 && (
                <div style={{ fontSize: 9, color: '#7dd87d' }}>
                  → BOQ:{' '}
                  {myLinks
                    .map((l) => boqItems[l.boqItemId]?.code ?? '?')
                    .join(', ')}
                </div>
              )}
            </div>
            <span
              style={{
                textAlign: 'right',
                color:
                  m.metadata && (m.metadata as Record<string, unknown>).noScale
                    ? '#e6b450'
                    : '#7dd87d',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatQuantity(m)}
            </span>
            <button
              type="button"
              title="ลบ measurement (แจ้งเตือนถ้าผูก BOQ)"
              onClick={(e) => {
                e.stopPropagation();
                deleteMeasurementWithCascade(m.id);
              }}
              style={{
                background: 'transparent',
                color: '#888',
                border: '1px solid #333',
                borderRadius: 3,
                fontSize: 11,
                cursor: 'pointer',
                padding: '1px 5px',
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// BOQ tab
// ----------------------------------------------------------------------------
function BOQTab() {
  // subscribe เป็นชิ้นๆ — ไม่สร้าง object ใหม่ (กัน infinite re-render)
  const items = useBOQStore((s) => s.items);
  const itemOrder = useBOQStore((s) => s.itemOrder);
  const links = useBOQStore((s) => s.links);
  const selectedBOQId = useBOQStore((s) => s.selectedBOQId);
  const setSelectedBOQ = useBOQStore((s) => s.setSelectedBOQ);
  const setHoverBOQ = useBOQStore((s) => s.setHoverBOQ);
  const createItem = useBOQStore((s) => s.createItem);
  const updateItem = useBOQStore((s) => s.updateItem);
  const deleteItem = useBOQStore((s) => s.deleteItem);
  const setUnitPrice = useBOQStore((s) => s.setUnitPrice);
  const linkMeasurement = useBOQStore((s) => s.linkMeasurement);
  const updateLink = useBOQStore((s) => s.updateLink);
  const unlink = useBOQStore((s) => s.unlink);

  const measurementsById = useMeasurementStore((s) => s.byId);
  const selectedMeasurementIds = useMeasurementStore((s) => s.selectedIds);
  const selectMeasurements = useMeasurementStore((s) => s.select);

  const zoomToBBox = useZoomToBBox();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showPicker, setShowPicker] = useState(false);

  const views = computeBOQViews(items, itemOrder, links, measurementsById);

  function handlePickPreset(preset: (typeof BOQ_PRESETS)[number]) {
    createItem({ ...preset, source: 'manual' });
    setShowPicker(false);
  }
  function handleAddBlank() {
    createItem({
      code: 'NEW-' + Date.now().toString(36).slice(-4).toUpperCase(),
      description: 'รายการใหม่',
      workCategory: 'other',
      unit: 'm',
      source: 'manual',
    });
    setShowPicker(false);
  }

  function handleRowClick(view: BOQItem) {
    setSelectedBOQ(view.id);
    // หาก measurement ที่ผูก
    const mids = view.links.map((l) => l.measurementId).filter((id) => measurementsById[id]);
    if (mids.length === 0) return;
    selectMeasurements(mids);
    // zoom ไป bbox รวม
    const ms = mids.map((id) => measurementsById[id]!).filter(Boolean);
    const bbox = combinedBBox(ms);
    if (bbox) zoomToBBox(bbox);
  }

  function handleLinkSelected(boqId: string) {
    if (selectedMeasurementIds.length === 0) {
      window.alert('เลือก measurement บน canvas/ตาราง Measurements ก่อน — แล้วกดปุ่มนี้อีกครั้ง');
      return;
    }
    const boq = items[boqId];
    if (!boq) return;
    for (const mid of selectedMeasurementIds) {
      const m = measurementsById[mid];
      if (!m) continue;
      // กัน link ซ้ำ (same boq+measurement)
      const exists = links.find((l) => l.boqItemId === boqId && l.measurementId === mid);
      if (exists) continue;
      linkMeasurement(mid, boqId, 1, undefined, defaultFormulaIdFor(m));
    }
    setExpanded((s) => ({ ...s, [boqId]: true }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: 8,
          borderBottom: '1px solid #2a2a2a',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          style={{
            background: '#284a7a',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            padding: '4px 8px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          + Add BOQ
        </button>
      </div>

      {showPicker && (
        <div
          style={{
            padding: 8,
            background: '#1a1a1a',
            borderBottom: '1px solid #2a2a2a',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>เลือก preset:</div>
          {BOQ_PRESETS.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => handlePickPreset(p)}
              style={{
                background: '#1f1f1f',
                color: '#ddd',
                border: '1px solid #333',
                borderRadius: 3,
                padding: '4px 6px',
                fontSize: 11,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <b>{p.code}</b> · {p.description}{' '}
              <span style={{ color: '#888' }}>({p.unit})</span>
            </button>
          ))}
          <button
            type="button"
            onClick={handleAddBlank}
            style={{
              background: '#1f1f1f',
              color: '#aaa',
              border: '1px dashed #444',
              borderRadius: 3,
              padding: '4px 6px',
              fontSize: 11,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            + รายการเปล่า (กรอกเอง)
          </button>
        </div>
      )}

      {views.length === 0 && !showPicker && (
        <p style={{ padding: 12, fontSize: 12, color: '#888' }}>
          ยังไม่มี BOQ — กด "+ Add BOQ" เพื่อสร้างรายการ แล้วเลือก measurement บน canvas → กด
          "Link Selected" เพื่อผูก
        </p>
      )}

      {views.map((v) => {
        const isSelected = selectedBOQId === v.id;
        const isExpanded = expanded[v.id] === true;
        // ผูกกับ measurement ที่ถูกเลือกอยู่ → highlight อ่อน (two-way: canvas→BOQ row)
        const linkedToSelection =
          !isSelected &&
          selectedMeasurementIds.length > 0 &&
          v.links.some((l) => selectedMeasurementIds.includes(l.measurementId));
        return (
          <div
            key={v.id}
            onMouseEnter={() => setHoverBOQ(v.id)}
            onMouseLeave={() => setHoverBOQ(null)}
            style={{
              borderBottom: '1px solid #1f1f1f',
              background: isSelected ? '#243d63' : linkedToSelection ? '#1f2a3a' : 'transparent',
              borderLeft: isSelected
                ? '3px solid #ff9e3d'
                : linkedToSelection
                  ? '3px solid #5b9dff'
                  : '3px solid transparent',
            }}
          >
            <div
              onClick={() => handleRowClick(v)}
              style={{
                display: 'grid',
                gridTemplateColumns: '70px 1fr 78px 28px',
                gap: 4,
                padding: '6px 8px',
                alignItems: 'start',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <input
                type="text"
                value={v.code}
                onChange={(e) => updateItem(v.id, { code: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'transparent',
                  color: '#5b9dff',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  outline: 'none',
                  padding: 0,
                  width: '100%',
                  minWidth: 0,
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                <input
                  type="text"
                  value={v.description}
                  onChange={(e) => updateItem(v.id, { description: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'transparent',
                    color: '#ddd',
                    border: 'none',
                    fontSize: 11,
                    outline: 'none',
                    padding: 0,
                    width: '100%',
                    minWidth: 0,
                  }}
                />
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 10 }}>
                  <select
                    value={v.workCategory}
                    onChange={(e) =>
                      updateItem(v.id, { workCategory: e.target.value as WorkCategory })
                    }
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: '#1f1f1f',
                      color: '#888',
                      border: '1px solid #2a2a2a',
                      fontSize: 9,
                      borderRadius: 2,
                    }}
                  >
                    <option value="structure">structure</option>
                    <option value="architecture">architecture</option>
                    <option value="mep">mep</option>
                    <option value="other">other</option>
                  </select>
                  <select
                    value={v.unit}
                    onChange={(e) => updateItem(v.id, { unit: e.target.value as BOQUnit })}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: '#1f1f1f',
                      color: '#888',
                      border: '1px solid #2a2a2a',
                      fontSize: 9,
                      borderRadius: 2,
                    }}
                  >
                    <option value="m">m</option>
                    <option value="m2">m²</option>
                    <option value="m3">m³</option>
                    <option value="ea">ea</option>
                    <option value="set">set</option>
                  </select>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span style={{ color: '#7dd87d', fontSize: 11, fontWeight: 600 }}>
                  {v.quantity.toFixed(v.unit === 'ea' || v.unit === 'set' ? 0 : 3)}
                </span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="ราคา/หน่วย"
                  value={v.unitPrice ?? ''}
                  onChange={(e) =>
                    setUnitPrice(v.id, e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: '#1f1f1f',
                    color: '#ddd',
                    border: '1px solid #2a2a2a',
                    fontSize: 10,
                    padding: '1px 3px',
                    borderRadius: 2,
                    width: 64,
                    textAlign: 'right',
                  }}
                />
                <span style={{ color: '#e6b450', fontSize: 10 }}>
                  {v.amount != null ? v.amount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (v.links.length > 0) {
                    if (!window.confirm(`ลบ BOQ "${v.code}" จะลบ link ${v.links.length} เส้น — ยืนยัน?`)) return;
                  }
                  deleteItem(v.id);
                }}
                style={{
                  background: 'transparent',
                  color: '#888',
                  border: '1px solid #333',
                  borderRadius: 3,
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '1px 5px',
                  height: 22,
                }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                padding: '0 8px 6px',
                fontSize: 10,
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLinkSelected(v.id);
                }}
                title={`ผูก measurement ที่เลือก (${selectedMeasurementIds.length}) เข้ากับ BOQ นี้`}
                style={{
                  background: '#1f1f1f',
                  color: selectedMeasurementIds.length > 0 ? '#7dd87d' : '#666',
                  border: '1px solid #333',
                  borderRadius: 2,
                  padding: '2px 6px',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                + Link selected ({selectedMeasurementIds.length})
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((s) => ({ ...s, [v.id]: !s[v.id] }));
                }}
                style={{
                  background: 'transparent',
                  color: '#888',
                  border: '1px solid #333',
                  borderRadius: 2,
                  padding: '2px 6px',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                {isExpanded ? '▾' : '▸'} links ({v.links.length})
              </button>
              <span style={{ color: '#555' }}>·</span>
              <span style={{ color: '#666' }}>{v.source}</span>
            </div>
            {isExpanded && v.links.length > 0 && (
              <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {v.links.map((l) => {
                  const m = measurementsById[l.measurementId];
                  const stored = links.find((x) => x.id === l.id);
                  if (!stored) return null;
                  return (
                    <div
                      key={l.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '36px 1fr 48px 48px 60px 24px',
                        gap: 4,
                        alignItems: 'center',
                        fontSize: 10,
                        background: '#1a1a1a',
                        border: '1px solid #2a2a2a',
                        borderRadius: 2,
                        padding: '3px 5px',
                      }}
                    >
                      <span style={{ color: '#888' }}>
                        {m ? typeBadge(m.type) : '?'}
                      </span>
                      <span style={{ color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m ? `${formatQuantity(m)}${m.label ? ` · ${m.label}` : ''}` : '(orphan)'}
                      </span>
                      <FactorInput
                        value={stored.factor}
                        title="factor (ตัวคูณ)"
                        onChange={(v) => updateLink(l.id, { factor: v })}
                      />
                      <FactorInput
                        value={stored.wasteFactor ?? 0}
                        title="waste (0.05 = +5%)"
                        onChange={(v) => updateLink(l.id, { wasteFactor: v === 0 ? undefined : v })}
                      />
                      <span style={{ color: '#7dd87d', textAlign: 'right' }}>
                        {l.quantityContribution.toFixed(3)}
                      </span>
                      <button
                        type="button"
                        onClick={() => unlink(l.id)}
                        title="ยกเลิกลิงก์"
                        style={{
                          background: 'transparent',
                          color: '#888',
                          border: '1px solid #333',
                          borderRadius: 2,
                          fontSize: 10,
                          cursor: 'pointer',
                          padding: '0 3px',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FactorInput({
  value,
  onChange,
  title,
}: {
  value: number;
  onChange: (v: number) => void;
  title?: string;
}) {
  return (
    <input
      type="number"
      step="0.01"
      value={value}
      title={title}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      style={{
        background: '#1f1f1f',
        color: '#ddd',
        border: '1px solid #2a2a2a',
        fontSize: 10,
        padding: '1px 3px',
        borderRadius: 2,
        textAlign: 'right',
        width: '100%',
        minWidth: 0,
      }}
    />
  );
}


// ----------------------------------------------------------------------------
// AI tab (spec §12.4)
// ----------------------------------------------------------------------------
function AITab() {
  const suggestions = useAIStore((s) => s.suggestions);
  const isRunning = useAIStore((s) => s.isRunning);
  const lastError = useAIStore((s) => s.lastError);
  const lastReviewedAt = useAIStore((s) => s.lastReviewedAt);
  const clearSuggestions = useAIStore((s) => s.clearSuggestions);
  const measurementsById = useMeasurementStore((s) => s.byId);
  const selectMeasurements = useMeasurementStore((s) => s.select);
  const setSelectedBOQ = useBOQStore((s) => s.setSelectedBOQ);
  const zoomToBBox = useZoomToBBox();

  if (isRunning) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: "#aaa" }}>
        AI กำลังตรวจสอบ payload… (mock)
      </div>
    );
  }

  if (lastError) {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            background: "#3a1f1f",
            color: "#ff8b6b",
            border: "1px solid #8a3838",
            borderRadius: 4,
            padding: 8,
            fontSize: 12,
          }}
        >
          <b>AI service error</b>
          <div style={{ marginTop: 4, color: "#e6b450" }}>{lastError}</div>
          <div style={{ marginTop: 4, fontSize: 10, color: "#888" }}>
            core measurement/BOQ ยังทำงานปกติ — กด AI Review อีกครั้งได้
          </div>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <p style={{ padding: 12, fontSize: 12, color: "#888" }}>
        ยังไม่ได้ตรวจ — กดปุ่ม <b>AI Review</b> ที่ toolbar เพื่อส่ง payload (mock)
      </p>
    );
  }

  function focusSuggestion(s: AISuggestionRecord) {
    const mids = s.targetMeasurementIds ?? [];
    if (mids.length > 0) {
      selectMeasurements(mids);
      const ms = mids.map((id) => measurementsById[id]).filter((x): x is Measurement => !!x);
      const bbox = combinedBBox(ms);
      if (bbox) zoomToBBox(bbox);
    }
    if (s.targetBoqItemIds && s.targetBoqItemIds.length > 0) {
      setSelectedBOQ(s.targetBoqItemIds[0]!);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "6px 8px",
          borderBottom: "1px solid #2a2a2a",
          fontSize: 11,
          color: "#888",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>ตรวจล่าสุด: {lastReviewedAt ? new Date(lastReviewedAt).toLocaleTimeString() : "—"}</span>
        <button
          type="button"
          onClick={clearSuggestions}
          style={{
            background: "transparent",
            color: "#888",
            border: "1px solid #333",
            borderRadius: 3,
            fontSize: 10,
            padding: "2px 6px",
            cursor: "pointer",
          }}
        >
          ล้าง
        </button>
      </div>
      {suggestions.map((s) => (
        <SuggestionRow key={s.id} sg={s} onFocus={focusSuggestion} />
      ))}
    </div>
  );
}

function severityColor(sev: AISeverity): { bg: string; fg: string; border: string } {
  if (sev === "critical") return { bg: "#3a1f1f", fg: "#ff8b6b", border: "#8a3838" };
  if (sev === "warning") return { bg: "#3a311f", fg: "#e6b450", border: "#8a6838" };
  return { bg: "#1f2a3a", fg: "#5b9dff", border: "#385a8a" };
}

function SuggestionRow({
  sg,
  onFocus,
}: {
  sg: AISuggestionRecord;
  onFocus: (s: AISuggestionRecord) => void;
}) {
  const palette = severityColor(sg.severity);
  const isResolved = sg.status !== "pending";
  const opacity = isResolved ? 0.55 : 1;
  return (
    <div
      onClick={() => onFocus(sg)}
      style={{
        borderBottom: "1px solid #1f1f1f",
        padding: "8px 10px",
        background: palette.bg,
        borderLeft: `3px solid ${palette.border}`,
        cursor: "pointer",
        opacity,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          marginBottom: 3,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            background: palette.border,
            color: "#fff",
            fontSize: 9,
            padding: "1px 4px",
            borderRadius: 2,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {sg.severity}
        </span>
        <span style={{ color: "#999", fontSize: 10 }}>
          {SUGGESTION_TYPE_LABEL[sg.type]} · conf {Math.round(sg.confidence * 100)}%
        </span>
        {sg.status === "accepted" && (
          <span style={{ color: "#7dd87d", fontSize: 10 }}>
            ✓ accepted{sg.createdBOQItemId ? ` → ${sg.createdBOQItemId.slice(-6)}` : ""}
          </span>
        )}
        {sg.status === "rejected" && (
          <span style={{ color: "#888", fontSize: 10 }}>✕ rejected</span>
        )}
      </div>
      <div style={{ color: palette.fg, fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
        {sg.title}
      </div>
      <div style={{ color: "#ccc", fontSize: 11, lineHeight: 1.4 }}>{sg.message}</div>
      {sg.proposedBoqItem && (
        <div
          style={{
            marginTop: 4,
            padding: 4,
            background: "rgba(0,0,0,0.25)",
            border: "1px dashed #444",
            borderRadius: 3,
            fontSize: 10,
            color: "#aaa",
          }}
        >
          เสนอ: <b>{sg.proposedBoqItem.code}</b> · {sg.proposedBoqItem.description}{" "}
          ({sg.proposedBoqItem.unit})
        </div>
      )}
      {!isResolved && (
        <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              acceptSuggestion(sg.id);
            }}
            style={{
              background: "#284a7a",
              color: "#fff",
              border: "1px solid #5b9dff",
              borderRadius: 3,
              fontSize: 11,
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            Accept
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              rejectSuggestion(sg.id);
            }}
            style={{
              background: "transparent",
              color: "#888",
              border: "1px solid #444",
              borderRadius: 3,
              fontSize: 11,
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

