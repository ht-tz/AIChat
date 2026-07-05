export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0B14] text-[#e6e8f2]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[#00f0ff]">404</h1>
        <p className="mt-4 text-xl text-[#9ca3af]">页面未找到</p>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg border border-[#00f0ff]/30 bg-[#00f0ff]/10 px-6 py-2 text-[#00f0ff] transition-colors hover:bg-[#00f0ff]/20"
        >
          返回首页
        </a>
      </div>
    </div>
  );
}
