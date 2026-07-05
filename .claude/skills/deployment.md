---
name: deployment
description: 部署技能。当需要部署、Docker 构建、服务器操作时使用。
---

# 部署规范

## Docker 构建
- docker build -t aichat:latest .
- docker run -p 3000:3000 aichat:latest

## 部署前检查
- pnpm typecheck ✅
- pnpm test ✅
- pnpm build ✅

## 服务器操作
- Fly.io: fly deploy
- Nginx: 重启 sudo systemctl reload nginx
