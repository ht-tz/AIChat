"use client";

import { useState, memo, type ReactNode, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import Image from "next/image";
import {
  Copy,
  Check,
  RefreshCw,
  User,
  Bot,
  Loader2,
  ChevronDown,
  ChevronRight,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolCallCard } from "./tool-call-card";
import { FileAttachmentCard } from "./file-attachment-card";
import { PlanTodoList, ReflectionCard } from "@/components/agent/plan-todo";
import { MermaidDiagram } from "@/components/ui/mermaid-diagram";
import type { Message } from "@/lib/types";

function extractText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractText((children as ReactElement).props.children);
  }
  return "";
}

// 模块级常量：避免每次渲染创建新引用导致 ReactMarkdown 缓存失效
const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHighlight];
const MD_COMPONENTS = {
  code: ({ className, children, ...props }: any) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="rounded bg-cyber-purple/20 px-1.5 py-0.5 font-mono text-xs text-cyber-purple"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }: any) => {
    const codeEl = children as ReactElement;
    if (codeEl?.props?.className?.includes("language-mermaid")) {
      const code = extractText(codeEl.props.children);
      return <MermaidDiagram code={code} />;
    }
    return (
      <pre className="mb-4 overflow-x-auto rounded-lg border border-cyber-border bg-cyber-bg/80 p-4 text-sm">
        {children}
      </pre>
    );
  },
};

/** 推理过程展示卡片 */
function ThinkingCard({ thoughts, streaming }: { thoughts: string[]; streaming?: boolean }) {
  const [expanded, setExpanded] = useState(streaming ?? false);
  const content = thoughts.join("");

  if (!content) return null;

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-cyber-purple/20 bg-cyber-purple/5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs text-cyber-purple transition-colors hover:bg-cyber-purple/10"
      >
        {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <Brain className="size-3" />
        <span className="font-medium">思考过程</span>
        <span className="ml-auto text-[10px] text-cyber-muted">
          {streaming ? "推理中…" : `${content.length} 字`}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-cyber-purple/10 px-3 py-2">
          <div className="prose-cyber max-h-80 overflow-y-auto text-xs leading-relaxed text-cyber-muted">
            <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onRegenerate?: () => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming,
  onRegenerate,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const plans = message.plans ?? [];
  const reflections = message.reflections ?? [];
  const attachments = message.attachments ?? [];
  const thoughts = message.thoughts ?? [];

  return (
    <div className={cn("group flex w-full gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-gradient-to-br from-cyber-cyan to-cyber-purple"
            : "border border-cyber-cyan/30 bg-cyber-surface/60",
        )}
      >
        {isUser ? (
          <User className="size-4 text-white" />
        ) : (
          <Bot className="size-4 text-cyber-cyan" />
        )}
      </div>

      <div className={cn("flex max-w-[85%] flex-col gap-2", isUser ? "items-end" : "items-start")}>
        {attachments.length > 0 && (
          <div className={cn("flex flex-wrap gap-2", isUser ? "justify-end" : "justify-start")}>
            {attachments.map((att) =>
              att.type === "image" ? (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-cyber-border transition-transform hover:scale-[1.02]"
                >
                  <Image
                    src={att.url}
                    alt={att.name}
                    width={320}
                    height={256}
                    unoptimized
                    className="max-h-64 max-w-xs object-contain"
                  />
                </a>
              ) : (
                <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer">
                  <FileAttachmentCard attachment={att} compact />
                </a>
              ),
            )}
          </div>
        )}

        <div
          className={cn(
            "relative rounded-2xl px-4 py-3 text-sm",
            isUser
              ? "border border-cyber-cyan/30 bg-gradient-to-br from-cyber-cyan/10 to-cyber-purple/10 text-cyber-text"
              : "border border-cyber-border bg-cyber-surface/40 text-cyber-text",
          )}
        >
          {!isUser && plans.length > 0 && <PlanTodoList todos={plans} streaming={isStreaming} />}

          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mb-2">
              {message.toolCalls.map((tc) => (
                <ToolCallCard key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}

          {!isUser && reflections.length > 0 && (
            <div>
              {reflections.map((r, i) => (
                <ReflectionCard key={i} reflection={r} streaming={isStreaming} />
              ))}
            </div>
          )}

          {/* 推理过程展示 */}
          {!isUser && thoughts.length > 0 && (
            <ThinkingCard thoughts={thoughts} streaming={isStreaming} />
          )}

          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : (
            <div
              className={cn(
                "prose-cyber max-w-none",
                isStreaming &&
                  message.content === "" &&
                  message.toolCalls?.length === 0 &&
                  attachments.length === 0 &&
                  thoughts.length === 0 &&
                  "shimmer h-12 rounded-md",
              )}
            >
              {message.content === "" &&
              isStreaming &&
              (message.toolCalls?.length ?? 0) === 0 &&
              plans.length === 0 &&
              attachments.length === 0 &&
              thoughts.length === 0 ? (
                <span className="inline-flex items-center gap-2 text-cyber-muted">
                  <Loader2 className="size-3.5 animate-spin" />
                  思考中…
                </span>
              ) : message.content || (isStreaming && thoughts.length > 0) ? (
                <>
                  <ReactMarkdown
                    remarkPlugins={REMARK_PLUGINS}
                    rehypePlugins={REHYPE_PLUGINS}
                    components={MD_COMPONENTS}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {isStreaming && (
                    <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse-neon bg-cyber-cyan" />
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        {!isUser && !isStreaming && message.content && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-cyber-muted transition-colors hover:bg-cyber-surface/60 hover:text-cyber-cyan"
            >
              {copied ? (
                <>
                  <Check className="size-3" /> 已复制
                </>
              ) : (
                <>
                  <Copy className="size-3" /> 复制
                </>
              )}
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-cyber-muted transition-colors hover:bg-cyber-surface/60 hover:text-cyber-cyan"
              >
                <RefreshCw className="size-3" /> 重新生成
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
