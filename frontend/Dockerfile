# ============================================
# 谁是卧底 - 前端服务
# ModelScope Docker 创空间专用
# ============================================

FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm run build

# 生产运行阶段
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# ModelScope 要求端口 7860
EXPOSE 7860
ENV PORT=7860
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
