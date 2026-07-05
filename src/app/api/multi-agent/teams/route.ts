// 多智能体团队列表 API

import { NextResponse } from "next/server";
import { WORKFLOW_TEMPLATES, PRESET_AGENTS } from "@/server/multi-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  const teams = WORKFLOW_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    type: t.type,
    icon: t.icon,
    stageCount: t.stages.length,
    agentCount: t.stages.reduce((sum, s) => sum + s.tasks.length, 0),
    agents: Array.from(
      new Set(
        t.stages.flatMap((s) =>
          s.tasks.map((task) => {
            const agent = PRESET_AGENTS.find((a) => a.role === task.assignee);
            return {
              role: task.assignee,
              name: agent?.name || task.assignee,
              icon: agent?.icon || "🤖",
              color: agent?.color || "#888",
            };
          }),
        ),
      ),
    ),
  }));

  return NextResponse.json({ teams });
}
