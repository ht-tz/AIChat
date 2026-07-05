export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0B14]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00f0ff] border-t-transparent" />
        <p className="text-[#9ca3af]">加载中...</p>
      </div>
    </div>
  );
}
