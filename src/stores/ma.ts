// 多智能体协作状态管理

import { create } from "zustand";

export interface MaStep {
  id: string;
  stageIndex: number;
  stepIndex: number;
  agentRole: string;
  agentName: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  input?: string;
  output: string;
  error?: string;
  durationMs?: number;
  startedAt?: number;
  completedAt?: number;
}

export interface MaStage {
  name: string;
  description: string;
  tasks: Array<{ title: string; assignee: string; description: string }>;
}

export interface TeamInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  icon: string;
  stageCount: number;
  agentCount: number;
  agents: Array<{ role: string; name: string; icon: string; color: string }>;
}

interface MaState {
  runId: string | null;
  goal: string;
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  stages: MaStage[];
  steps: MaStep[];
  currentStageIndex: number;
  totalStages: number;
  totalSteps: number;
  completedSteps: number;
  finalAnswer: string;
  error: string | null;
  durationMs: number;
  startedAt: number | null;
  teams: TeamInfo[];
  selectedTeamId: string;
  isLoadingTeams: boolean;

  setGoal: (goal: string) => void;
  setSelectedTeamId: (id: string) => void;
  setTeams: (teams: TeamInfo[]) => void;
  initRun: (runId: string, stages: MaStage[], totalStages: number, totalSteps: number) => void;
  setStageStarted: (stageIndex: number) => void;
  setAgentStarted: (stepId: string) => void;
  setAgentDelta: (stepId: string, delta: string) => void;
  setAgentCompleted: (
    stepId: string,
    status: "completed" | "failed",
    output?: string,
    error?: string,
    durationMs?: number,
  ) => void;
  setStageCompleted: () => void;
  setRunCompleted: (finalAnswer: string, durationMs: number) => void;
  setRunFailed: (error: string) => void;
  reset: () => void;
}

export const useMaStore = create<MaState>((set, get) => ({
  runId: null,
  goal: "",
  status: "idle",
  stages: [],
  steps: [],
  currentStageIndex: 0,
  totalStages: 0,
  totalSteps: 0,
  completedSteps: 0,
  finalAnswer: "",
  error: null,
  durationMs: 0,
  startedAt: null,
  teams: [],
  selectedTeamId: "research-analysis",
  isLoadingTeams: true,

  setGoal: (goal) => set({ goal }),
  setSelectedTeamId: (id) => set({ selectedTeamId: id }),
  setTeams: (teams) => set({ teams, isLoadingTeams: false }),

  initRun: (runId, stages, totalStages, totalSteps) => {
    const steps: MaStep[] = [];
    stages.forEach((stage, sIdx) => {
      stage.tasks.forEach((task, tIdx) => {
        steps.push({
          id: `${sIdx}-${tIdx}`,
          stageIndex: sIdx,
          stepIndex: tIdx,
          agentRole: task.assignee,
          agentName: task.assignee,
          status: "pending",
          input: task.description,
          output: "",
        });
      });
    });

    set({
      runId,
      status: "running",
      stages,
      steps,
      totalStages,
      totalSteps,
      completedSteps: 0,
      currentStageIndex: 0,
      startedAt: Date.now(),
      error: null,
      finalAnswer: "",
    });
  },

  setStageStarted: (stageIndex) => set({ currentStageIndex: stageIndex }),

  setAgentStarted: (stepId) =>
    set((state) => ({
      steps: state.steps.map((s) =>
        s.id === stepId ? { ...s, status: "running", startedAt: Date.now() } : s,
      ),
    })),

  setAgentDelta: (stepId, delta) =>
    set((state) => ({
      steps: state.steps.map((s) => (s.id === stepId ? { ...s, output: s.output + delta } : s)),
    })),

  setAgentCompleted: (stepId, status, output, error, durationMs) =>
    set((state) => ({
      steps: state.steps.map((s) =>
        s.id === stepId
          ? {
              ...s,
              status,
              output: output ?? s.output,
              error,
              completedAt: Date.now(),
              durationMs,
            }
          : s,
      ),
      completedSteps: status === "completed" ? state.completedSteps + 1 : state.completedSteps,
    })),

  setStageCompleted: () =>
    set((state) => ({
      currentStageIndex: state.currentStageIndex + 1,
    })),

  setRunCompleted: (finalAnswer, durationMs) =>
    set({
      status: "completed",
      finalAnswer,
      durationMs,
    }),

  setRunFailed: (error) => set({ status: "failed", error }),

  reset: () =>
    set({
      runId: null,
      status: "idle",
      stages: [],
      steps: [],
      currentStageIndex: 0,
      totalStages: 0,
      totalSteps: 0,
      completedSteps: 0,
      finalAnswer: "",
      error: null,
      durationMs: 0,
      startedAt: null,
    }),
}));
