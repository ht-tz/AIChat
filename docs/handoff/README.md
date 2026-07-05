# 交接文档

> 把项目完整地交给下一个接手人时，按以下顺序阅读即可。

## 必读清单

1. [项目 PRD](../../.trae/documents/prd.md) —— 业务全貌
2. [技术架构](../../.trae/documents/technical-architecture.md) —— 工程全貌
3. [文档中心](../README.md) —— 开发日志与学习笔记入口
4. [环境与启动](./env.md) —— 跑起来
5. [API 接口文档](./api.md) —— 后端契约
6. [M2 工具调用补充](./m2-supplement.md) —— M2 完成态模块、ISSUE、M3 启动指南

## 接手 30 分钟速通

1. 看 `docs/learning/00-architecture.md` 了解整体架构
2. 看 `docs/progress.md` 了解已做与待做
3. 看 `docs/issues.md` 了解历史踩坑
4. 按 `docs/handoff/env.md` 启动 dev server
5. 从 `docs/requirements/M1-basic-chat.md` → `M2-tool-calling.md` 看前两个功能的来龙去脉
6. 对照 `docs/learning/M1-basic-chat.md` → `M2-tool-calling.md` → `M3-react.md` 理解实现思路
7. **接手 M4 之前**：先读 [m3-supplement.md](./m3-supplement.md) 的"M4 启动指南"

## 接手人 Checklist

接手人应当能够回答以下问题：

- [ ] 项目用了哪些核心技术？为什么这样选？
- [ ] LLM Provider 抽象是怎么设计的？怎么切换到真实厂商？
- [ ] ReAct 主循环跑在哪里？状态怎么流转？
- [ ] SSE 流式怎么实现的？怎么取消、怎么重连？
- [ ] 数据库表有哪些核心表？它们的关系？
- [ ] 如何新增一个 Agent / 工具 / 提示词模板？
- [ ] 怎么跑测试 / 怎么部署？
