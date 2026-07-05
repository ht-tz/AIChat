// 工作流模板定义 —— 3 种内置模板 + 自定义

export interface WorkflowTask {
  title: string;
  assignee: string;
  description: string;
}

export interface WorkflowStage {
  name: string;
  description: string;
  tasks: WorkflowTask[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  type: "research" | "creative" | "code";
  icon: string;
  stages: WorkflowStage[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "research-analysis",
    name: "研究分析流",
    description: "适合需要深入调研和分析的任务",
    type: "research",
    icon: "🔬",
    stages: [
      {
        name: "规划阶段",
        description: "分析目标，制定研究计划",
        tasks: [
          {
            title: "任务规划",
            assignee: "planner",
            description:
              "分析用户目标，制定详细的研究分析计划，明确需要研究的方向、需要分析的数据点、以及最终输出形式。",
          },
        ],
      },
      {
        name: "研究阶段",
        description: "收集信息和数据",
        tasks: [
          {
            title: "信息收集",
            assignee: "researcher",
            description:
              "根据规划阶段的任务，进行深入的信息收集和文献调研。使用搜索工具查找最新的相关资料，并整理成结构化的研究报告。",
          },
        ],
      },
      {
        name: "分析阶段",
        description: "数据分析和洞察提取",
        tasks: [
          {
            title: "数据分析",
            assignee: "analyst",
            description:
              "基于研究阶段收集的数据，进行深度分析。识别数据中的模式、趋势和关键洞察。使用定量分析方法验证假设。",
          },
        ],
      },
      {
        name: "输出阶段",
        description: "撰写最终报告",
        tasks: [
          {
            title: "报告撰写",
            assignee: "writer",
            description:
              "将研究和分析结果整合成一份结构清晰、专业的报告。包含执行摘要、研究方法、分析结果、关键洞察和建议。",
          },
        ],
      },
      {
        name: "评审阶段",
        description: "质量审核和改进",
        tasks: [
          {
            title: "质量评审",
            assignee: "reviewer",
            description:
              "评审最终报告的质量。检查事实准确性、逻辑严密性、表述清晰度。如果发现问题，提出具体的修改建议。",
          },
        ],
      },
    ],
  },
  {
    id: "creative-writing",
    name: "创意写作流",
    description: "适合创意内容创作和文案撰写",
    type: "creative",
    icon: "✨",
    stages: [
      {
        name: "规划阶段",
        description: "明确创作方向",
        tasks: [
          {
            title: "内容规划",
            assignee: "planner",
            description:
              "分析创作需求，制定内容框架。明确目标受众、核心主题、风格定位、结构安排。输出详细的创作大纲。",
          },
        ],
      },
      {
        name: "创意阶段",
        description: "头脑风暴和创意构思",
        tasks: [
          {
            title: "创意发散",
            assignee: "creative",
            description:
              "围绕主题进行头脑风暴，提出多种创意方向和角度。探索新颖的表达方式、引人入胜的叙事结构、独特的观点见解。",
          },
        ],
      },
      {
        name: "写作阶段",
        description: "正式撰写内容",
        tasks: [
          {
            title: "内容撰写",
            assignee: "writer",
            description:
              "基于创意构思和内容规划，撰写完整的作品。确保语言流畅、结构完整、情感饱满、引人入胜。",
          },
        ],
      },
      {
        name: "评审阶段",
        description: "质量审核和润色",
        tasks: [
          {
            title: "内容评审",
            assignee: "reviewer",
            description:
              "从读者视角评审作品。检查内容质量、表达清晰度、逻辑连贯性、感染力。提出具体的润色建议。",
          },
        ],
      },
      {
        name: "润色阶段",
        description: "精修和优化",
        tasks: [
          {
            title: "精修润色",
            assignee: "writer",
            description:
              "根据评审建议对作品进行精修润色。优化语言表达、调整节奏、增强感染力，确保最终作品达到最高质量。",
          },
        ],
      },
    ],
  },
  {
    id: "code-development",
    name: "代码开发流",
    description: "适合软件开发和编程任务",
    type: "code",
    icon: "⚡",
    stages: [
      {
        name: "规划阶段",
        description: "需求分析和技术方案设计",
        tasks: [
          {
            title: "技术规划",
            assignee: "planner",
            description:
              "分析开发需求，设计技术方案。明确功能模块、技术选型、架构设计、开发顺序。输出详细的开发计划。",
          },
        ],
      },
      {
        name: "编码阶段",
        description: "功能实现和代码编写",
        tasks: [
          {
            title: "功能开发",
            assignee: "coder",
            description:
              "按照技术规划进行代码开发。编写高质量、可维护的代码。遵循最佳实践和设计模式。添加清晰的注释。",
          },
        ],
      },
      {
        name: "测试阶段",
        description: "质量保证和 Bug 修复",
        tasks: [
          {
            title: "测试验证",
            assignee: "tester",
            description:
              "对开发的代码进行全面测试。设计测试用例、验证功能正确性、发现潜在 Bug、检查边界情况。输出详细的测试报告。",
          },
        ],
      },
      {
        name: "评审阶段",
        description: "代码审查和架构评审",
        tasks: [
          {
            title: "代码评审",
            assignee: "reviewer",
            description: "进行代码审查。检查代码质量、架构合理性、可维护性、安全性。提出改进建议。",
          },
        ],
      },
      {
        name: "文档阶段",
        description: "编写技术文档",
        tasks: [
          {
            title: "文档编写",
            assignee: "writer",
            description:
              "编写技术文档。包括功能说明、API 文档、使用指南、部署说明等。确保文档清晰、准确、易于理解。",
          },
        ],
      },
    ],
  },
];

export function getWorkflowTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
