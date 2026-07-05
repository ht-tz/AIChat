// Agent 工具函数（前端用）

export interface AgentInfo {
  role: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

const AGENTS: Record<string, AgentInfo> = {
  planner: {
    role: "planner",
    name: "规划专家",
    description: "分析目标，拆解任务",
    color: "#00F0FF",
    icon: "📋",
  },
  researcher: {
    role: "researcher",
    name: "研究专家",
    description: "搜索信息，收集数据",
    color: "#A855F7",
    icon: "🔍",
  },
  analyst: {
    role: "analyst",
    name: "分析专家",
    description: "分析数据，提取洞察",
    color: "#22D3EE",
    icon: "📊",
  },
  creative: {
    role: "creative",
    name: "创意专家",
    description: "头脑风暴，创意构思",
    color: "#F472B6",
    icon: "💡",
  },
  coder: {
    role: "coder",
    name: "编码专家",
    description: "编写代码，实现功能",
    color: "#34D399",
    icon: "💻",
  },
  tester: {
    role: "tester",
    name: "测试专家",
    description: "质量保证，发现 Bug",
    color: "#FBBF24",
    icon: "🧪",
  },
  writer: {
    role: "writer",
    name: "写作专家",
    description: "撰写报告，总结输出",
    color: "#60A5FA",
    icon: "✍️",
  },
  reviewer: {
    role: "reviewer",
    name: "评审专家",
    description: "质量把关，验证准确",
    color: "#F87171",
    icon: "🔍",
  },
};

export function getAgentByRole(role: string): AgentInfo | undefined {
  return AGENTS[role];
}

export function getAllAgents(): AgentInfo[] {
  return Object.values(AGENTS);
}
