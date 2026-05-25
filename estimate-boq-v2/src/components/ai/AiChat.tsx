/**
 * AI Chat — chat bubbles + input
 * ส่ง follow-up ไป Qwen → ถ้าได้ JSON ใหม่ → ปุ่ม "ใช้ผลนี้" ให้ user apply
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useActivePage } from '@/stores/drawingStore';
import { useDrawingStore } from '@/stores/drawingStore';
import {
  useAIStore,
  useConversationFor,
  useLatestAnalysisForPage,
} from '@/stores/aiStore';
import { useAIReferenceStore } from '@/stores/aiReferenceStore';
import { buildUserMessage, sendChatMessage } from '@/services/aiChat';
import { buildReferenceImage } from '@/services/aiAnalyze';
import type { AIChatMessage, AIReferenceImage } from '@/types/ai';

const EXAMPLES = [
  '"F2 คือกระเบื้องกันลื่น ไม่ใช่ขัดมัน"',
  '"ดูรายการวัสดุหน้า 1 ก่อนแล้ววิเคราะห์ใหม่"',
  '"เพิ่มเสาเอ็นรอบช่องเปิดทุกช่อง"',
  '"ผนังนอกใช้อิฐมอญ ไม่ใช่มวลเบา"',
  '"นับประตู-หน้าต่างใหม่ คิดว่าตกบ้านหน้าหนึ่ง"',
];

export function AiChat() {
  const page = useActivePage();
  const latest = useLatestAnalysisForPage(page?.id ?? null);
  const conversation = useConversationFor(latest?.id ?? null);
  const chatBusy = useAIStore(
    (s) => s.chatBusyAnalysisId === (latest?.id ?? '__none__'),
  );
  const setChatBusy = useAIStore((s) => s.setChatBusy);
  const appendChatMessage = useAIStore((s) => s.appendChatMessage);
  const setChatMessageApplied = useAIStore((s) => s.setChatMessageApplied);
  const applyChatResult = useAIStore((s) => s.applyChatResult);

  const allPages = useDrawingStore((s) => s.pages);
  const files = useDrawingStore((s) => s.files);
  const refIds = useAIReferenceStore((s) => s.pageIds);

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // scroll to bottom เมื่อมีข้อความใหม่
  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [conversation?.messages.length]);

  const referenceImages = useMemo<AIReferenceImage[]>(() => {
    if (refIds.length === 0) return [];
    const out: AIReferenceImage[] = [];
    for (const id of refIds.slice(0, 3)) {
      const p = allPages.find((x) => x.id === id);
      if (!p || !p.bitmap) continue;
      const f = files.find((x) => x.id === p.fileId);
      try {
        out.push(
          buildReferenceImage({
            pageId: p.id,
            bitmap: p.bitmap,
            pageNum: p.pageNumber,
            label: f?.name ?? '—',
          }),
        );
      } catch (err) {
        console.warn('[ai-chat] ref image fail:', err);
      }
    }
    return out;
  }, [refIds, allPages, files]);

  if (!latest || !latest.result) {
    return (
      <div className="rounded border border-bg-border bg-bg-raised p-3 text-center text-xs text-ink-muted">
        💬 Chat — จะใช้ได้หลังกดวิเคราะห์ครั้งแรก
      </div>
    );
  }

  const handleSend = async () => {
    const text = input.trim();
    if (!text || chatBusy) return;
    if (!page) return;

    setError(null);
    const userMsg = buildUserMessage(text);
    appendChatMessage(latest.id, userMsg);
    setInput('');
    setChatBusy(latest.id);

    try {
      const conv = conversation ?? {
        analysisId: latest.id,
        pageId: latest.pageId,
        messages: [userMsg],
      };
      const res = await sendChatMessage({
        analysis: latest,
        conversation: conv,
        targetBitmap: page.bitmap,
        referenceImages,
        userMessage: text,
      });
      appendChatMessage(latest.id, res.assistantMessage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      appendChatMessage(latest.id, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `⚠️ ส่งไม่สำเร็จ: ${msg}`,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setChatBusy(null);
    }
  };

  const handleApply = (msg: AIChatMessage) => {
    if (!msg.parsedResult) return;
    if (!confirm(`ใช้ผลใหม่นี้แทนผลปัจจุบัน (${msg.parsedResult.items.length} items)?`)) return;
    applyChatResult(latest.id, msg.parsedResult);
    setChatMessageApplied(latest.id, msg.id);
  };

  const messages = conversation?.messages ?? [];

  return (
    <div className="rounded border border-bg-border bg-bg-raised">
      <h4 className="border-b border-bg-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
        💬 สั่งงาน AI เพิ่มเติม
      </h4>

      {/* bubbles */}
      <div
        ref={scrollerRef}
        className="max-h-72 space-y-1.5 overflow-y-auto p-2 text-xs"
      >
        {messages.length === 0 ? (
          <div className="space-y-1 px-2 py-2 text-[11px] leading-relaxed text-ink-muted">
            <p className="font-semibold text-ink-secondary">💡 ตัวอย่างคำสั่ง:</p>
            {EXAMPLES.map((e, i) => (
              <p key={i}>• {e}</p>
            ))}
          </div>
        ) : (
          messages.map((m) => (
            <ChatBubble key={m.id} msg={m} onApply={() => handleApply(m)} />
          ))
        )}
        {chatBusy && (
          <div className="flex items-center gap-2 rounded border border-bg-border bg-bg-base px-2 py-1.5 text-ink-secondary">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-bg-border border-t-accent" />
            🤖 AI กำลังตอบ…
          </div>
        )}
      </div>

      {error && (
        <div className="mx-2 mb-2 rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
          {error}
        </div>
      )}

      {/* input */}
      <div className="flex items-end gap-1.5 border-t border-bg-border p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !chatBusy) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder='พิมพ์คำสั่ง เช่น "F2 คือกระเบื้องกันลื่น"... (Enter ส่ง, Shift+Enter ขึ้นบรรทัด)'
          rows={2}
          disabled={chatBusy}
          className="flex-1 resize-none rounded border border-bg-border bg-bg-base px-2 py-1.5 text-xs text-ink-primary outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={chatBusy || !input.trim()}
          className="shrink-0 rounded bg-accent px-2 py-2 text-sm font-medium text-ink-inverse hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          title="ส่ง (Enter)"
        >
          📤
        </button>
      </div>
    </div>
  );
}

function ChatBubble({
  msg,
  onApply,
}: {
  msg: AIChatMessage;
  onApply: () => void;
}) {
  const isUser = msg.role === 'user';
  const time = new Date(msg.createdAt).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isUser) {
    return (
      <div className="ml-auto max-w-[85%] rounded-lg border border-sky-500/30 bg-sky-500/5 px-2 py-1.5">
        <div className="mb-0.5 flex items-center gap-1 text-[10px] text-ink-muted">
          <span>🧑 คุณ</span>
          <span>·</span>
          <span>{time}</span>
        </div>
        <p className="whitespace-pre-wrap text-ink-primary">{msg.content}</p>
      </div>
    );
  }

  // assistant
  const hasResult = !!msg.parsedResult;
  const itemCount = msg.parsedResult?.items.length ?? 0;
  const isAnswer = msg.content.includes('"answer"') && !hasResult;

  return (
    <div className="mr-auto max-w-[90%] rounded-lg border border-success/30 bg-success/5 px-2 py-1.5">
      <div className="mb-0.5 flex items-center gap-1 text-[10px] text-ink-muted">
        <span>🤖 AI</span>
        <span>·</span>
        <span>{time}</span>
        {msg.applied && (
          <span className="ml-1 rounded bg-success/20 px-1 text-success">
            ✓ ใช้แล้ว
          </span>
        )}
      </div>

      {hasResult ? (
        <div className="space-y-1">
          <p className="text-ink-primary">
            ส่งผลใหม่กลับมา: <span className="font-semibold text-success">{itemCount} items</span>
          </p>
          {msg.parsedResult?.items.slice(0, 3).map((it, i) => (
            <p key={i} className="truncate text-[11px] text-ink-secondary">
              • {it.name} — {it.quantity} {it.unit}
            </p>
          ))}
          {itemCount > 3 && (
            <p className="text-[11px] text-ink-muted">
              ...อีก {itemCount - 3} รายการ
            </p>
          )}
          {!msg.applied && (
            <button
              type="button"
              onClick={onApply}
              className="mt-1 rounded bg-accent px-2 py-1 text-[11px] font-medium text-ink-inverse hover:bg-accent-hover"
            >
              ✅ ใช้ผลนี้ (แทนผลปัจจุบัน)
            </button>
          )}
        </div>
      ) : isAnswer ? (
        <p className="whitespace-pre-wrap text-ink-primary">{extractAnswer(msg.content)}</p>
      ) : (
        <pre className="overflow-x-auto whitespace-pre-wrap text-[10px] text-ink-secondary">
          {msg.content.slice(0, 500)}
          {msg.content.length > 500 && '…'}
        </pre>
      )}
    </div>
  );
}

function extractAnswer(raw: string): string {
  try {
    const m = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const txt = m ? m[1]! : raw;
    const obj = JSON.parse(txt);
    if (obj && typeof obj.answer === 'string') return obj.answer;
  } catch {
    // ignore
  }
  return raw;
}
