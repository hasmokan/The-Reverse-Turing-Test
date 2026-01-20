#!/bin/bash
# PostgreSQL 自动备份脚本
# 每小时执行一次，保留 7 天 (168 份)

set -e

PROJECT_DIR="/home/test/The-Reverse-Turing-Test"
BACKUP_DIR="$PROJECT_DIR/backups"
HOURLY_DIR="$BACKUP_DIR/hourly"
RETENTION_HOURS=168  # 7 days
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$HOURLY_DIR/mimic_$TIMESTAMP.sql.gz"

# 创建目录
mkdir -p "$HOURLY_DIR"

# 检查 postgres 容器是否运行
if ! docker ps --format '{{.Names}}' | grep -q '^mimic-postgres$'; then
    echo "[$(date)] ERROR: mimic-postgres container is not running"
    exit 1
fi

# 执行备份 (通过 docker exec)
echo "[$(date)] Starting backup..."
docker exec mimic-postgres pg_dump -U postgres -d mimic 2>/dev/null | gzip > "$BACKUP_FILE"

# 验证备份文件
if [ ! -s "$BACKUP_FILE" ]; then
    echo "[$(date)] ERROR: Backup file is empty"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# 创建最新备份的软链接
ln -sf "$BACKUP_FILE" "$BACKUP_DIR/latest.sql.gz"

# 记录备份大小
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup completed: $BACKUP_FILE ($SIZE)"

# 清理过期备份
DELETED=$(find "$HOURLY_DIR" -name "mimic_*.sql.gz" -mmin +$((RETENTION_HOURS * 60)) -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "[$(date)] Cleaned up $DELETED backups older than $RETENTION_HOURS hours"
fi

# 记录到日志
echo "$TIMESTAMP,$BACKUP_FILE,$SIZE,SUCCESS" >> "$BACKUP_DIR/backup.log"

# 显示当前备份数量
COUNT=$(find "$HOURLY_DIR" -name "mimic_*.sql.gz" | wc -l)
echo "[$(date)] Total backups: $COUNT"
