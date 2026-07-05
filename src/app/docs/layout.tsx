import { docsService } from "@/server/docs-service";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const categories = docsService.getCategories();

  return (
    <div className="flex h-screen bg-cyber-bg">
      <DocsSidebar categories={categories} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
