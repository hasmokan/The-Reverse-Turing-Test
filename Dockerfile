# ============================================
# Stage 1: Build Rust Backend
# ============================================
FROM rust:1.85-slim-bookworm AS backend-builder

WORKDIR /app/backend

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend source
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src

# Build release binary
RUN cargo build --release

# ============================================
# Stage 2: Build Next.js Frontend
# ============================================
FROM node:20-slim AS frontend-builder

# Force sequential build: wait for backend to complete first
# This prevents OOM when both builds run in parallel
COPY --from=backend-builder /app/backend/target/release/mimic-backend /tmp/.backend-build-done
RUN rm -f /tmp/.backend-build-done

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app/frontend

# Copy package files
COPY frontend/package.json frontend/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY frontend/ ./

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y \
    postgresql-15 \
    redis-server \
    nginx \
    supervisor \
    nodejs \
    npm \
    libssl3 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install n8n globally
RUN npm install -g n8n

# Create app directory
WORKDIR /app

# Copy Rust backend binary
COPY --from=backend-builder /app/backend/target/release/mimic-backend /app/backend/mimic-backend

# Copy Next.js standalone build
COPY --from=frontend-builder /app/frontend/.next/standalone /app/frontend
COPY --from=frontend-builder /app/frontend/.next/static /app/frontend/.next/static
COPY --from=frontend-builder /app/frontend/public /app/frontend/public

# Copy database schema
COPY backend/schema.sql /app/backend/schema.sql

# Copy n8n workflow
COPY n8n-workflow.json /app/n8n-workflow.json

# Copy configuration files
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY nginx.conf /etc/nginx/nginx.conf
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Expose port 7860 (ModelScope requirement)
EXPOSE 7860

# Defaults (can be overridden at runtime)
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mimic
ENV REDIS_URL=redis://localhost:6379
ENV HOST=0.0.0.0
ENV PORT=3001
ENV NODE_ENV=production

# Basic container health check (served by nginx)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fsS http://localhost:7860/health || exit 1

# Entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
