# 第一阶段：依赖安装
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 复制包管理文件
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# 安装依赖
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# 第二阶段：构建
FROM node:20-alpine AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建参数（可在构建时通过 --build-arg 传入）
ARG NEXT_PUBLIC_VISION_API_URL
ARG NEXT_PUBLIC_VISION_API_KEY
ARG NEXT_PUBLIC_VISION_MODEL
ARG NEXT_PUBLIC_WS_URL

# 设置环境变量用于构建
ENV NEXT_PUBLIC_VISION_API_URL=${NEXT_PUBLIC_VISION_API_URL}
ENV NEXT_PUBLIC_VISION_API_KEY=${NEXT_PUBLIC_VISION_API_KEY}
ENV NEXT_PUBLIC_VISION_MODEL=${NEXT_PUBLIC_VISION_MODEL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

# 禁用 Next.js 遥测
ENV NEXT_TELEMETRY_DISABLED=1

# 构建应用
RUN npm run build

# 第三阶段：生产运行
FROM node:20-alpine AS runner
WORKDIR /app

# 设置生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/public ./public

# 设置正确的权限
RUN mkdir .next
RUN chown nextjs:nodejs .next

# 复制 standalone 输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置端口环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动命令
CMD ["node", "server.js"]
