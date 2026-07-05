import { redirect } from "next/navigation";
import { docsService } from "@/server/docs-service";

export default function DocsPage() {
  const defaultDoc = docsService.getDefaultDoc();
  if (defaultDoc) {
    redirect(`/docs/${defaultDoc.slug}`);
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-cyber-text">暂无文档</h1>
        <p className="mt-2 text-sm text-cyber-muted">docs 目录下没有找到 Markdown 文件</p>
      </div>
    </div>
  );
}
