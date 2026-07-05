"use client";

import { ChevronDown, ChevronUp, Brain, Wrench } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session";

/**
 * 思考过程面板 —— 从当前活跃会话的最后一条助手消息中读取 thoughts 和 toolCalls
 */
export function ThoughtPanel() {
  const [open, setOpen] = useState(false);

  const thoughts = useSessionStore((s) => {
    const session = s.activeId ? s.sessions[s.activeId] : null;
    if (!session) return [];
    const lastAssistant = [...session.messages].reverse().find((m) => m.role === "assistant");
    return lastAssistant?.thoughts ?? [];
  });

  const toolCalls = useSessionStore((s) => {
    const session = s.activeId ? s.sessions[s.activeId] : null;
    if (!session) return [];
    const lastAssistant = [...session.messages].reverse().find((m) => m.role === "assistant");
    return lastAssistant?.toolCalls ?? [];
  });

  const hasContent = thoughts.length > 0 || toolCalls.length > 0;

  return (
    <div className="border-b border-cyber-border/40 bg-cyber-surface/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-1.5 text-[10px] text-cyber-muted transition-colors hover:text-cyber-cyan"
      >
        <span className="flex items-center gap-1.5">
          <Brain className="size-3" />
          思考过程（{thoughts.length > 0 ? "有推理" : "无"} / {toolCalls.length} 工具）
        </span>
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open && (
        <div className="px-4 pb-3">
          {!hasContent ? (
            <p className="text-[10px] italic text-cyber-muted/60">
              当前对话暂无推理过程。使用支持推理的模型（如
              DeepSeek-R1）发起对话后，此处会展示思考链。
            </p>
          ) : (
            <div className="space-y-2 text-xs text-cyber-muted">
              {thoughts.length > 0 && (
                <div className="border-l-2 border-cyber-purple/40 pl-2">
                  <span className="flex items-center gap-1 text-cyber-purple">
                    <Brain className="size-3" /> 推理过程
                  </span>
                  <div className="prose-cyber mt-1 max-h-40 overflow-y-auto text-[11px]">
                    {thoughts.join("")}
                  </div>
                </div>
              )}
              {toolCalls.map((tc, i) => (
                <div key={`t-${i}`} className="border-l-2 border-cyber-magenta/40 pl-2">
                  <span className="flex items-center gap-1 text-cyber-magenta">
                    <Wrench className="size-3" /> {tc.name}
                  </span>
                  <span
                    className={cn(
                      "ml-2 text-[10px]",
                      tc.status === "running"
                        ? "text-cyber-cyan"
                        : tc.status === "success"
                          ? "text-cyber-lime"
                          : tc.status === "error"
                            ? "text-cyber-magenta"
                            : "text-cyber-muted",
                    )}
                  >
                    [{tc.status}]
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
