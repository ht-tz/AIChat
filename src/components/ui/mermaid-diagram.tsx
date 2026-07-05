"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
  code: string;
  className?: string;
}

export function MermaidDiagram({ code, className }: MermaidDiagramProps) {
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    if (!code.trim()) return;
    let cancelled = false;
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "strict",
          fontFamily: "var(--font-inter), sans-serif",
          themeVariables: {
            primaryColor: "#1e3a5f",
            primaryTextColor: "#e6e8f2",
            primaryBorderColor: "#00f0ff",
            lineColor: "#b14eff",
            secondaryColor: "#11131f",
            tertiaryColor: "#161827",
            noteBkgColor: "#11131f",
            noteTextColor: "#e6e8f2",
            noteBorderColor: "#00f0ff",
            textColor: "#e6e8f2",
            mainBkg: "#11131f",
            nodeBorder: "#00f0ff",
            clusterBkg: "#0a0b14",
            clusterBorder: "#22253a",
            titleColor: "#00f0ff",
            edgeLabelBackground: "#11131f",
          },
        });
        const result = await mermaid.render(id, code.trim());
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className={`rounded-lg border border-red-500/30 bg-red-500/5 p-3 ${className ?? ""}`}>
        <p className="mb-1 text-xs font-medium text-red-400">Mermaid 渲染失败</p>
        <pre className="overflow-x-auto text-[11px] text-red-300/80">{error}</pre>
        <pre className="mt-2 overflow-x-auto text-[11px] text-cyber-muted">{code}</pre>
      </div>
    );
  }

  return (
    <div
      className={`mermaid-diagram my-4 flex justify-center overflow-x-auto rounded-lg border border-cyber-border/50 bg-cyber-surface/30 p-4 ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
