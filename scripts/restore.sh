#!/bin/bash
# PostgreSQL 恢复脚本
# 从最新备份恢复数据库

set -e

PROJECT_DIR="/home/test/The-Reverse-Turing-Test"
BACKUP_DIR="$PROJECT_DIR/backups"
LATEST_BACKUP="$BACKUP_DIR/latest.sql.gz"

echo "========================================"
echo "  PostgreSQL 数据库恢复脚本"
echo "========================================"
echo ""

# 检查备份文件
if [ ! -f "$LATEST_BACKUP" ]; then
    echo "[$(date)] ERROR: No backup found at $LATEST_BACKUP"
    echo ""
    echo "Available backups:"
    ls -la "$BACKUP_DIR/hourly/" 2>/dev/null || echo "  (none)"
    exit 1
fi

# 显示备份信息
BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
BACKUP_DATE=$(stat -c %y "$LATEST_BACKUP" 2>/dev/null || stat -f %Sm "$LATEST_BACKUP" 2>/dev/null)
echo "[$(date)] Backup file: $LATEST_BACKUP"
echo "[$(date)] Backup size: $BACKUP_SIZE"
echo "[$(date)] Backup date: $BACKUP_DATE"
echo ""

# 如果是交互式运行，询问确认
if [ -t 0 ]; then
    read -p "This will REPLACE all current data. Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

cd "$PROJECT_DIR"

echo "[$(date)] Stopping dependent services..."
docker compose stop backend n8n 2>/dev/null || true

echo "[$(date)] Removing postgres container and volume..."
docker compose rm -sf postgres 2>/dev/null || true
docker volume rm the-reverse-turing-test_postgres_data 2>/dev/null || true

echo "[$(date)] Starting fresh postgres container..."
docker compose up -d postgres

# 等待 postgres 就绪
echo "[$(date)] Waiting for PostgreSQL to be ready..."
MAX_WAIT=60
WAITED=0
until docker exec mimic-postgres pg_isready -U postgres >/dev/null 2>&1; do
    sleep 2
    WAITED=$((WAITED + 2))
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo "[$(date)] ERROR: PostgreSQL did not become ready in $MAX_WAIT seconds"
        exit 1
    fi
    echo "[$(date)] Waiting... ($WAITED/$MAX_WAIT seconds)"
done

# 额外等待确保数据库完全初始化
sleep 5

echo "[$(date)] Restoring data from backup..."
gunzip -c "$LATEST_BACKUP" | docker exec -i mimic-postgres psql -U postgres -d mimic -q

echo "[$(date)] Starting all services..."
docker compose up -d

# 等待服务健康
echo "[$(date)] Waiting for services to be healthy..."
sleep 10

# 验证恢复
echo "[$(date)] Verifying restore..."
DRAWING_COUNT=$(docker exec mimic-postgres psql -U postgres -d mimic -t -c "SELECT COUNT(*) FROM drawings;" 2>/dev/null | tr -d ' ')
ROOM_COUNT=$(docker exec mimic-postgres psql -U postgres -d mimic -t -c "SELECT COUNT(*) FROM rooms;" 2>/dev/null | tr -d ' ')

echo ""
echo "========================================"
echo "  恢复完成!"
echo "========================================"
echo "  Drawings: $DRAWING_COUNT"
echo "  Rooms: $ROOM_COUNT"
echo "========================================"

# 记录到日志
echo "$(date +%Y%m%d_%H%M%S),RESTORE,$LATEST_BACKUP,SUCCESS" >> "$BACKUP_DIR/backup.log"
