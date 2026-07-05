"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";
import { Sparkles } from "lucide-react";
import type { Attachment } from "@/lib/types";

interface MessageListProps {
  streaming?: boolean;
  onExampleClick?: (data: { text: string; attachments: Attachment[] }) => void;
  onRegenerate?: () => void;
}

export function MessageList({ streaming, onExampleClick, onRegenerate }: MessageListProps) {
  // P0 优化：精确 selector，只订阅当前会话的 messages，避免其他会话变化触发重渲染
  const messages = useSessionStore((s) => {
    const session = s.activeId ? s.sessions[s.activeId] : null;
    return session?.messages ?? [];
  });
  const hasSession = useSessionStore((s) => !!s.activeId);
  const modelId = useSettingsStore((s) => s.modelId);
  const containerRef = useRef<HTMLDivElement>(null);

  const messagesLength = messages.length;
  const lastContent = messages[messages.length - 1]?.content;

  // P2 优化：流式时用 requestAnimationFrame 节流滚动，避免每帧都执行
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (streaming) {
      const raf = requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
      return () => cancelAnimationFrame(raf);
    }

    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesLength, lastContent, streaming]);

  if (!hasSession || messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyber-cyan/20 via-cyber-purple/20 to-cyber-magenta/20 shadow-neon">
          <Sparkles className="size-8 animate-pulse-neon text-cyber-cyan" />
        </div>
        <h2 className="text-gradient mb-2 font-display text-2xl font-semibold">开始一段对话</h2>
        <p className="max-w-md text-sm text-cyber-muted">
          当前模型：<span className="text-cyber-cyan">{modelId}</span>
          <br />
          试着输入「你好」「画一张赛博朋克图片」看效果
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {["你好", "画一张赛博朋克城市夜景", "现在几点", "帮我规划一次前端学习路线"].map((q) => (
            <button
              key={q}
              onClick={() => onExampleClick?.({ text: q, attachments: [] })}
              disabled={streaming}
              className="rounded-full border border-cyber-border bg-cyber-surface/40 px-3 py-1.5 text-xs text-cyber-text transition-all hover:border-cyber-cyan hover:shadow-neon disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            message={m}
            isStreaming={streaming && i === messages.length - 1 && m.role === "assistant"}
            onRegenerate={
              i === messages.length - 1 && m.role === "assistant" ? onRegenerate : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
