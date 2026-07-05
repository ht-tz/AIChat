"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Mail, Lock, User, Loader2, Github, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth";

// Google SVG icon
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  // OAuth 错误参数
  const oauthError = searchParams.get("error");

  // 注册后显示验证提示
  const showVerificationNotice = !isLogin && auth.verificationSent;
  // 已登录但未验证邮箱
  const showResendVerify =
    auth.isAuthenticated() && !auth.isEmailVerified() && !auth.verificationSent;

  // 已登录则跳转首页
  useEffect(() => {
    if (auth.isAuthenticated() && auth.isEmailVerified()) {
      router.push("/");
    }
  }, [auth, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = isLogin
      ? await auth.login(email, password)
      : await auth.register(email, password, name);
    if (ok && isLogin) {
      router.push("/");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-cyber-cyan/20 bg-cyber-surface/80 p-8 shadow-2xl shadow-cyber-cyan/10 backdrop-blur">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl border border-cyber-cyan/30 bg-cyber-cyan/10">
            <Shield className="size-7 text-cyber-cyan" />
          </div>
          <h1 className="text-gradient font-display text-2xl font-semibold">
            {isLogin ? "欢迎回来" : "创建账号"}
          </h1>
          <p className="mt-2 text-sm text-cyber-muted">
            {isLogin ? "登录以继续您的 AI 之旅" : "注册以开始使用 Nexus AI"}
          </p>
        </div>

        {/* OAuth 错误提示 */}
        {oauthError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            <AlertCircle className="size-4 shrink-0" />
            <span>{decodeURIComponent(oauthError)}</span>
          </div>
        )}

        {/* 邮箱验证提示 */}
        {showVerificationNotice && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-cyber-amber/30 bg-cyber-amber/10 px-4 py-3 text-sm text-cyber-amber">
            <Mail className="size-4 shrink-0" />
            <div>
              <p className="font-medium">验证邮件已发送</p>
              <p className="mt-0.5 text-xs text-cyber-muted">
                请检查您的邮箱（开发模式下查看控制台输出）
              </p>
            </div>
          </div>
        )}

        {/* 已登录但未验证 */}
        {showResendVerify && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-cyber-amber/30 bg-cyber-amber/10 px-4 py-3 text-sm text-cyber-amber">
            <AlertCircle className="size-4 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">邮箱未验证</p>
              <button
                onClick={() => auth.sendVerification()}
                className="mt-1 text-xs text-cyber-cyan hover:underline"
              >
                重新发送验证邮件
              </button>
            </div>
          </div>
        )}

        {auth.verificationSent && auth.isAuthenticated() && !auth.isEmailVerified() && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-400">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>验证邮件已发送，请查收</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="mb-1 block text-sm font-medium text-cyber-text">昵称</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cyber-muted" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-cyber-cyan/20 bg-cyber-bg/60 py-2.5 pl-10 pr-4 text-sm text-cyber-text outline-none transition-colors focus:border-cyber-cyan/50"
                  placeholder="可选"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-cyber-text">邮箱</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cyber-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-cyber-cyan/20 bg-cyber-bg/60 py-2.5 pl-10 pr-4 text-sm text-cyber-text outline-none transition-colors focus:border-cyber-cyan/50"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-cyber-text">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cyber-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-cyber-cyan/20 bg-cyber-bg/60 py-2.5 pl-10 pr-4 text-sm text-cyber-text outline-none transition-colors focus:border-cyber-cyan/50"
                placeholder="至少 6 位"
              />
            </div>
          </div>

          {auth.error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {auth.error}
            </div>
          )}

          <button
            type="submit"
            disabled={auth.isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyber-cyan to-cyber-purple py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {auth.isLoading && <Loader2 className="size-4 animate-spin" />}
            {isLogin ? "登录" : "注册"}
          </button>
        </form>

        {/* OAuth 分割线 */}
        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-cyber-border" />
          <span className="text-xs text-cyber-muted">或通过第三方登录</span>
          <div className="h-px flex-1 bg-cyber-border" />
        </div>

        {/* OAuth 按钮 */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <a
            href="/api/auth/oauth/github"
            className="flex items-center justify-center gap-2 rounded-lg border border-cyber-border bg-cyber-bg/60 py-2.5 text-sm font-medium text-cyber-text transition-colors hover:border-cyber-cyan/50 hover:bg-cyber-surface/60"
          >
            <Github className="size-4" />
            GitHub
          </a>
          <a
            href="/api/auth/oauth/google"
            className="flex items-center justify-center gap-2 rounded-lg border border-cyber-border bg-cyber-bg/60 py-2.5 text-sm font-medium text-cyber-text transition-colors hover:border-cyber-cyan/50 hover:bg-cyber-surface/60"
          >
            <GoogleIcon className="size-4" />
            Google
          </a>
        </div>

        <div className="mt-6 text-center text-sm text-cyber-muted">
          {isLogin ? "还没有账号？" : "已有账号？"}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              auth.setError(null);
            }}
            className="ml-1 font-medium text-cyber-cyan hover:underline"
          >
            {isLogin ? "立即注册" : "立即登录"}
          </button>
        </div>
      </div>
    </div>
  );
}
