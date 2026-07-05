import { notFound } from "next/navigation";
import { docsService } from "@/server/docs-service";
import { MarkdownViewer } from "@/components/docs/markdown-viewer";
import { Calendar, User, CheckCircle } from "lucide-react";

interface DocPageProps {
  params: {
    slug: string[];
  };
}

export function generateStaticParams() {
  const categories = docsService.getCategories();
  const params: Array<{ slug: string[] }> = [];
  for (const cat of categories) {
    for (const doc of cat.docs) {
      params.push({ slug: doc.slug.split("/") });
    }
  }
  return params;
}

export default function DocPage({ params }: DocPageProps) {
  const slug = params.slug.join("/");
  const result = docsService.getDocContent(slug);

  if (!result) {
    notFound();
  }

  const { content, doc } = result;

  const milestoneMatch = content.match(/\*\*里程碑\*\*[：:]\s*(M\d+)/);
  const statusMatch = content.match(/\*\*状态\*\*[：:]\s*(.+)/);
  const dateMatch = content.match(/\*\*(?:完成日期|创建日期)\*\*[：:]\s*(.+)/);

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-[11px] text-cyber-muted">
        <span className="rounded bg-cyber-cyan/10 px-2 py-0.5 font-mono text-cyber-cyan">
          {doc.categoryLabel}
        </span>
        {milestoneMatch && (
          <span className="rounded bg-cyber-purple/10 px-2 py-0.5 font-mono text-cyber-purple">
            {milestoneMatch[1]}
          </span>
        )}
        {dateMatch && (
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {dateMatch[1].trim()}
          </span>
        )}
        {statusMatch && (
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle className="size-3" />
            {statusMatch[1].trim()}
          </span>
        )}
      </div>

      <MarkdownViewer content={content} />
    </div>
  );
}
