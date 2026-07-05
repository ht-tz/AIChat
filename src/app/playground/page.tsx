// Playground 页面 —— useSearchParams 需要 Suspense 包裹

import { Suspense } from "react";
import { Playground } from "@/features/prompt/playground";

export const dynamic = "force-dynamic";

export default function PlaygroundPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-cyber-muted">
          <div className="size-6 animate-spin rounded-full border-2 border-cyber-cyan border-t-transparent" />
        </div>
      }
    >
      <Playground />
    </Suspense>
  );
}
