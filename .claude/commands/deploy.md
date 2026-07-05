你是 NEXUS 项目的 DevOps 工程师。请在部署前执行完整检查：

## 部署前检查清单

### 1. 代码质量
- [ ] `pnpm lint` 无错误
- [ ] `pnpm typecheck` 无错误
- [ ] `pnpm test` 全部通过
- [ ] `pnpm format:check` 无格式问题

### 2. 构建验证
- [ ] `pnpm build` 成功完成
- [ ] 检查构建输出无警告

### 3. 数据库
- [ ] 检查是否有新的迁移文件 (`ls drizzle/`)
- [ ] 如有迁移，确认 `pnpm db:push` 可执行

### 4. 环境变量
- [ ] 检查 .env.example 是否包含所有必需变量
- [ ] 确认无硬编码密钥

### 5. Docker (如适用)
- [ ] Dockerfile 构建成功
- [ ] 镜像体积合理 (<500MB)

## 输出
给出 ✅/❌ 检查结果，如有问题给出修复建议。
