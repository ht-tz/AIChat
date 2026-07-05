---
name: debugging
description: 调试技能。当遇到 bug、错误、异常行为时使用。
---

# 调试流程

## 第一步：复现
1. 确认错误信息和堆栈
2. 找到最小复现路径

## 第二步：定位
1. 从错误信息找到文件和行号
2. 读取相关代码，理解数据流
3. 检查最近的 git diff 是否引入了问题

## 第三步：修复
1. 写一个能复现 bug 的测试
2. 修复代码
3. 运行测试确认通过
4. 运行 typecheck 确认无类型错误

## 常见问题
- Mermaid 渲染失败 → 检查 mermaid-diagram.tsx ID 冲突
- SSE 流中断 → 检查 nginx.conf buffering 配置
- DB 连接失败 → 检查 .env.local DATABASE_URL
