import { create } from 'zustand';
import type { ViewTransform } from '../types';

export const IDENTITY_TRANSFORM: ViewTransform = {
  zoom: 1,
  panX: 0,
  panY: 0,
  rotationDeg: 0,
};

type ViewportState = {
  /** transform per-page (เก็บค่า zoom/pan ของแต่ละหน้าแยก เพราะแต่ละหน้ามีขนาดต่างกัน) */
  byPageId: Record<string, ViewTransform>;

  getTransform: (pageId: string | null) => ViewTransform;
  setTransform: (pageId: string, t: ViewTransform) => void;
  /** auto-fit หน้าแบบเข้า container — รักษาอัตราส่วนภาพ */
  fit: (pageId: string, containerW: number, containerH: number, pageW: number, pageH: number) => void;
  /** zoom anchor ที่จุดบน screen (เช่นตำแหน่งเมาส์) — ทำให้จุดใต้เมาส์อยู่กับที่ */
  zoomAt: (pageId: string, factor: number, anchorScreenX: number, anchorScreenY: number) => void;
  /** เลื่อน pan (screen pixels) */
  panBy: (pageId: string, dxScreen: number, dyScreen: number) => void;
};

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 40;
const FIT_PADDING = 0.95; // เหลือขอบ 5%

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const useViewportStore = create<ViewportState>((set, get) => ({
  byPageId: {},

  getTransform: (pageId) => {
    if (!pageId) return IDENTITY_TRANSFORM;
    return get().byPageId[pageId] ?? IDENTITY_TRANSFORM;
  },

  setTransform: (pageId, t) =>
    set((s) => ({ byPageId: { ...s.byPageId, [pageId]: t } })),

  fit: (pageId, containerW, containerH, pageW, pageH) => {
    if (pageW <= 0 || pageH <= 0 || containerW <= 0 || containerH <= 0) return;
    const zoom = Math.min(containerW / pageW, containerH / pageH) * FIT_PADDING;
    const panX = (containerW - pageW * zoom) / 2;
    const panY = (containerH - pageH * zoom) / 2;
    set((s) => ({
      byPageId: { ...s.byPageId, [pageId]: { zoom, panX, panY, rotationDeg: 0 } },
    }));
  },

  zoomAt: (pageId, factor, anchorScreenX, anchorScreenY) => {
    const prev = get().byPageId[pageId] ?? IDENTITY_TRANSFORM;
    const newZoom = clampZoom(prev.zoom * factor);
    if (newZoom === prev.zoom) return;
    // keep point under cursor: anchorScreen = page * newZoom + newPan
    //   page = (anchorScreen - prev.pan) / prev.zoom
    //   newPan = anchorScreen - page * newZoom
    const pageX = (anchorScreenX - prev.panX) / prev.zoom;
    const pageY = (anchorScreenY - prev.panY) / prev.zoom;
    const panX = anchorScreenX - pageX * newZoom;
    const panY = anchorScreenY - pageY * newZoom;
    set((s) => ({
      byPageId: { ...s.byPageId, [pageId]: { zoom: newZoom, panX, panY, rotationDeg: 0 } },
    }));
  },

  panBy: (pageId, dxScreen, dyScreen) => {
    const prev = get().byPageId[pageId] ?? IDENTITY_TRANSFORM;
    set((s) => ({
      byPageId: {
        ...s.byPageId,
        [pageId]: { ...prev, panX: prev.panX + dxScreen, panY: prev.panY + dyScreen },
      },
    }));
  },
}));
