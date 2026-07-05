"use client";

import { Composer } from "@/components/chat/composer";
import { MessageList } from "@/components/chat/message-list";
import { ThoughtPanel } from "@/components/chat/thought-panel";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore, getModelById } from "@/stores/settings";
import { useChatStream } from "@/hooks/use-chat-stream";
import { nanoid } from "nanoid";
import { useRef } from "react";
import type { Message, ToolCallRecord, PlanItem, Attachment } from "@/lib/types";
import { newAssistantPlaceholder } from "@/hooks/use-chat-stream";

export function ChatContainer() {
  const activeId = useSessionStore((s) => s.activeId);
  const sessions = useSessionStore((s) => s.sessions);
  const appendMessage = useSessionStore((s) => s.appendMessage);
  const appendToLastMessage = useSessionStore((s) => s.appendToLastMessage);
  const updateMessage = useSessionStore((s) => s.updateMessage);
  const renameSession = useSessionStore((s) => s.renameSession);
  const newSession = useSessionStore((s) => s.newSession);
  const removeLastAssistant = useSessionStore((s) => s.removeLastAssistant);

  const modelId = useSettingsStore((s) => s.modelId);
  const customModels = useSettingsStore((s) => s.customModels);
  const enabledTools = useSettingsStore((s) => s.enabledTools);

  const currentModel = getModelById(modelId, customModels);
  const effectiveModel = currentModel?.model || modelId;

  const { start, stop, streaming } = useChatStream();
  // P1 优化：rAF delta 缓冲，将每秒 20 次 store 更新合并为 60fps
  const pendingDeltaRef = useRef("");
  const deltaRafRef = useRef<number | null>(null);

  const runStream = async (sid: string, history: Message[]) => {
    const state = useSettingsStore.getState();
    const keyStatus = state.getModelKey(modelId);
    const usesServerKey = state.isLoggedIn && keyStatus === "__server__";
    const sendApiKey = usesServerKey ? undefined : keyStatus || undefined;
    const sendBaseUrl = usesServerKey ? undefined : state.getModelBaseUrl(modelId) || undefined;
    const sendTemperature = state.temperature;
    const aiMsg = newAssistantPlaceholder();
    appendMessage(sid, aiMsg);

    await start({
      body: {
        messages: history
          .filter((m) => (m.content || m.attachments?.length) && m.role !== "tool")
          .map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
        model: effectiveModel,
        temperature: sendTemperature,
        enabledTools,
        maxToolRounds: 5,
        enablePlan: true,
        enableReflection: true,
        sessionId: sid,
        apiKey: sendApiKey,
        baseUrl: sendBaseUrl,
      },
      handlers: {
        onEvent: (e) => {
          if (e.kind === "delta") {
            // P1 优化：用 rAF 合并高频 delta，减少 store 更新频率
            pendingDeltaRef.current += e.content;
            if (deltaRafRef.current === null) {
              deltaRafRef.current = requestAnimationFrame(() => {
                if (pendingDeltaRef.current) {
                  appendToLastMessage(sid, pendingDeltaRef.current);
                  pendingDeltaRef.current = "";
                }
                deltaRafRef.current = null;
              });
            }
          } else if (e.kind === "thought") {
            const cur2 = useSessionStore.getState().sessions[sid];
            const last = cur2?.messages[cur2.messages.length - 1];
            if (last) {
              const thoughts: string[] = (last.thoughts ?? []).slice();
              thoughts.push(e.content);
              updateMessage(sid, last.id, { thoughts });
            }
          } else if (e.kind === "plan") {
            const cur2 = useSessionStore.getState().sessions[sid];
            const last = cur2?.messages[cur2.messages.length - 1];
            if (last) {
              const cur: PlanItem[] = (last.plans ?? []).slice();
              for (const t of e.todos) {
                if (!cur.find((c) => c.id === t.id)) {
                  cur.push({ ...t });
                }
              }
              updateMessage(sid, last.id, { plans: cur });
            }
          } else if (e.kind === "reflection") {
            const cur2 = useSessionStore.getState().sessions[sid];
            const last = cur2?.messages[cur2.messages.length - 1];
            if (last) {
              const list = (last.reflections ?? []).slice();
              list.push({ score: e.score, critique: e.critique, revise: e.revise });
              updateMessage(sid, last.id, { reflections: list });
            }
          } else if (e.kind === "tool_call") {
            const cur2 = useSessionStore.getState().sessions[sid];
            const last = cur2?.messages[cur2.messages.length - 1];
            if (last) {
              const records: ToolCallRecord[] = (last.toolCalls ?? []).slice();
              records.push({
                id: `tc_${nanoid(8)}`,
                name: e.name,
                args: e.args,
                status: "running",
                startedAt: Date.now(),
              });
              updateMessage(sid, last.id, { toolCalls: records });
            }
          } else if (e.kind === "tool_result") {
            const cur2 = useSessionStore.getState().sessions[sid];
            const last = cur2?.messages[cur2.messages.length - 1];
            if (last && last.toolCalls) {
              const records = last.toolCalls.map((tc, idx) => {
                if (idx !== last.toolCalls!.length - 1) return tc;
                return {
                  ...tc,
                  result: e.result,
                  error: e.error,
                  status: e.error ? "error" : "success",
                  durationMs: Date.now() - tc.startedAt,
                  finishedAt: Date.now(),
                } as ToolCallRecord;
              });
              updateMessage(sid, last.id, { toolCalls: records });

              if (e.name === "generate_image" && !e.error && e.result) {
                const result = e.result as { url: string; prompt: string };
                if (result.url) {
                  const imageAttachment: Attachment = {
                    id: nanoid(),
                    type: "image",
                    name: `生成图片: ${result.prompt.slice(0, 20)}`,
                    url: result.url,
                  };
                  const currentAttachments = (last.attachments ?? []).slice();
                  currentAttachments.push(imageAttachment);
                  updateMessage(sid, last.id, { attachments: currentAttachments });
                }
              }
            }
          } else if (e.kind === "error") {
            appendToLastMessage(sid, `\n\n> ⚠️ ${e.message}`);
          }
        },
        onError: (msg) => {
          // P1 优化：flush 缓冲的 delta
          if (pendingDeltaRef.current) {
            appendToLastMessage(sid, pendingDeltaRef.current);
            pendingDeltaRef.current = "";
          }
          if (deltaRafRef.current !== null) {
            cancelAnimationFrame(deltaRafRef.current);
            deltaRafRef.current = null;
          }
          appendToLastMessage(sid, `\n\n> ⚠️ ${msg}`);
        },
      },
    });
    // P1 优化：流结束后 flush 剩余的 delta 缓冲
    if (pendingDeltaRef.current) {
      appendToLastMessage(sid, pendingDeltaRef.current);
      pendingDeltaRef.current = "";
    }
    if (deltaRafRef.current !== null) {
      cancelAnimationFrame(deltaRafRef.current);
      deltaRafRef.current = null;
    }
  };

  const handleSend = async (data: { text: string; attachments: Attachment[] }) => {
    const { text: content, attachments } = data;
    if ((!content.trim() && attachments.length === 0) || streaming) return;
    let sessionId = activeId;
    if (!sessionId || !sessions[sessionId]) {
      sessionId = newSession();
    }
    const sid = sessionId;

    const userMsg: Message = {
      id: nanoid(),
      role: "user",
      content: content.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: Date.now(),
    };
    appendMessage(sid, userMsg);

    const cur = useSessionStore.getState().sessions[sid];
    if (cur && cur.messages.length === 1) {
      const title =
        (content.trim() || "附件消息").slice(0, 30) +
        (content.trim().length > 30 || attachments.length > 0 ? "…" : "");
      renameSession(sid, title);
    }

    const history = useSessionStore.getState().sessions[sid].messages;
    await runStream(sid, history);
  };

  const handleRegenerate = async () => {
    if (streaming) return;
    const sid = activeId;
    if (!sid) return;
    const session = sessions[sid];
    if (!session) return;
    removeLastAssistant(sid);
    const history = useSessionStore.getState().sessions[sid].messages;
    if (history.length === 0) return;
    await runStream(sid, history);
  };

  return (
    <>
      <ThoughtPanel />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MessageList
          streaming={streaming}
          onExampleClick={handleSend}
          onRegenerate={handleRegenerate}
        />
        <Composer
          onSend={handleSend}
          onStop={stop}
          streaming={streaming}
          sessionId={activeId ?? undefined}
        />
      </div>
    </>
  );
}
