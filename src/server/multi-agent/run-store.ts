export interface WorkflowRun {
  id: string;
  goal: string;
  teamId?: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  stages: Array<{
    name: string;
    description: string;
    tasks: Array<{ title: string; assignee: string; description: string }>;
  }>;
  steps: Array<{
    id: string;
    stageIndex: number;
    stepIndex: number;
    agentRole: string;
    agentName: string;
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    input?: string;
    output?: string;
    error?: string;
    durationMs?: number;
    startedAt?: number;
    completedAt?: number;
  }>;
  currentStageIndex?: number;
  completedStages?: number;
  totalStages: number;
  totalSteps: number;
  completedSteps: number;
  finalAnswer?: string;
  error?: string;
  durationMs?: number;
  startedAt?: number;
  completedAt?: number;
  createdAt?: number;
}

const runStore: Map<string, WorkflowRun> = new Map();
const MAX_STORE_SIZE = 100;

export function storeRun(run: WorkflowRun): void {
  // 防止无界增长
  if (runStore.size >= MAX_STORE_SIZE) {
    const oldestKey = runStore.keys().next().value;
    if (oldestKey) runStore.delete(oldestKey);
  }
  runStore.set(run.id, run);
}

export function getRun(id: string): WorkflowRun | undefined {
  return runStore.get(id);
}

export function getAllRuns(): WorkflowRun[] {
  return Array.from(runStore.values());
}

export function updateRun(id: string, updates: Partial<WorkflowRun>): WorkflowRun | undefined {
  const run = runStore.get(id);
  if (!run) return undefined;
  const updated = { ...run, ...updates };
  runStore.set(id, updated);
  return updated;
}
