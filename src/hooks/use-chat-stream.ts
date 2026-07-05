"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentStep, Message, Attachment } from "@/lib/types";
import { nanoid } from "nanoid";

export type StreamEvent = AgentStep | { kind: "open" } | { kind: "close" };

export interface StreamOptions {
  onEvent?: (event: AgentStep) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: string) => void;
}

export function useChatStream() {
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStreaming(false);
  }, []);

  const start = useCallback(
    async (opts: {
      url?: string;
      body: {
        messages: Array<{ role: Message["role"]; content: string; attachments?: Attachment[] }>;
        model?: string;
        temperature?: number;
        enablePlan?: boolean;
        enableReflection?: boolean;
        requireHITL?: string[];
        enabledTools?: string[];
        maxToolRounds?: number;
        sessionId?: string;
        apiKey?: string;
        baseUrl?: string;
      };
      handlers?: StreamOptions;
    }) => {
      const { url = "/api/chat", body, handlers } = opts;
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      setStreaming(true);
      handlers?.onOpen?.();

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const err = await res.text();
          handlers?.onError?.(err || `HTTP ${res.status}`);
          setStreaming(false);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            for (const line of block.split("\n")) {
              if (line.startsWith("data:")) {
                const payload = line.slice(5).trim();
                if (!payload) continue;
                try {
                  const event: AgentStep = JSON.parse(payload);
                  handlers?.onEvent?.(event);
                  if (process.env.NODE_ENV === "development") {
                    console.debug("[sse]", event);
                  }
                } catch (err) {
                  console.warn("[sse] parse error", err, payload);
                }
              }
            }
          }
        }
        handlers?.onClose?.();
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          handlers?.onClose?.();
        } else {
          handlers?.onError?.((err as Error).message);
        }
      } finally {
        setStreaming(false);
        controllerRef.current = null;
      }
    },
    [],
  );

  return { streaming, start, stop };
}

export function newAssistantPlaceholder(): Message {
  return {
    id: nanoid(),
    role: "assistant",
    content: "",
    createdAt: Date.now(),
  };
}
