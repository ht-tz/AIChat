// 输入验证中间件

const BLOCKED_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  /<svg[^>]*>[\s\S]*?<\/svg>/gi,
];

const TOO_LONG_THRESHOLD = 100000;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: string;
}

export function validateText(input: string): ValidationResult {
  const errors: string[] = [];
  let sanitized = input;

  if (!input || input.trim() === "") {
    errors.push("输入不能为空");
    return { valid: false, errors, sanitized: "" };
  }

  if (input.length > TOO_LONG_THRESHOLD) {
    errors.push(`输入内容过长（最大 ${TOO_LONG_THRESHOLD} 字符）`);
    sanitized = input.slice(0, TOO_LONG_THRESHOLD);
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(input)) {
      errors.push("检测到潜在危险内容");
      sanitized = sanitized.replace(pattern, "[REMOVED]");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

export function validateJSON(input: string): ValidationResult {
  const errors: string[] = [];

  if (!input) {
    errors.push("JSON 不能为空");
    return { valid: false, errors, sanitized: "" };
  }

  try {
    const parsed = JSON.parse(input);
    const textVersion = JSON.stringify(parsed);

    if (textVersion.length > TOO_LONG_THRESHOLD) {
      errors.push(`JSON 内容过长（最大 ${TOO_LONG_THRESHOLD} 字符）`);
      return { valid: false, errors, sanitized: textVersion.slice(0, TOO_LONG_THRESHOLD) };
    }

    return { valid: true, errors, sanitized: textVersion };
  } catch {
    errors.push("无效的 JSON 格式");
    return { valid: false, errors, sanitized: input };
  }
}

export function validateURL(input: string): ValidationResult {
  const errors: string[] = [];

  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol)) {
      errors.push("URL 必须使用 http 或 https 协议");
    }
    if (url.hostname.includes("localhost") || url.hostname.includes("127.0.0.1")) {
      errors.push("不允许访问本地地址");
    }
    return { valid: errors.length === 0, errors, sanitized: url.toString() };
  } catch {
    errors.push("无效的 URL 格式");
    return { valid: false, errors, sanitized: input };
  }
}

export function validateEmail(input: string): ValidationResult {
  const errors: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(input)) {
    errors.push("无效的邮箱格式");
  }

  return { valid: errors.length === 0, errors, sanitized: input };
}
