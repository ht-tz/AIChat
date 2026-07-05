// 邮箱验证服务 —— 支持 Mock 模式（控制台输出）和 SMTP 模式

import { authService } from "./auth-service";
import { logger } from "@/server/logger";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@nexus-ai.local";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const isSmtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

// 简易内存发送限流（每个邮箱 60 秒内最多 1 封）
const sendCooldown: Map<string, number> = new Map();
const COOLDOWN_MS = 60 * 1000;

export class EmailService {
  /**
   * 发送验证邮件
   */
  async sendVerificationEmail(
    userId: string,
    email: string,
  ): Promise<{ success: boolean; error?: string }> {
    // 限流检查
    const lastSent = sendCooldown.get(email);
    if (lastSent && Date.now() - lastSent < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
      return { success: false, error: `请 ${waitSec} 秒后重试` };
    }

    // 生成验证 token
    const token = await authService.createVerificationToken(userId, email);
    const verifyUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`;

    if (isSmtpConfigured) {
      return this.sendViaSmtp(email, verifyUrl);
    }

    // Mock 模式：控制台输出
    logger.info("=".repeat(60));
    logger.info("[Email Service - Mock Mode]");
    logger.info({ email }, "[Email Service] sending");
    logger.info("Subject: 验证您的邮箱 — NEXUS AI");
    logger.info({ verifyUrl }, "验证链接");
    logger.info("(15 分钟内有效)");
    logger.info("=".repeat(60));

    sendCooldown.set(email, Date.now());
    return { success: true };
  }

  /**
   * 通过 SMTP 发送验证邮件
   */
  private async sendViaSmtp(
    email: string,
    verifyUrl: string,
  ): Promise<{ success: boolean; error?: string }> {
    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #00F0FF;">验证您的邮箱</h2>
        <p>请点击下方链接完成邮箱验证：</p>
        <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(to right,#00F0FF,#A855F7);color:#000;border-radius:8px;text-decoration:none;font-weight:bold;">
          验证邮箱
        </a>
        <p style="color:#888;font-size:12px;margin-top:16px;">
          此链接 15 分钟内有效。如非本人操作，请忽略此邮件。
        </p>
      </div>
    `;

    // 尝试使用 nodemailer（如果可用）
    let nodemailer: any;
    try {
      /* eslint-disable */
      nodemailer = require("nodemailer");
      if (!nodemailer?.createTransport) throw new Error("not installed");
    } catch {
      logger.info("=".repeat(60));
      logger.info("[Email Service - Fallback Mock (nodemailer unavailable)]");
      logger.info({ email }, "[Email Service] sending");
      logger.info({ verifyUrl }, "验证链接");
      logger.info("=".repeat(60));
      sendCooldown.set(email, Date.now());
      return { success: true };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: "验证您的邮箱 — NEXUS AI",
        html: htmlBody,
      });

      sendCooldown.set(email, Date.now());
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `邮件发送失败: ${msg}` };
    }
  }

  /**
   * 验证邮箱 token
   */
  async verifyEmailToken(
    token: string,
  ): Promise<{ success: boolean; email?: string; error?: string }> {
    return authService.verifyEmail(token);
  }
}

export const emailService = new EmailService();
