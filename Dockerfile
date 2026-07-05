# NEXUS AI Agent —— 生产镜像

# Stage 1: 构建
FROM node:20-alpine AS builder
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 复制源码
COPY . .

# 构建
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Stage 2: 运行
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nexus && \
    adduser --system --uid 1001 nexus

# 复制构建产物
COPY --from=builder --chown=nexus:nexus /app/.next/standalone ./
COPY --from=builder --chown=nexus:nexus /app/.next/static ./.next/static
COPY --from=builder --chown=nexus:nexus /app/public ./public

# 确保上传目录存在
RUN mkdir -p /app/public/uploads && chown -R nexus:nexus /app/public

USER nexus

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
