"use client";

import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Search,
  Plus,
  Trash2,
  Loader2,
  FileText,
  Globe,
  Database,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KnowledgeDocument {
  id: string;
  title: string;
  type: "text" | "markdown" | "url" | "database";
  source: string;
  content: string;
  totalChunks: number;
  createdAt: number;
  updatedAt: number;
}

interface SearchResult {
  context: string;
  sources: Array<{ documentId: string; title: string; similarity: number; snippet: string }>;
  query: string;
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  text: FileText,
  markdown: FileText,
  url: Globe,
  database: Database,
};

const TYPE_LABELS: Record<string, string> = {
  text: "文本",
  markdown: "Markdown",
  url: "网页",
  database: "数据库",
};

export default function KnowledgeManager() {
  const [tab, setTab] = useState<"documents" | "search" | "rag">("documents");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [activeDoc, setActiveDoc] = useState<KnowledgeDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [ragAnswer, setRagAnswer] = useState<{
    answer: string;
    sources: Array<{ documentId: string; title: string; similarity: number; snippet: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", type: "text" as const, content: "" });

  const loadDocuments = async () => {
    const res = await fetch("/api/knowledge/documents");
    const data = await res.json();
    setDocuments(data.documents || []);
  };

  useState(() => {
    loadDocuments();
  });

  const handleCreateDoc = async () => {
    if (!newDoc.title.trim() || !newDoc.content.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDoc.title,
          type: newDoc.type,
          source: "manual",
          content: newDoc.content,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setShowCreateModal(false);
        setNewDoc({ title: "", type: "text", content: "" });
        loadDocuments();
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm("确定删除该文档？")) return;
    await fetch("/api/knowledge/documents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadDocuments();
    if (activeDoc?.id === id) setActiveDoc(null);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      setSearchResults(data);
    } catch {
      setSearchResults(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRag = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      setRagAnswer(data);
    } catch {
      setRagAnswer(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-bg p-4 md:p-6">
      <div className="mb-6 flex items-center gap-3">
        <a href="/" className="text-cyber-muted transition-colors hover:text-cyber-cyan">
          <ArrowLeft className="size-5" />
        </a>
        <BookOpen className="size-5 text-cyber-cyan" />
        <h1 className="text-lg font-bold text-cyber-text">知识库管理</h1>
      </div>

      <div className="mb-6 flex gap-2">
        {(["documents", "search", "rag"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setSearchResults(null);
              setRagAnswer(null);
            }}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
              tab === t
                ? "bg-cyber-cyan/10 text-cyber-cyan shadow-neon"
                : "text-cyber-muted hover:bg-cyber-surface/40 hover:text-cyber-text",
            )}
          >
            {t === "documents" ? "文档管理" : t === "search" ? "语义搜索" : "RAG 问答"}
          </button>
        ))}
      </div>

      {tab === "documents" && (
        <div className="flex gap-4">
          <div className="glass flex-1 rounded-xl border border-cyber-border p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-cyber-text">文档列表</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 rounded-md bg-cyber-cyan/20 px-3 py-1.5 text-xs text-cyber-cyan hover:bg-cyber-cyan/30"
              >
                <Plus className="size-3.5" />
                上传文档
              </button>
            </div>

            <div className="space-y-2">
              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-cyber-muted">
                  <BookOpen className="mb-2 size-8 opacity-50" />
                  <p className="text-sm">暂无文档</p>
                  <p className="text-xs">点击上方按钮上传文档</p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => setActiveDoc(doc)}
                    className={cn(
                      "cursor-pointer rounded-lg border p-3 transition-all",
                      activeDoc?.id === doc.id
                        ? "border-cyber-cyan bg-cyber-cyan/5"
                        : "border-cyber-border hover:border-cyber-cyan/50",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = TYPE_ICONS[doc.type];
                          return <Icon className="size-4 text-cyber-cyan" />;
                        })()}
                        <div>
                          <h3 className="text-sm font-medium text-cyber-text">{doc.title}</h3>
                          <p className="text-xs text-cyber-muted">
                            {TYPE_LABELS[doc.type]} · {doc.totalChunks} 个片段 ·{" "}
                            {new Date(doc.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDoc(doc.id);
                        }}
                        className="rounded p-1 text-cyber-muted hover:text-cyber-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-cyber-muted">{doc.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {activeDoc && (
            <div className="glass w-80 rounded-xl border border-cyber-border p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-cyber-text">文档详情</h2>
                <button
                  onClick={() => setActiveDoc(null)}
                  className="text-cyber-muted hover:text-cyber-text"
                >
                  ×
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-cyber-muted">标题</span>
                  <p className="text-sm text-cyber-text">{activeDoc.title}</p>
                </div>
                <div>
                  <span className="text-xs text-cyber-muted">类型</span>
                  <p className="text-sm text-cyber-cyan">{TYPE_LABELS[activeDoc.type]}</p>
                </div>
                <div>
                  <span className="text-xs text-cyber-muted">片段数</span>
                  <p className="text-sm text-cyber-amber">{activeDoc.totalChunks}</p>
                </div>
                <div>
                  <span className="text-xs text-cyber-muted">创建时间</span>
                  <p className="text-xs text-cyber-muted">
                    {new Date(activeDoc.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-cyber-muted">更新时间</span>
                  <p className="text-xs text-cyber-muted">
                    {new Date(activeDoc.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-cyber-muted">内容预览</span>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-cyber-text">
                    {activeDoc.content}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "search" && (
        <div className="glass rounded-xl border border-cyber-border p-5">
          <h2 className="mb-3 text-sm font-semibold text-cyber-text">语义搜索</h2>
          <div className="flex gap-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="输入搜索关键词..."
              className="flex-1 rounded-lg border border-cyber-border bg-cyber-surface/50 px-3 py-2 text-sm text-cyber-text outline-none placeholder:text-cyber-muted/50 focus:border-cyber-cyan"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              className="flex items-center gap-2 rounded-lg bg-cyber-cyan/20 px-4 py-2 text-sm font-medium text-cyber-cyan hover:bg-cyber-cyan/30 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              搜索
            </button>
          </div>

          {searchResults && (
            <div className="mt-5 space-y-3">
              <h3 className="text-xs font-semibold text-cyber-muted">搜索结果</h3>
              {searchResults.sources.length > 0 ? (
                searchResults.sources.map((source) => (
                  <div
                    key={source.documentId}
                    className="rounded-lg border border-cyber-border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-cyber-text">{source.title}</span>
                      <span className="rounded bg-cyber-cyan/10 px-2 py-0.5 text-[10px] text-cyber-cyan">
                        {source.similarity}% 匹配
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-cyber-muted">{source.snippet}</p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-cyber-muted">
                  <Search className="mx-auto mb-2 size-8 opacity-50" />
                  <p className="text-sm">未找到匹配文档</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "rag" && (
        <div className="glass rounded-xl border border-cyber-border p-5">
          <h2 className="mb-3 text-sm font-semibold text-cyber-text">
            <Sparkles className="mr-2 inline size-4 text-cyber-amber" />
            RAG 问答
          </h2>
          <p className="mb-4 text-xs text-cyber-muted">
            基于知识库内容回答问题。如果知识库中没有相关信息，将直接回答。
          </p>
          <div className="flex gap-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="输入问题..."
              className="flex-1 rounded-lg border border-cyber-border bg-cyber-surface/50 px-3 py-2 text-sm text-cyber-text outline-none placeholder:text-cyber-muted/50 focus:border-cyber-cyan"
              onKeyDown={(e) => e.key === "Enter" && handleRag()}
            />
            <button
              onClick={handleRag}
              disabled={loading || !searchQuery.trim()}
              className="flex items-center gap-2 rounded-lg bg-cyber-amber/20 px-4 py-2 text-sm font-medium text-cyber-amber hover:bg-cyber-amber/30 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              提问
            </button>
          </div>

          {ragAnswer && (
            <div className="mt-5 space-y-3">
              <h3 className="text-xs font-semibold text-cyber-muted">回答</h3>
              <div className="rounded-lg border border-cyber-cyan/30 bg-cyber-cyan/5 p-3">
                <p className="whitespace-pre-wrap text-sm text-cyber-text">{ragAnswer.answer}</p>
              </div>

              {ragAnswer.sources.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold text-cyber-muted">参考来源</h3>
                  {ragAnswer.sources.map((source) => (
                    <div
                      key={source.documentId}
                      className="rounded-lg border border-cyber-border p-2"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight className="size-3 text-cyber-cyan" />
                        <span className="text-xs text-cyber-text">{source.title}</span>
                        <span className="text-[10px] text-cyber-muted">({source.similarity}%)</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass w-full max-w-lg rounded-xl border border-cyber-border p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyber-text">上传文档</h2>
            <div className="space-y-3">
              <input
                value={newDoc.title}
                onChange={(e) => setNewDoc((d) => ({ ...d, title: e.target.value }))}
                placeholder="文档标题"
                className="w-full rounded-lg border border-cyber-border bg-cyber-surface/50 px-3 py-2 text-sm text-cyber-text outline-none placeholder:text-cyber-muted/50 focus:border-cyber-cyan"
              />
              <select
                value={newDoc.type}
                onChange={(e) =>
                  setNewDoc((d) => ({ ...d, type: e.target.value as typeof newDoc.type }))
                }
                className="w-full rounded-lg border border-cyber-border bg-cyber-surface/50 px-3 py-2 text-sm text-cyber-text outline-none focus:border-cyber-cyan"
              >
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <textarea
                value={newDoc.content}
                onChange={(e) => setNewDoc((d) => ({ ...d, content: e.target.value }))}
                placeholder="文档内容..."
                rows={8}
                className="w-full resize-none rounded-lg border border-cyber-border bg-cyber-surface/50 px-3 py-2 text-sm text-cyber-text outline-none placeholder:text-cyber-muted/50 focus:border-cyber-cyan"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-md px-3 py-1.5 text-xs text-cyber-muted hover:text-cyber-text"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateDoc}
                  disabled={loading || !newDoc.title.trim() || !newDoc.content.trim()}
                  className="rounded-md bg-cyber-cyan/20 px-3 py-1.5 text-xs text-cyber-cyan hover:bg-cyber-cyan/30 disabled:opacity-50"
                >
                  {loading ? "上传中..." : "上传"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
