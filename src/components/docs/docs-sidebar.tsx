"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, BookOpen, FileText, Folder, BookMarked } from "lucide-react";
import { useState } from "react";
import type { DocCategory } from "@/server/docs-service";

interface DocsSidebarProps {
  categories: DocCategory[];
}

const categoryIcons: Record<string, typeof BookOpen> = {
  requirements: FileText,
  learning: BookOpen,
  handoff: BookMarked,
};

export function DocsSidebar({ categories }: DocsSidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const cat of categories) {
      initial[cat.key] = true;
    }
    return initial;
  });

  const toggleCategory = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-cyber-border bg-cyber-surface/60 backdrop-blur">
      <div className="border-b border-cyber-border p-4">
        <Link
          href="/docs"
          className="flex items-center gap-2 text-sm font-semibold text-cyber-text"
        >
          <BookOpen className="size-5 text-cyber-cyan" />
          <span>学习中心</span>
        </Link>
        <p className="mt-1 text-[10px] text-cyber-muted">按里程碑组织的项目文档</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {categories.map((cat) => {
          const CatIcon = categoryIcons[cat.key] || Folder;
          const isOpen = expanded[cat.key];
          return (
            <div key={cat.key} className="mb-2">
              <button
                onClick={() => toggleCategory(cat.key)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-cyber-text transition-colors hover:bg-cyber-card"
              >
                <ChevronRight
                  className={`size-3 text-cyber-muted transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
                <CatIcon className="size-3.5 text-cyber-cyan" />
                <span>{cat.label}</span>
                <span className="ml-auto text-[10px] text-cyber-muted">{cat.docs.length}</span>
              </button>

              {isOpen && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-cyber-border/60 pl-2">
                  {cat.docs.map((doc) => {
                    const isActive =
                      pathname === `/docs/${doc.slug}` ||
                      (pathname === "/docs" && doc.slug === categories[0]?.docs[0]?.slug);
                    return (
                      <Link
                        key={doc.slug}
                        href={`/docs/${doc.slug}`}
                        className={`flex items-center gap-2 rounded-md px-2 py-1 text-[11px] transition-colors ${
                          isActive
                            ? "bg-cyber-cyan/15 text-cyber-cyan"
                            : "text-cyber-muted hover:bg-cyber-card hover:text-cyber-text"
                        }`}
                      >
                        {doc.milestone && (
                          <span
                            className={`shrink-0 rounded px-1 py-0.5 font-mono text-[9px] ${
                              isActive
                                ? doc.labelType === "tech"
                                  ? "bg-cyber-lime/20 text-cyber-lime"
                                  : "bg-cyber-cyan/20 text-cyber-cyan"
                                : doc.labelType === "tech"
                                  ? "bg-cyber-lime/10 text-cyber-lime"
                                  : doc.labelType === "numbered"
                                    ? "bg-cyber-amber/10 text-cyber-amber"
                                    : "bg-cyber-purple/10 text-cyber-purple"
                            }`}
                          >
                            {doc.milestone}
                          </span>
                        )}
                        <span className="truncate">{doc.shortTitle}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-cyber-border p-3">
        <Link
          href="/"
          className="flex items-center justify-center gap-1.5 rounded-md border border-cyber-border bg-cyber-bg/40 px-3 py-1.5 text-[11px] text-cyber-muted transition-colors hover:border-cyber-cyan/50 hover:text-cyber-cyan"
        >
          ← 返回对话
        </Link>
      </div>
    </aside>
  );
}
