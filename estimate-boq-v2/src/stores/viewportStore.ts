/**
 * Viewport transform per-page — port จาก Track A
 * แต่ละหน้ามี zoom/pan ของตัวเอง (เพราะขนาดหน้าแตกต่างกัน)
 */
import { create } from 'zustand';
import type { ViewTransform } from '@/types/viewport';

export const IDENTITY_TRANSFORM: ViewTransform = {
  zoom: 1,
  panX: 0,
  panY: 0,
  rotationDeg: 0,
};

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 40;
const FIT_PADDING = 0.95;

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

interface ViewportState {
  byPageId: Record<string, ViewTransform>;

  getTransform: (pageId: string | null) => ViewTransform;
  setTransform: (pageId: string, t: ViewTransform) => void;

  fit: (
    pageId: string,
    containerW: number,
    containerH: number,
    pageW: number,
    pageH: number,
  ) => void;

  zoomAt: (
    pageId: string,
    factor: number,
    anchorScreenX: number,
    anchorScreenY: number,
  ) => void;

  zoomTo: (
    pageId: string,
    targetZoom: number,
    anchorScreenX: number,
    anchorScreenY: number,
  ) => void;

  panBy: (pageId: string, dxScreen: number, dyScreen: number) => void;

  reset: (pageId: string) => void;
}

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
      byPageId: {
        ...s.byPageId,
        [pageId]: { zoom, panX, panY, rotationDeg: 0 },
      },
    }));
  },

  zoomAt: (pageId, factor, anchorScreenX, anchorScreenY) => {
    const prev = get().byPageId[pageId] ?? IDENTITY_TRANSFORM;
    const newZoom = clampZoom(prev.zoom * factor);
    if (newZoom === prev.zoom) return;
    const pageX = (anchorScreenX - prev.panX) / prev.zoom;
    const pageY = (anchorScreenY - prev.panY) / prev.zoom;
    const panX = anchorScreenX - pageX * newZoom;
    const panY = anchorScreenY - pageY * newZoom;
    set((s) => ({
      byPageId: {
        ...s.byPageId,
        [pageId]: { zoom: newZoom, panX, panY, rotationDeg: prev.rotationDeg },
      },
    }));
  },

  zoomTo: (pageId, targetZoom, anchorScreenX, anchorScreenY) => {
    const prev = get().byPageId[pageId] ?? IDENTITY_TRANSFORM;
    const newZoom = clampZoom(targetZoom);
    if (newZoom === prev.zoom) return;
    const pageX = (anchorScreenX - prev.panX) / prev.zoom;
    const pageY = (anchorScreenY - prev.panY) / prev.zoom;
    const panX = anchorScreenX - pageX * newZoom;
    const panY = anchorScreenY - pageY * newZoom;
    set((s) => ({
      byPageId: {
        ...s.byPageId,
        [pageId]: { zoom: newZoom, panX, panY, rotationDeg: prev.rotationDeg },
      },
    }));
  },

  panBy: (pageId, dxScreen, dyScreen) => {
    const prev = get().byPageId[pageId] ?? IDENTITY_TRANSFORM;
    set((s) => ({
      byPageId: {
        ...s.byPageId,
        [pageId]: {
          ...prev,
          panX: prev.panX + dxScreen,
          panY: prev.panY + dyScreen,
        },
      },
    }));
  },

  reset: (pageId) =>
    set((s) => {
      const next = { ...s.byPageId };
      delete next[pageId];
      return { byPageId: next };
    }),
}));

/** hook สำหรับใช้กับ active page โดยตรง */
export const useTransformFor = (pageId: string | null): ViewTransform =>
  useViewportStore((s) =>
    pageId ? (s.byPageId[pageId] ?? IDENTITY_TRANSFORM) : IDENTITY_TRANSFORM,
  );
