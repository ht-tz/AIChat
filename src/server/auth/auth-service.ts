// 认证服务 —— 注册、登录、JWT、API 密钥、OAuth、邮箱验证

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import {
  db,
  schema,
  type User,
  type ApiKey,
  type OAuthAccount,
  type EmailVerificationToken,
} from "@/server/db";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return secret || "dev-secret-change-in-production";
}
const JWT_EXPIRES_IN = "7d";

// 登录失败次数跟踪（IP+邮箱 → 失败次数和锁定时间）
const loginAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();
const MAX_LOGIN_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 分钟

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface OAuthLoginInput {
  provider: "github" | "google";
  providerUserId: string;
  providerEmail?: string;
  name?: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: "admin" | "user";
}

export interface AuthResult {
  user: Pick<User, "id" | "email" | "name" | "role" | "emailVerified" | "provider">;
  token: string;
}

export interface ApiKeyResult {
  id: string;
  name: string;
  key: string;
  prefix: string;
  status: "active" | "revoked";
  createdAt: Date;
  expiresAt?: Date | null;
}

// 内存降级（当 DATABASE_URL 未设置时）
const memoryUsers: Map<string, User> = new Map();
const memoryApiKeys: Map<string, ApiKey & { plainKey?: string }> = new Map();
const memoryOAuthAccounts: Map<string, OAuthAccount> = new Map();
const memoryVerificationTokens: Map<string, EmailVerificationToken> = new Map();

function createMemoryUser(
  email: string,
  passwordHash: string | null,
  name: string,
  role: "admin" | "user",
  provider?: string,
): User {
  const user: User = {
    id: nanoid(),
    email,
    passwordHash,
    name,
    role,
    emailVerified: !!provider, // OAuth 用户默认已验证
    avatar: null,
    provider: provider || null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryUsers.set(user.id, user);
  return user;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.findUserByEmail(email);
    if (existing) {
      throw new Error("Email already registered");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const role: "admin" | "user" = memoryUsers.size === 0 && !db ? "admin" : "user";

    let user: User;
    if (db) {
      const [created] = await db
        .insert(schema.users)
        .values({
          email,
          passwordHash,
          name: input.name || email.split("@")[0],
          role,
          emailVerified: false,
        })
        .returning();
      user = created;
    } else {
      user = createMemoryUser(email, passwordHash, input.name || email.split("@")[0], role);
    }

    const token = this.generateToken(user);
    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  async login(input: LoginInput, clientIp?: string): Promise<AuthResult> {
    const email = input.email.toLowerCase().trim();
    const identifier = clientIp ? `${clientIp}:${email}` : email;

    // 检查账户锁定
    const lock = this.checkLoginLock(identifier);
    if (lock.locked) {
      throw new Error(`登录尝试过多，请 ${lock.retryAfter} 秒后再试`);
    }

    const user = await this.findUserByEmail(email);
    if (!user) {
      this.recordLoginFailure(identifier);
      throw new Error("Invalid email or password");
    }
    if (!user.passwordHash) {
      throw new Error("Please login with your OAuth provider");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      this.recordLoginFailure(identifier);
      throw new Error("Invalid email or password");
    }

    // 登录成功，清除失败记录
    this.clearLoginAttempts(identifier);
    await this.updateLastLogin(user.id);
    const token = this.generateToken(user);
    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  checkLoginLock(identifier: string): { locked: boolean; retryAfter?: number } {
    const attempt = loginAttempts.get(identifier);
    if (!attempt) return { locked: false };
    if (attempt.lockedUntil > 0 && Date.now() < attempt.lockedUntil) {
      return { locked: true, retryAfter: Math.ceil((attempt.lockedUntil - Date.now()) / 1000) };
    }
    // 锁定已过期，重置
    if (attempt.lockedUntil > 0 && Date.now() >= attempt.lockedUntil) {
      loginAttempts.delete(identifier);
      return { locked: false };
    }
    return { locked: false };
  }

  recordLoginFailure(identifier: string): void {
    const attempt = loginAttempts.get(identifier) || { count: 0, lockedUntil: 0 };
    attempt.count++;
    if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
      attempt.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
    loginAttempts.set(identifier, attempt);
  }

  clearLoginAttempts(identifier: string): void {
    loginAttempts.delete(identifier);
  }

  /**
   * OAuth 登录：查找已有 OAuth 关联 → 自动登录；否则创建新用户
   */
  async oauthLogin(input: OAuthLoginInput): Promise<AuthResult> {
    // 1. 查找已有 OAuth 关联
    const existingOAuth = await this.findOAuthAccount(input.provider, input.providerUserId);
    if (existingOAuth) {
      const user = await this.findUserById(existingOAuth.userId);
      if (!user) {
        throw new Error("OAuth account linked to non-existent user");
      }
      // 更新 OAuth token 和 avatar
      await this.updateOAuthAccount(existingOAuth.id, {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        avatarUrl: input.avatarUrl,
      });
      await this.updateLastLogin(user.id);
      const token = this.generateToken(user);
      return { user: this.sanitizeUser(user), token };
    }

    // 2. 检查邮箱是否已注册
    let user: User | undefined;
    if (input.providerEmail) {
      user = await this.findUserByEmail(input.providerEmail);
    }

    // 3. 已有账号 → 绑定 OAuth
    if (user) {
      await this.createOAuthAccount({
        userId: user.id,
        provider: input.provider,
        providerUserId: input.providerUserId,
        providerEmail: input.providerEmail,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        avatarUrl: input.avatarUrl,
      });
      // 更新用户 provider 标记
      await this.updateUserProvider(user.id, input.provider);
      // OAuth 邮箱默认已验证
      if (!user.emailVerified && input.providerEmail === user.email) {
        await this.verifyUserEmail(user.id);
      }
      await this.updateLastLogin(user.id);
      const token = this.generateToken(user);
      return {
        user: this.sanitizeUser({ ...user, emailVerified: true, provider: input.provider }),
        token,
      };
    }

    // 4. 新用户 → 创建账号 + OAuth 关联
    const role: "admin" | "user" = memoryUsers.size === 0 && !db ? "admin" : "user";
    if (db) {
      const [created] = await db
        .insert(schema.users)
        .values({
          email: input.providerEmail || `${input.provider}_${input.providerUserId}@oauth.local`,
          name: input.name || input.providerEmail?.split("@")[0] || input.provider,
          role,
          emailVerified: true,
          provider: input.provider,
        })
        .returning();
      user = created;
    } else {
      user = createMemoryUser(
        input.providerEmail || `${input.provider}_${input.providerUserId}@oauth.local`,
        null,
        input.name || input.providerEmail?.split("@")[0] || input.provider,
        role,
        input.provider,
      );
    }

    await this.createOAuthAccount({
      userId: user.id,
      provider: input.provider,
      providerUserId: input.providerUserId,
      providerEmail: input.providerEmail,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      avatarUrl: input.avatarUrl,
    });

    await this.updateLastLogin(user.id);
    const token = this.generateToken(user);
    return { user: this.sanitizeUser(user), token };
  }

  /**
   * 创建邮箱验证 token
   */
  async createVerificationToken(userId: string, email: string): Promise<string> {
    const token = nanoid(48);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 分钟

    if (db) {
      await db.insert(schema.emailVerificationTokens).values({
        userId,
        email,
        token,
        expiresAt,
      });
    } else {
      const record: EmailVerificationToken = {
        id: nanoid(),
        userId,
        email,
        token,
        expiresAt,
        verifiedAt: null,
        createdAt: new Date(),
      };
      memoryVerificationTokens.set(token, record);
    }

    return token;
  }

  /**
   * 验证邮箱 token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
    let record: EmailVerificationToken | undefined;

    if (db) {
      const [found] = await db
        .select()
        .from(schema.emailVerificationTokens)
        .where(eq(schema.emailVerificationTokens.token, token));
      record = found;
    } else {
      record = memoryVerificationTokens.get(token);
    }

    if (!record) {
      return { success: false, error: "Invalid verification token" };
    }
    if (record.verifiedAt) {
      return { success: false, error: "Token already used" };
    }
    if (new Date(record.expiresAt) < new Date()) {
      return { success: false, error: "Token expired" };
    }

    // 标记 token 已使用
    if (db) {
      await db
        .update(schema.emailVerificationTokens)
        .set({ verifiedAt: new Date() })
        .where(eq(schema.emailVerificationTokens.id, record.id));
    } else {
      record.verifiedAt = new Date();
    }

    // 更新用户邮箱验证状态
    if (record.userId) {
      await this.verifyUserEmail(record.userId);
    }

    return { success: true, email: record.email };
  }

  async verifyUserEmail(userId: string): Promise<void> {
    if (db) {
      await db
        .update(schema.users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
    } else {
      const user = memoryUsers.get(userId);
      if (user) {
        user.emailVerified = true;
        user.updatedAt = new Date();
      }
    }
  }

  async updateUserProvider(userId: string, provider: string): Promise<void> {
    if (db) {
      await db
        .update(schema.users)
        .set({ provider, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
    } else {
      const user = memoryUsers.get(userId);
      if (user) {
        user.provider = provider;
        user.updatedAt = new Date();
      }
    }
  }

  // ---- OAuth Account CRUD ----

  async findOAuthAccount(
    provider: "github" | "google",
    providerUserId: string,
  ): Promise<OAuthAccount | undefined> {
    if (db) {
      const [account] = await db
        .select()
        .from(schema.oauthAccounts)
        .where(
          and(
            eq(schema.oauthAccounts.provider, provider),
            eq(schema.oauthAccounts.providerUserId, providerUserId),
          ),
        );
      return account;
    }
    return Array.from(memoryOAuthAccounts.values()).find(
      (a) => a.provider === provider && a.providerUserId === providerUserId,
    );
  }

  async createOAuthAccount(data: {
    userId: string;
    provider: "github" | "google";
    providerUserId: string;
    providerEmail?: string;
    accessToken?: string;
    refreshToken?: string;
    avatarUrl?: string;
  }): Promise<void> {
    if (db) {
      await db.insert(schema.oauthAccounts).values(data);
    } else {
      const account: OAuthAccount = {
        id: nanoid(),
        userId: data.userId,
        provider: data.provider,
        providerUserId: data.providerUserId,
        providerEmail: data.providerEmail || null,
        accessToken: data.accessToken || null,
        refreshToken: data.refreshToken || null,
        avatarUrl: data.avatarUrl || null,
        createdAt: new Date(),
      };
      memoryOAuthAccounts.set(account.id, account);
    }
  }

  async updateOAuthAccount(
    accountId: string,
    data: {
      accessToken?: string;
      refreshToken?: string;
      avatarUrl?: string;
    },
  ): Promise<void> {
    if (db) {
      await db.update(schema.oauthAccounts).set(data).where(eq(schema.oauthAccounts.id, accountId));
    } else {
      const account = memoryOAuthAccounts.get(accountId);
      if (account) {
        if (data.accessToken !== undefined) account.accessToken = data.accessToken;
        if (data.refreshToken !== undefined) account.refreshToken = data.refreshToken;
        if (data.avatarUrl !== undefined) account.avatarUrl = data.avatarUrl;
      }
    }
  }

  // ---- 基础用户操作 ----

  async findUserByEmail(email: string): Promise<User | undefined> {
    if (db) {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email.toLowerCase().trim()));
      return user;
    }
    return Array.from(memoryUsers.values()).find((u) => u.email === email.toLowerCase().trim());
  }

  async findUserById(userId: string): Promise<User | undefined> {
    if (db) {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      return user;
    }
    return memoryUsers.get(userId);
  }

  async updateLastLogin(userId: string): Promise<void> {
    if (db) {
      await db
        .update(schema.users)
        .set({ lastLoginAt: new Date() })
        .where(eq(schema.users.id, userId));
    } else {
      const user = memoryUsers.get(userId);
      if (user) {
        user.lastLoginAt = new Date();
      }
    }
  }

  generateToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
  }

  verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, getJwtSecret()) as TokenPayload;
    } catch {
      return null;
    }
  }

  sanitizeUser(
    user: User,
  ): Pick<User, "id" | "email" | "name" | "role" | "emailVerified" | "provider"> {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      provider: user.provider,
    };
  }

  // ---- API Key 管理 ----

  async createApiKey(userId: string, name: string, expiresInDays?: number): Promise<ApiKeyResult> {
    const plainKey = `ak_${nanoid(32)}`;
    const keyHash = await bcrypt.hash(plainKey, 10);
    const keyPrefix = plainKey.slice(0, 8);
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    if (db) {
      const [created] = await db
        .insert(schema.apiKeys)
        .values({
          userId,
          name,
          keyHash,
          keyPrefix,
          expiresAt,
        })
        .returning();
      return {
        id: created.id,
        name: created.name,
        key: plainKey,
        prefix: created.keyPrefix,
        status: created.status,
        createdAt: created.createdAt,
        expiresAt: created.expiresAt,
      };
    }

    const key: ApiKey & { plainKey?: string } = {
      id: nanoid(),
      userId,
      name,
      keyHash,
      keyPrefix,
      status: "active",
      lastUsedAt: null,
      usageCount: 0,
      expiresAt,
      createdAt: new Date(),
      plainKey,
    };
    memoryApiKeys.set(key.id, key);
    return {
      id: key.id,
      name: key.name,
      key: plainKey,
      prefix: key.keyPrefix,
      status: key.status,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
    };
  }

  async listApiKeys(userId: string): Promise<Array<Omit<ApiKeyResult, "key">>> {
    let keys: ApiKey[];
    if (db) {
      keys = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.userId, userId));
    } else {
      keys = Array.from(memoryApiKeys.values()).filter((k) => k.userId === userId);
    }
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.keyPrefix,
      status: k.status,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
    }));
  }

  async revokeApiKey(userId: string, keyId: string): Promise<boolean> {
    if (db) {
      const [updated] = await db
        .update(schema.apiKeys)
        .set({ status: "revoked" })
        .where(and(eq(schema.apiKeys.id, keyId), eq(schema.apiKeys.userId, userId)))
        .returning();
      return !!updated;
    }

    const key = memoryApiKeys.get(keyId);
    if (!key || key.userId !== userId) return false;
    key.status = "revoked";
    return true;
  }

  async validateApiKey(plainKey: string): Promise<User | undefined> {
    const prefix = plainKey.slice(0, 8);
    let keys: ApiKey[];
    if (db) {
      keys = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyPrefix, prefix));
    } else {
      keys = Array.from(memoryApiKeys.values()).filter((k) => k.keyPrefix === prefix);
    }

    for (const key of keys) {
      if (key.status !== "active") continue;
      if (key.expiresAt && new Date(key.expiresAt) < new Date()) continue;
      const valid = await bcrypt.compare(plainKey, key.keyHash);
      if (valid) {
        if (db) {
          await db
            .update(schema.apiKeys)
            .set({ lastUsedAt: new Date(), usageCount: key.usageCount + 1 })
            .where(eq(schema.apiKeys.id, key.id));
        } else {
          key.lastUsedAt = new Date();
          key.usageCount += 1;
        }
        return this.findUserById(key.userId);
      }
    }
    return undefined;
  }

  async updateProfile(
    userId: string,
    data: { name?: string },
  ): Promise<Pick<User, "id" | "email" | "name" | "role" | "emailVerified" | "provider">> {
    if (db) {
      const [updated] = await db
        .update(schema.users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.users.id, userId))
        .returning();
      return this.sanitizeUser(updated);
    }
    const user = memoryUsers.get(userId);
    if (user) {
      if (data.name !== undefined) user.name = data.name;
      user.updatedAt = new Date();
      return this.sanitizeUser(user);
    }
    throw new Error("User not found");
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    const user = await this.findUserById(userId);
    if (!user) throw new Error("User not found");
    if (!user.passwordHash) throw new Error("Cannot change password for OAuth users");

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error("Current password is incorrect");

    const newHash = await bcrypt.hash(newPassword, 10);
    if (db) {
      await db
        .update(schema.users)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
    } else {
      user.passwordHash = newHash;
      user.updatedAt = new Date();
    }
    return true;
  }

  async listUsers(
    currentUserId: string,
  ): Promise<
    Array<
      Pick<
        User,
        | "id"
        | "email"
        | "name"
        | "role"
        | "emailVerified"
        | "provider"
        | "lastLoginAt"
        | "createdAt"
      >
    >
  > {
    const currentUser = await this.findUserById(currentUserId);
    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    let users: User[];
    if (db) {
      users = await db.select().from(schema.users).orderBy(schema.users.createdAt);
    } else {
      users = Array.from(memoryUsers.values());
    }

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      emailVerified: u.emailVerified,
      provider: u.provider,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));
  }

  async updateUserRole(
    adminUserId: string,
    targetUserId: string,
    role: "admin" | "user",
  ): Promise<void> {
    const admin = await this.findUserById(adminUserId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Admin access required");
    }
    if (adminUserId === targetUserId) {
      throw new Error("Cannot change your own role");
    }

    if (db) {
      await db
        .update(schema.users)
        .set({ role, updatedAt: new Date() })
        .where(eq(schema.users.id, targetUserId));
    } else {
      const user = memoryUsers.get(targetUserId);
      if (user) {
        user.role = role;
        user.updatedAt = new Date();
      }
    }
  }

  async deleteUser(adminUserId: string, targetUserId: string): Promise<void> {
    const admin = await this.findUserById(adminUserId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Admin access required");
    }
    if (adminUserId === targetUserId) {
      throw new Error("Cannot delete your own account");
    }

    if (db) {
      await db.delete(schema.users).where(eq(schema.users.id, targetUserId));
    } else {
      memoryUsers.delete(targetUserId);
    }
  }
}

export const authService = new AuthService();
