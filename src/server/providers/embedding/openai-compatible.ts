// OpenAI 兼容 Embedding 提供者

import type { Embedding } from "@/server/memory";
import { logger } from "@/server/logger";

export interface OpenAIEmbeddingConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export class OpenAICompatibleEmbedding {
  private config: OpenAIEmbeddingConfig;

  constructor(config: OpenAIEmbeddingConfig) {
    this.config = config;
  }

  async embed(text: string): Promise<Embedding> {
    const body = {
      input: text,
      model: this.config.model,
    };

    try {
      const response = await fetch(`${this.config.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      return data.data[0].embedding as number[];
    } catch (error) {
      logger.warn({ err: error }, "OpenAI Embedding failed, falling back to mock");
      return this.mockEmbed(text);
    }
  }

  private mockEmbed(text: string): Embedding {
    const dim = 1536;
    const vec: number[] = new Array(dim).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % dim] += (text.charCodeAt(i) % 97) / 100;
    }
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
    return norm === 0 ? vec : vec.map((x) => x / norm);
  }
}
