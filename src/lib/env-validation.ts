// 启动时环境变量校验 — 生产环境必须配置关键变量

const REQUIRED_VARS = ["DATABASE_URL", "JWT_SECRET", "ENCRYPTION_KEY"] as const;

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === "production";
  const missing: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const msg = `[env] Missing required environment variables: ${missing.join(", ")}`;
    if (isProd) {
      console.error(msg);
      process.exit(1);
    } else {
      console.warn(`${msg} — using development defaults`);
    }
  }

  // 校验密钥长度
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    const msg = "[env] JWT_SECRET must be at least 32 characters";
    if (isProd) {
      console.error(msg);
      process.exit(1);
    } else {
      console.warn(msg);
    }
  }

  const encKey = process.env.ENCRYPTION_KEY;
  if (encKey && encKey.length < 32) {
    const msg = "[env] ENCRYPTION_KEY must be at least 32 characters";
    if (isProd) {
      console.error(msg);
      process.exit(1);
    } else {
      console.warn(msg);
    }
  }
}
