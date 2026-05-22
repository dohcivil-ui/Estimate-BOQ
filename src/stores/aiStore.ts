// src/stores/aiStore.ts — เก็บ AI suggestions + status (pending/accepted/rejected)
// Golden Rule #5: AI ห้ามแก้ BOQ เอง — ทุก mutation ของ BOQ ผ่าน user accept/reject เท่านั้น
import { create } from 'zustand';
import type { AISuggestion, AISuggestionRecord, AIReviewRequest } from '../types';

type AIState = {
  /** suggestions ปัจจุบัน (ของ review รอบล่าสุด) */
  suggestions: AISuggestionRecord[];
  /** payload ที่ส่งล่าสุด — เก็บไว้ debug + Ask More ในอนาคต */
  lastRequest: AIReviewRequest | null;
  /** error message ถ้า adapter พัง — UI โชว์ใน AI panel เท่านั้น (§16.1) */
  lastError: string | null;
  /** กำลังเรียก adapter อยู่หรือเปล่า */
  isRunning: boolean;
  /** timestamp ของ review รอบล่าสุด (สำหรับโชว์ "ตรวจล่าสุด HH:MM") */
  lastReviewedAt: string | null;

  /** เริ่ม review — ล้าง error และ set isRunning */
  beginReview: (req: AIReviewRequest) => void;
  /** review เสร็จสำเร็จ → ใส่ suggestions ทั้งหมดเป็น 'pending' */
  finishReview: (suggestions: AISuggestion[]) => void;
  /** review พัง → เก็บ error message (suggestions เดิมยังอยู่หรือเคลียร์ก็ได้ — ที่นี่เคลียร์) */
  failReview: (errorMessage: string) => void;

  /** มาร์ค suggestion ว่า accepted/rejected — caller (acceptSuggestion fn) ทำงาน side-effect แยก */
  markStatus: (id: string, status: 'accepted' | 'rejected', createdBOQItemId?: string) => void;
  clearSuggestions: () => void;
};

export const useAIStore = create<AIState>((set) => ({
  suggestions: [],
  lastRequest: null,
  lastError: null,
  isRunning: false,
  lastReviewedAt: null,

  beginReview: (req) =>
    set({
      isRunning: true,
      lastError: null,
      lastRequest: req,
    }),

  finishReview: (suggestions) =>
    set({
      isRunning: false,
      lastReviewedAt: new Date().toISOString(),
      suggestions: suggestions.map((s) => ({ ...s, status: 'pending' })),
    }),

  failReview: (errorMessage) =>
    set({
      isRunning: false,
      lastError: errorMessage,
      suggestions: [],
      lastReviewedAt: new Date().toISOString(),
    }),

  markStatus: (id, status, createdBOQItemId) =>
    set((s) => ({
      suggestions: s.suggestions.map((sg) =>
        sg.id === id
          ? {
              ...sg,
              status,
              resolvedAt: new Date().toISOString(),
              ...(createdBOQItemId !== undefined && { createdBOQItemId }),
            }
          : sg,
      ),
    })),

  clearSuggestions: () =>
    set({ suggestions: [], lastError: null, lastReviewedAt: null, lastRequest: null }),
}));
