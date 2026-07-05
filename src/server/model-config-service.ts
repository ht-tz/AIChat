// 模型配置服务 —— 每模型独立 API Key，AES 加密存储
// 支持数据库存储 + 内存降级（DATABASE_URL 未设置时）

import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db, schema, type ModelConfig } from "@/server/db";
import { encrypt, decrypt, keyPrefix } from "@/server/crypto";

export interface ModelConfigInput {
  modelId: string;
  label: string;
  vendor: string;
  baseUrl: string;
  apiKey: string;
  temperature?: number;
}

export interface ModelConfigOutput {
  id: string;
  modelId: string;
  label: string;
  vendor: string;
  baseUrl: string;
  apiKeyMasked: string;
  apiKeyPrefix: string;
  hasKey: boolean;
  temperature: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResolvedModelConfig {
  apiKey: string;
  baseUrl: string;
  temperature?: number;
}

const memoryModelConfigs: Map<string, ModelConfig> = new Map();

function tempToInt(t: number): number {
  return Math.round(t * 10);
}

function tempToFloat(i: number): number {
  return i / 10;
}

function toOutput(cfg: ModelConfig): ModelConfigOutput {
  const hasKey = !!cfg.apiKeyEncrypted;
  // P1 优化：直接用 apiKeyPrefix 拼接掩码，避免每次 listConfigs 都执行 AES 解密
  let masked = "••••••••";
  if (hasKey && cfg.apiKeyPrefix) {
    masked = `${cfg.apiKeyPrefix}••••••`;
  }
  return {
    id: cfg.id,
    modelId: cfg.modelId,
    label: cfg.label ?? "",
    vendor: cfg.vendor ?? "",
    baseUrl: cfg.baseUrl,
    apiKeyMasked: masked,
    apiKeyPrefix: cfg.apiKeyPrefix,
    hasKey,
    temperature: tempToFloat(cfg.temperature),
    isActive: cfg.isActive,
    createdAt: cfg.createdAt,
    updatedAt: cfg.updatedAt,
  };
}

export class ModelConfigService {
  async listConfigs(userId: string): Promise<ModelConfigOutput[]> {
    if (!db) {
      return Array.from(memoryModelConfigs.values())
        .filter((c) => c.userId === userId)
        .map(toOutput)
        .sort((a, b) => a.modelId.localeCompare(b.modelId));
    }

    const configs = await db
      .select()
      .from(schema.modelConfigs)
      .where(eq(schema.modelConfigs.userId, userId))
      .orderBy(schema.modelConfigs.modelId);

    return configs.map(toOutput);
  }

  async getConfig(userId: string, modelId: string): Promise<ModelConfigOutput | null> {
    if (!db) {
      const cfg = Array.from(memoryModelConfigs.values()).find(
        (c) => c.userId === userId && c.modelId === modelId,
      );
      return cfg ? toOutput(cfg) : null;
    }

    const configs = await db
      .select()
      .from(schema.modelConfigs)
      .where(and(eq(schema.modelConfigs.userId, userId), eq(schema.modelConfigs.modelId, modelId)))
      .limit(1);

    return configs.length > 0 ? toOutput(configs[0]) : null;
  }

  async resolveConfig(userId: string, modelId: string): Promise<ResolvedModelConfig | null> {
    if (!db) {
      const cfg = Array.from(memoryModelConfigs.values()).find(
        (c) => c.userId === userId && c.modelId === modelId,
      );
      if (!cfg || !cfg.apiKeyEncrypted) return null;
      try {
        return {
          apiKey: decrypt(cfg.apiKeyEncrypted),
          baseUrl: cfg.baseUrl,
          temperature: tempToFloat(cfg.temperature),
        };
      } catch {
        return null;
      }
    }

    const configs = await db
      .select()
      .from(schema.modelConfigs)
      .where(and(eq(schema.modelConfigs.userId, userId), eq(schema.modelConfigs.modelId, modelId)))
      .limit(1);

    if (configs.length === 0 || !configs[0].apiKeyEncrypted) return null;
    try {
      return {
        apiKey: decrypt(configs[0].apiKeyEncrypted),
        baseUrl: configs[0].baseUrl,
        temperature: tempToFloat(configs[0].temperature),
      };
    } catch {
      return null;
    }
  }

  async getActiveModelId(userId: string): Promise<string | null> {
    if (!db) {
      const cfg = Array.from(memoryModelConfigs.values()).find(
        (c) => c.userId === userId && c.isActive,
      );
      return cfg?.modelId ?? null;
    }

    const configs = await db
      .select()
      .from(schema.modelConfigs)
      .where(and(eq(schema.modelConfigs.userId, userId), eq(schema.modelConfigs.isActive, true)))
      .limit(1);

    return configs.length > 0 ? configs[0].modelId : null;
  }

  async saveConfig(userId: string, input: ModelConfigInput): Promise<ModelConfigOutput> {
    const temp = tempToInt(input.temperature ?? 0.7);
    const encryptedKey = input.apiKey ? encrypt(input.apiKey) : "";
    const prefix = input.apiKey ? keyPrefix(input.apiKey) : "";
    const now = new Date();

    if (!db) {
      const existing = Array.from(memoryModelConfigs.values()).find(
        (c) => c.userId === userId && c.modelId === input.modelId,
      );

      if (existing) {
        existing.baseUrl = input.baseUrl;
        existing.label = input.label;
        existing.vendor = input.vendor;
        if (encryptedKey) existing.apiKeyEncrypted = encryptedKey;
        if (prefix) existing.apiKeyPrefix = prefix;
        existing.temperature = temp;
        existing.updatedAt = now;
        memoryModelConfigs.set(existing.id, existing);
        return toOutput(existing);
      }

      const id = nanoid();
      const newCfg: ModelConfig = {
        id,
        userId,
        modelId: input.modelId,
        label: input.label,
        vendor: input.vendor,
        baseUrl: input.baseUrl,
        apiKeyEncrypted: encryptedKey,
        apiKeyPrefix: prefix,
        temperature: temp,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      };
      memoryModelConfigs.set(id, newCfg);
      return toOutput(newCfg);
    }

    const existing = await db
      .select()
      .from(schema.modelConfigs)
      .where(
        and(eq(schema.modelConfigs.userId, userId), eq(schema.modelConfigs.modelId, input.modelId)),
      )
      .limit(1);

    if (existing.length > 0) {
      const updateData: Record<string, unknown> = {
        baseUrl: input.baseUrl,
        label: input.label,
        vendor: input.vendor,
        temperature: temp,
        updatedAt: now,
      };
      if (encryptedKey) {
        updateData.apiKeyEncrypted = encryptedKey;
        updateData.apiKeyPrefix = prefix;
      }
      await db
        .update(schema.modelConfigs)
        .set(updateData)
        .where(eq(schema.modelConfigs.id, existing[0].id));

      const updated = await db
        .select()
        .from(schema.modelConfigs)
        .where(eq(schema.modelConfigs.id, existing[0].id))
        .limit(1);
      return toOutput(updated[0]);
    }

    const inserted = await db
      .insert(schema.modelConfigs)
      .values({
        userId,
        modelId: input.modelId,
        label: input.label,
        vendor: input.vendor,
        baseUrl: input.baseUrl,
        apiKeyEncrypted: encryptedKey,
        apiKeyPrefix: prefix,
        temperature: temp,
        isActive: false,
      })
      .returning();

    return toOutput(inserted[0]);
  }

  async activateModel(userId: string, modelId: string): Promise<void> {
    if (!db) {
      for (const cfg of memoryModelConfigs.values()) {
        if (cfg.userId === userId) {
          cfg.isActive = cfg.modelId === modelId;
        }
      }
      return;
    }

    await db
      .update(schema.modelConfigs)
      .set({ isActive: false })
      .where(eq(schema.modelConfigs.userId, userId));

    await db
      .update(schema.modelConfigs)
      .set({ isActive: true, updatedAt: new Date() })
      .where(and(eq(schema.modelConfigs.userId, userId), eq(schema.modelConfigs.modelId, modelId)));
  }

  async deleteConfig(userId: string, modelId: string): Promise<boolean> {
    if (!db) {
      for (const [id, cfg] of memoryModelConfigs.entries()) {
        if (cfg.userId === userId && cfg.modelId === modelId) {
          memoryModelConfigs.delete(id);
          return true;
        }
      }
      return false;
    }

    const result = await db
      .delete(schema.modelConfigs)
      .where(and(eq(schema.modelConfigs.userId, userId), eq(schema.modelConfigs.modelId, modelId)))
      .returning({ id: schema.modelConfigs.id });

    return result.length > 0;
  }

  async clearKey(userId: string, modelId: string): Promise<ModelConfigOutput | null> {
    if (!db) {
      const cfg = Array.from(memoryModelConfigs.values()).find(
        (c) => c.userId === userId && c.modelId === modelId,
      );
      if (!cfg) return null;
      cfg.apiKeyEncrypted = "";
      cfg.apiKeyPrefix = "";
      cfg.updatedAt = new Date();
      return toOutput(cfg);
    }

    const existing = await db
      .select()
      .from(schema.modelConfigs)
      .where(and(eq(schema.modelConfigs.userId, userId), eq(schema.modelConfigs.modelId, modelId)))
      .limit(1);

    if (existing.length === 0) return null;

    await db
      .update(schema.modelConfigs)
      .set({ apiKeyEncrypted: "", apiKeyPrefix: "", updatedAt: new Date() })
      .where(eq(schema.modelConfigs.id, existing[0].id));

    const updated = await db
      .select()
      .from(schema.modelConfigs)
      .where(eq(schema.modelConfigs.id, existing[0].id))
      .limit(1);
    return toOutput(updated[0]);
  }

  async resolveForRequest(userId: string, modelId: string): Promise<ResolvedModelConfig | null> {
    return this.resolveConfig(userId, modelId);
  }
}

export const modelConfigService = new ModelConfigService();
