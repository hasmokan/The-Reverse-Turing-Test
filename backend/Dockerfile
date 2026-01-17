# ============================================
# 谁是卧底 - 后端服务（含数据库）
# ModelScope Docker 创空间专用
# ============================================

# 构建阶段
FROM rust:1.85-slim-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo update home@0.5.12 --precise 0.5.9 2>/dev/null || true
RUN CARGO_BUILD_JOBS=2 cargo build --release

# 运行阶段
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    postgresql-15 \
    redis-server \
    supervisor \
    libssl3 \
    ca-certificates \
    curl \
    nginx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制后端二进制
COPY --from=builder /app/target/release/mimic-backend /app/mimic-backend

# 复制配置文件
COPY schema.sql /app/schema.sql
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY nginx.conf /etc/nginx/nginx.conf
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 创建日志目录
RUN mkdir -p /var/log/supervisor

# ModelScope 要求端口 7860
EXPOSE 7860

# 环境变量
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mimic
ENV REDIS_URL=redis://localhost:6379
ENV HOST=0.0.0.0
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fsS http://localhost:7860/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
