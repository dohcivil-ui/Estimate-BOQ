/**
 * AI store — analyses + suggestions per page
 * v2: items[] + mode + detected result + 'auto' support
 */
import { create } from 'zustand';
import type {
  AIAnalysis,
  AIAnalysisResponse,
  AIChatMessage,
  AIConversation,
  AIDetectResult,
  AIDiscipline,
  AIItem,
  AIMode,
  AISuggestion,
  AISuggestionStatus,
} from '@/types/ai';

interface AIState {
  analyses: AIAnalysis[];
  suggestions: AISuggestion[];
  conversations: AIConversation[];
  busyPageId: string | null;
  /** กำลังส่ง chat อยู่หรือเปล่า (per analysisId) */
  chatBusyAnalysisId: string | null;

  startAnalyze: (pageId: string, hd: boolean, mode: AIMode) => string;
  completeAnalyze: (
    analysisId: string,
    discipline: AIDiscipline,
    result: AIAnalysisResponse,
    raw: string,
    meta: {
      model: string;
      elapsedMs: number;
      tokens?: { in?: number; out?: number };
      detected?: AIDetectResult;
    },
  ) => void;
  failAnalyze: (analysisId: string, error: string) => void;

  setSuggestionStatus: (id: string, status: AISuggestionStatus) => void;
  setSuggestionEdited: (id: string, edited: Partial<AIItem>) => void;
  setSuggestionCreatedBoq: (id: string, boqIds: string[]) => void;

  // ─── chat actions ─────────────────────────────────────────────────────
  setChatBusy: (analysisId: string | null) => void;
  appendChatMessage: (analysisId: string, msg: AIChatMessage) => void;
  setChatMessageApplied: (analysisId: string, messageId: string) => void;
  /** Apply ผลใหม่จาก chat → แทนที่ result + rebuild suggestions */
  applyChatResult: (analysisId: string, result: AIAnalysisResponse) => void;

  removeAnalysesForPage: (pageId: string) => void;
  clearAll: () => void;
}

const uid = (): string => crypto.randomUUID();

export const useAIStore = create<AIState>((set) => ({
  analyses: [],
  suggestions: [],
  conversations: [],
  busyPageId: null,
  chatBusyAnalysisId: null,

  startAnalyze: (pageId, hd, mode) => {
    const id = uid();
    set((s) => ({
      busyPageId: pageId,
      analyses: [
        ...s.analyses,
        {
          id,
          pageId,
          mode,
          // discipline ชั่วคราว ใช้ mode ถ้าไม่ใช่ auto, ไม่งั้น default = 'structural'
          // จะถูก overwrite ใน completeAnalyze
          discipline:
            mode === 'auto' ? ('structural' as AIDiscipline) : mode,
          status: 'pending',
          hd,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    return id;
  },

  completeAnalyze: (analysisId, discipline, result, raw, meta) =>
    set((s) => {
      const idx = s.analyses.findIndex((a) => a.id === analysisId);
      if (idx === -1) return s;
      const a = s.analyses[idx]!;
      const updated: AIAnalysis = {
        ...a,
        discipline,
        status: 'success',
        result,
        raw,
        model: meta.model,
        elapsedMs: meta.elapsedMs,
        tokens: meta.tokens,
        detected: meta.detected,
      };
      const newAnalyses = s.analyses.slice();
      newAnalyses[idx] = updated;

      const newSugs: AISuggestion[] = result.items.map((item) => ({
        id: uid(),
        pageId: a.pageId,
        analysisId,
        discipline,
        item,
        status: 'pending',
      }));

      const filteredOldSugs = s.suggestions.filter(
        (sg) => sg.analysisId !== analysisId,
      );

      // เริ่ม conversation ว่างผูกกับ analysis นี้
      const filteredOldConvs = s.conversations.filter(
        (c) => c.analysisId !== analysisId,
      );
      const newConv: AIConversation = {
        analysisId,
        pageId: a.pageId,
        messages: [],
      };

      return {
        analyses: newAnalyses,
        suggestions: [...filteredOldSugs, ...newSugs],
        conversations: [...filteredOldConvs, newConv],
        busyPageId: s.busyPageId === a.pageId ? null : s.busyPageId,
      };
    }),

  failAnalyze: (analysisId, error) =>
    set((s) => {
      const idx = s.analyses.findIndex((a) => a.id === analysisId);
      if (idx === -1) return s;
      const updated = { ...s.analyses[idx]!, status: 'error' as const, error };
      const newAnalyses = s.analyses.slice();
      newAnalyses[idx] = updated;
      return {
        analyses: newAnalyses,
        busyPageId: s.busyPageId === updated.pageId ? null : s.busyPageId,
      };
    }),

  setSuggestionStatus: (id, status) =>
    set((s) => {
      const idx = s.suggestions.findIndex((sg) => sg.id === id);
      if (idx === -1) return s;
      const newList = s.suggestions.slice();
      newList[idx] = { ...newList[idx]!, status };
      return { suggestions: newList };
    }),

  setSuggestionEdited: (id, edited) =>
    set((s) => {
      const idx = s.suggestions.findIndex((sg) => sg.id === id);
      if (idx === -1) return s;
      const newList = s.suggestions.slice();
      const cur = newList[idx]!;
      newList[idx] = { ...cur, edited: { ...cur.edited, ...edited } };
      return { suggestions: newList };
    }),

  setSuggestionCreatedBoq: (id, boqIds) =>
    set((s) => {
      const idx = s.suggestions.findIndex((sg) => sg.id === id);
      if (idx === -1) return s;
      const newList = s.suggestions.slice();
      newList[idx] = { ...newList[idx]!, createdBoqIds: boqIds };
      return { suggestions: newList };
    }),

  setChatBusy: (analysisId) => set({ chatBusyAnalysisId: analysisId }),

  appendChatMessage: (analysisId, msg) =>
    set((s) => {
      const idx = s.conversations.findIndex((c) => c.analysisId === analysisId);
      if (idx === -1) {
        // ไม่มี conversation — สร้างใหม่
        const a = s.analyses.find((x) => x.id === analysisId);
        if (!a) return s;
        return {
          conversations: [
            ...s.conversations,
            { analysisId, pageId: a.pageId, messages: [msg] },
          ],
        };
      }
      const newList = s.conversations.slice();
      newList[idx] = {
        ...newList[idx]!,
        messages: [...newList[idx]!.messages, msg],
      };
      return { conversations: newList };
    }),

  setChatMessageApplied: (analysisId, messageId) =>
    set((s) => {
      const idx = s.conversations.findIndex((c) => c.analysisId === analysisId);
      if (idx === -1) return s;
      const newList = s.conversations.slice();
      newList[idx] = {
        ...newList[idx]!,
        messages: newList[idx]!.messages.map((m) =>
          m.id === messageId ? { ...m, applied: true } : m,
        ),
      };
      return { conversations: newList };
    }),

  applyChatResult: (analysisId, result) =>
    set((s) => {
      const aIdx = s.analyses.findIndex((a) => a.id === analysisId);
      if (aIdx === -1) return s;
      const a = s.analyses[aIdx]!;
      const newAnalyses = s.analyses.slice();
      newAnalyses[aIdx] = { ...a, result };

      // rebuild suggestions
      const newSugs: AISuggestion[] = result.items.map((item) => ({
        id: uid(),
        pageId: a.pageId,
        analysisId,
        discipline: a.discipline,
        item,
        status: 'pending',
      }));
      const filteredOldSugs = s.suggestions.filter(
        (sg) => sg.analysisId !== analysisId,
      );

      return {
        analyses: newAnalyses,
        suggestions: [...filteredOldSugs, ...newSugs],
      };
    }),

  removeAnalysesForPage: (pageId) =>
    set((s) => ({
      analyses: s.analyses.filter((a) => a.pageId !== pageId),
      suggestions: s.suggestions.filter((sg) => sg.pageId !== pageId),
      conversations: s.conversations.filter((c) => c.pageId !== pageId),
    })),

  clearAll: () =>
    set({
      analyses: [],
      suggestions: [],
      conversations: [],
      busyPageId: null,
      chatBusyAnalysisId: null,
    }),
}));

export const useConversationFor = (
  analysisId: string | null,
): AIConversation | null =>
  useAIStore((s) =>
    analysisId
      ? (s.conversations.find((c) => c.analysisId === analysisId) ?? null)
      : null,
  );

export const useLatestAnalysisForPage = (
  pageId: string | null,
): AIAnalysis | null =>
  useAIStore((s) => {
    if (!pageId) return null;
    const list = s.analyses.filter((a) => a.pageId === pageId);
    return list.length > 0 ? (list[list.length - 1] ?? null) : null;
  });

export const useSuggestionsForAnalysis = (
  analysisId: string | null,
): AISuggestion[] =>
  useAIStore((s) =>
    analysisId ? s.suggestions.filter((sg) => sg.analysisId === analysisId) : [],
  );
