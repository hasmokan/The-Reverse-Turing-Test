# ============================================
# Stage 1: Build Rust Backend
# ============================================
FROM rust:1.83-slim-bookworm AS backend-builder

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

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    postgresql \
    redis-server \
    supervisor \
    nodejs \
    npm \
    libssl3 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

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

# Copy configuration files
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create PostgreSQL data directory
RUN mkdir -p /var/lib/postgresql/data && \
    chown -R postgres:postgres /var/lib/postgresql

# Expose port 7860 (ModelScope requirement)
EXPOSE 7860

# Environment variables
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mimic
ENV REDIS_URL=redis://localhost:6379
ENV HOST=0.0.0.0
ENV PORT=3001
ENV NODE_ENV=production

# Entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
