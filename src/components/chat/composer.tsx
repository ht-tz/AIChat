"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
  Send,
  Paperclip,
  Mic,
  Bot,
  Square,
  Check,
  Wrench,
  Loader2,
  Cpu,
  ChevronDown,
  Settings,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSettingsStore,
  TOOL_DISPLAY,
  MODEL_OPTIONS,
  getModelById,
  getAllModels,
} from "@/stores/settings";
import { FileAttachmentCard } from "./file-attachment-card";
import type { Attachment } from "@/lib/types";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";

interface ComposerProps {
  onSend: (data: { text: string; attachments: Attachment[] }) => void;
  onStop?: () => void;
  streaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  sessionId?: string;
}

export function Composer({
  onSend,
  onStop,
  streaming,
  disabled,
  placeholder = "输入消息…（Enter 发送，Shift+Enter 换行）",
  sessionId,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [showTools, setShowTools] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const modelPopoverRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enabledTools = useSettingsStore((s) => s.enabledTools);
  const toggleTool = useSettingsStore((s) => s.toggleTool);
  const setEnabledTools = useSettingsStore((s) => s.setEnabledTools);
  const modelId = useSettingsStore((s) => s.modelId);
  const setModel = useSettingsStore((s) => s.setModel);
  const customModels = useSettingsStore((s) => s.customModels);
  const modelKeysMap = useSettingsStore((s) => s.modelApiKeys);
  const serverConfigs = useSettingsStore((s) => s.serverConfigs);
  const isLoggedIn = useSettingsStore((s) => s.isLoggedIn);
  const router = useRouter();

  const allModels = getAllModels(customModels);
  const currentModel = getModelById(modelId, customModels);
  const modelHasKey = useMemo(() => {
    if (modelId === "mock-default") return true;
    if (isLoggedIn) return !!serverConfigs[modelId]?.hasKey;
    return !!(modelKeysMap[modelId] || (currentModel?.custom && currentModel.apiKey));
  }, [modelId, isLoggedIn, serverConfigs, modelKeysMap, currentModel]);

  const modelGroups = useMemo(() => {
    const map = new Map<string, typeof MODEL_OPTIONS>();
    for (const m of allModels) {
      const v = m.custom ? "自定义" : (m.vendor ?? "其他");
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(m);
    }
    return Array.from(map.entries()).map(([vendor, models]) => ({ vendor, models }));
  }, [allModels]);

  const enabledCount = useMemo(() => enabledTools.length, [enabledTools]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    if (!showTools) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowTools(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTools]);

  useEffect(() => {
    if (!showModelSelector) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modelPopoverRef.current && !modelPopoverRef.current.contains(e.target as Node)) {
        setShowModelSelector(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showModelSelector]);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (sessionId) {
          formData.append("sessionId", sessionId);
        }

        const res = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }

        const data = await res.json();
        const newAttachment: Attachment = {
          id: nanoid(),
          type: data.fileType === "image" ? "image" : "file",
          name: data.originalName,
          url: data.url,
          mimeType: data.mimeType,
          size: data.size,
          fileId: data.id,
        };
        setAttachments((prev) => [...prev, newAttachment]);
      } catch (err) {
        console.error("[composer] upload error:", err);
        alert(err instanceof Error ? err.message : "上传失败");
      } finally {
        setUploading(false);
      }
    },
    [sessionId],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      Array.from(files).forEach(uploadFile);
      e.target.value = "";
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;
      Array.from(files).forEach(uploadFile);
    },
    [uploadFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const submit = () => {
    if ((!value.trim() && attachments.length === 0) || streaming || uploading) return;
    onSend({ text: value.trim(), attachments });
    setValue("");
    setAttachments([]);
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  };

  const canSubmit = (value.trim().length > 0 || attachments.length > 0) && !streaming && !uploading;

  return (
    <div className="border-t border-cyber-border bg-cyber-bg/50 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            "glass flex flex-col gap-2 rounded-2xl border-cyber-border/50 p-2 transition-all",
            isDragging && "border-cyber-cyan/60 bg-cyber-cyan/5 shadow-neon",
            !isDragging && "focus-within:border-cyber-cyan/60 focus-within:shadow-neon",
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-2 pt-1">
              {attachments.map((att) => (
                <FileAttachmentCard
                  key={att.id}
                  attachment={att}
                  onRemove={() => removeAttachment(att.id)}
                />
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="relative flex items-center gap-1 pb-1" ref={popoverRef}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="text/*,image/*,.pdf,.json,.md,.js,.ts,.jsx,.tsx,.html,.css,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                className="rounded-md p-2 text-cyber-muted transition-colors hover:bg-cyber-surface/60 hover:text-cyber-cyan disabled:opacity-40"
                title="添加附件"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || uploading}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Paperclip className="size-4" />
                )}
              </button>
              <button
                className="rounded-md p-2 text-cyber-muted transition-colors hover:bg-cyber-surface/60 hover:text-cyber-cyan disabled:opacity-40"
                title="语音（规划中）"
                disabled
              >
                <Mic className="size-4" />
              </button>

              <button
                onClick={() => setShowTools((v) => !v)}
                className={cn(
                  "relative rounded-md p-2 transition-colors hover:bg-cyber-surface/60",
                  showTools || enabledCount > 0
                    ? "text-cyber-cyan"
                    : "text-cyber-muted hover:text-cyber-cyan",
                )}
                title={`工具（已启用 ${enabledCount}/${TOOL_DISPLAY.length}）`}
              >
                <Bot className="size-4" />
                {enabledCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-cyber-cyan font-mono text-[8px] font-bold text-cyber-bg">
                    {enabledCount}
                  </span>
                )}
              </button>

              {showTools && (
                <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-xl border border-cyber-border bg-cyber-surface/95 p-3 shadow-neon backdrop-blur-xl">
                  <div className="mb-2 flex items-center gap-2 border-b border-cyber-border/60 pb-2">
                    <Wrench className="size-3.5 text-cyber-cyan" />
                    <span className="text-xs font-semibold text-cyber-text">可用工具</span>
                    <span className="ml-auto text-[10px] text-cyber-muted">
                      {enabledCount}/{TOOL_DISPLAY.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {TOOL_DISPLAY.map((t) => {
                      const enabled = enabledTools.includes(t.name);
                      return (
                        <button
                          key={t.name}
                          onClick={() => toggleTool(t.name)}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                            enabled
                              ? "bg-cyber-cyan/10 text-cyber-text"
                              : "text-cyber-muted hover:bg-cyber-surface/60",
                          )}
                        >
                          <span className="font-mono text-xs">{t.icon}</span>
                          <span className="flex-1 text-xs">{t.label}</span>
                          <span
                            className={cn(
                              "flex size-4 items-center justify-center rounded border transition-colors",
                              enabled
                                ? "border-cyber-cyan bg-cyber-cyan/30 text-cyber-cyan"
                                : "border-cyber-border/60",
                            )}
                          >
                            {enabled && <Check className="size-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-cyber-border/60 pt-2">
                    <button
                      onClick={() => setEnabledTools(TOOL_DISPLAY.map((t) => t.name))}
                      className="text-[10px] text-cyber-muted transition-colors hover:text-cyber-cyan"
                    >
                      全部启用
                    </button>
                    <button
                      onClick={() => setEnabledTools([])}
                      className="text-[10px] text-cyber-muted transition-colors hover:text-cyber-magenta"
                    >
                      全部禁用
                    </button>
                  </div>
                </div>
              )}
            </div>

            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-cyber-text placeholder:text-cyber-muted/60 focus:outline-none disabled:opacity-50"
            />

            <div className="flex items-center gap-1 pb-1" ref={modelPopoverRef}>
              <div className="relative">
                <button
                  onClick={() => setShowModelSelector((v) => !v)}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-all",
                    currentModel?.provider === "mock"
                      ? "text-cyber-muted hover:bg-cyber-surface/60 hover:text-cyber-text"
                      : !modelHasKey
                        ? "text-cyber-amber/80 hover:bg-cyber-amber/10 hover:text-cyber-amber"
                        : "text-cyber-cyan/80 hover:bg-cyber-cyan/10 hover:text-cyber-cyan",
                  )}
                  title={
                    currentModel
                      ? `${currentModel.vendor} · ${currentModel.label}${currentModel.custom ? "（自定义）" : ""}`
                      : "选择模型"
                  }
                >
                  <Cpu className="size-3.5" />
                  <span className="max-w-[80px] truncate">{currentModel?.label || "选择模型"}</span>
                  <ChevronDown
                    className={cn("size-3 transition-transform", showModelSelector && "rotate-180")}
                  />
                </button>

                {showModelSelector && (
                  <div className="absolute bottom-full right-0 z-30 mb-2 max-h-[420px] w-64 overflow-y-auto rounded-xl border border-cyber-border bg-cyber-surface/95 shadow-neon backdrop-blur-xl">
                    <div className="sticky top-0 flex items-center gap-2 border-b border-cyber-border/60 bg-cyber-surface/95 px-3 py-2 backdrop-blur-xl">
                      <Cpu className="size-3.5 text-cyber-cyan" />
                      <span className="text-xs font-semibold text-cyber-text">选择模型</span>
                      {!modelHasKey && currentModel?.provider !== "mock" && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-cyber-amber">
                          <Settings className="size-3" />
                          需配置 Key
                        </span>
                      )}
                    </div>
                    <div className="p-1">
                      {modelGroups.map(({ vendor, models }) => (
                        <div key={vendor} className="mb-1 last:mb-0">
                          <div className="flex items-center justify-between px-2 py-1">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-cyber-muted/70">
                              {vendor}
                            </span>
                            {vendor === "自定义" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowModelSelector(false);
                                  router.push("/settings");
                                }}
                                className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-cyber-muted transition-colors hover:bg-cyber-surface/60 hover:text-cyber-cyan"
                                title="管理自定义模型"
                              >
                                <Plus className="size-2.5" />
                                管理
                              </button>
                            )}
                          </div>
                          {models.map((m) => {
                            const isSelected = m.id === modelId;
                            return (
                              <button
                                key={m.id}
                                onClick={() => {
                                  setModel(m.id);
                                  setShowModelSelector(false);
                                }}
                                className={cn(
                                  "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                                  isSelected
                                    ? "bg-cyber-cyan/15 text-cyber-cyan"
                                    : "text-cyber-text/80 hover:bg-cyber-surface/60 hover:text-cyber-text",
                                )}
                              >
                                <span className="flex-1 truncate">
                                  {m.label}
                                  {m.custom && (
                                    <span className="ml-1 text-[9px] text-cyber-lime/70">✦</span>
                                  )}
                                </span>
                                {isSelected && <Check className="size-3.5 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowModelSelector(false);
                          router.push("/settings");
                        }}
                        className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-cyber-border/60 px-2 py-2 text-[10px] text-cyber-muted transition-colors hover:border-cyber-cyan/50 hover:text-cyber-cyan"
                      >
                        <Plus className="size-3" />
                        添加自定义模型
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {streaming ? (
                <button
                  onClick={onStop}
                  className="flex size-9 items-center justify-center rounded-md bg-cyber-danger/20 text-cyber-danger transition-all hover:bg-cyber-danger/30"
                  title="停止"
                >
                  <Square className="size-4" />
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  className="btn-glow flex size-9 items-center justify-center rounded-md bg-gradient-to-br from-cyber-cyan via-cyber-purple to-cyber-magenta text-white shadow-neon transition-all hover:scale-105 disabled:from-cyber-surface disabled:via-cyber-surface disabled:to-cyber-surface disabled:text-cyber-muted disabled:shadow-none"
                  title="发送"
                >
                  <Send className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-cyber-muted/60">
          <span>按 Enter 发送 · Shift+Enter 换行 · 支持拖拽上传文件/图片</span>
          <span className="flex items-center gap-2">
            {currentModel && (
              <span className="flex items-center gap-1">
                <Cpu className="size-3" />
                {currentModel.vendor} · {currentModel.label}
                {currentModel.custom && <span className="text-cyber-lime/70">✦</span>}
              </span>
            )}
            {currentModel?.provider !== "mock" && !modelHasKey && (
              <span className="text-cyber-amber/80">（需在设置页配置 API Key）</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
