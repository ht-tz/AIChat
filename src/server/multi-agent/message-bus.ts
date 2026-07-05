// 消息总线 —— Agent 间上下文传递

export interface BusMessage {
  id: string;
  from: string;
  to?: string;
  type: "info" | "result" | "question" | "error" | "status";
  content: string;
  timestamp: number;
  stageIndex?: number;
}

export class MessageBus {
  private messages: BusMessage[] = [];
  private listeners: Set<(msg: BusMessage) => void> = new Set();

  publish(msg: Omit<BusMessage, "id" | "timestamp">): void {
    const fullMsg: BusMessage = {
      ...msg,
      id: Math.random().toString(36).slice(2, 10),
      timestamp: Date.now(),
    };
    this.messages.push(fullMsg);
    for (const listener of this.listeners) {
      try {
        listener(fullMsg);
      } catch {
        // 忽略监听器错误
      }
    }
  }

  subscribe(listener: (msg: BusMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getAll(): BusMessage[] {
    return [...this.messages];
  }

  getByStage(stageIndex: number): BusMessage[] {
    return this.messages.filter((m) => m.stageIndex === stageIndex);
  }

  getByFrom(agentRole: string): BusMessage[] {
    return this.messages.filter((m) => m.from === agentRole);
  }

  getResults(): BusMessage[] {
    return this.messages.filter((m) => m.type === "result");
  }

  clear(): void {
    this.messages = [];
  }
}
