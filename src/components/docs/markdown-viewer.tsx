"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { MermaidDiagram } from "@/components/ui/mermaid-diagram";
import type { ReactNode, ReactElement } from "react";

function extractText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractText((children as ReactElement).props.children);
  }
  return "";
}

interface MarkdownViewerProps {
  content: string;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="markdown-body prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ ...props }) => (
            <h1
              className="text-gradient mb-4 mt-2 border-b border-cyber-border pb-2 text-2xl font-bold"
              {...props}
            />
          ),
          h2: ({ ...props }) => (
            <h2 className="mb-3 mt-8 text-xl font-semibold text-cyber-cyan" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="mb-2 mt-6 text-lg font-medium text-cyber-text" {...props} />
          ),
          h4: ({ ...props }) => (
            <h4 className="mb-2 mt-4 text-base font-medium text-cyber-text" {...props} />
          ),
          p: ({ ...props }) => <p className="mb-4 leading-7 text-cyber-text/90" {...props} />,
          ul: ({ ...props }) => (
            <ul className="mb-4 ml-6 list-disc space-y-1 text-cyber-text/90" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="mb-4 ml-6 list-decimal space-y-1 text-cyber-text/90" {...props} />
          ),
          li: ({ ...props }) => <li className="leading-7" {...props} />,
          a: ({ ...props }) => (
            <a
              className="text-cyber-cyan underline decoration-cyber-cyan/30 transition-colors hover:decoration-cyber-cyan"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          blockquote: ({ ...props }) => (
            <blockquote
              className="mb-4 border-l-4 border-cyber-cyan/50 bg-cyber-cyan/5 py-2 pl-4 italic text-cyber-muted"
              {...props}
            />
          ),
          code: ({ className, children, ...props }) => {
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
          pre: ({ children }) => {
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
          table: ({ ...props }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          th: ({ ...props }) => (
            <th
              className="border border-cyber-border bg-cyber-surface/60 px-3 py-2 text-left font-medium text-cyber-cyan"
              {...props}
            />
          ),
          td: ({ ...props }) => (
            <td className="border border-cyber-border px-3 py-2 text-cyber-text/90" {...props} />
          ),
          hr: ({ ...props }) => <hr className="my-6 border-cyber-border" {...props} />,
          strong: ({ ...props }) => <strong className="font-semibold text-cyber-text" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
