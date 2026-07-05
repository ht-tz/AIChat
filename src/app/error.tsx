"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0B14] text-[#e6e8f2]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#ff003c]">出错了</h2>
        <p className="mt-2 text-[#9ca3af]">{error.message || "发生了意外错误"}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg border border-[#00f0ff]/30 bg-[#00f0ff]/10 px-4 py-2 text-[#00f0ff] transition-colors hover:bg-[#00f0ff]/20"
        >
          重试
        </button>
      </div>
    </div>
  );
}
