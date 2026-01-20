#!/bin/bash
# 安装 cron 定时任务脚本

PROJECT_DIR="/home/test/The-Reverse-Turing-Test"
BACKUP_DIR="$PROJECT_DIR/backups"

echo "========================================"
echo "  安装 Mimic 备份定时任务"
echo "========================================"
echo ""

# 确保日志目录存在
mkdir -p "$BACKUP_DIR"

# 定义 cron 任务
CRON_BACKUP="0 * * * * $PROJECT_DIR/scripts/backup.sh >> $BACKUP_DIR/cron.log 2>&1"
CRON_HEALTH="*/5 * * * * $PROJECT_DIR/scripts/healthcheck.sh >> $BACKUP_DIR/healthcheck.log 2>&1"

# 获取当前 crontab（如果没有则创建空的）
CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")

# 检查是否已存在
if echo "$CURRENT_CRON" | grep -q "backup.sh"; then
    echo "[INFO] Backup cron job already exists, updating..."
    CURRENT_CRON=$(echo "$CURRENT_CRON" | grep -v "backup.sh")
fi

if echo "$CURRENT_CRON" | grep -q "healthcheck.sh"; then
    echo "[INFO] Healthcheck cron job already exists, updating..."
    CURRENT_CRON=$(echo "$CURRENT_CRON" | grep -v "healthcheck.sh")
fi

# 添加新任务
NEW_CRON=$(echo "$CURRENT_CRON"; echo "# Mimic PostgreSQL 备份 - 每小时执行"; echo "$CRON_BACKUP"; echo ""; echo "# Mimic 数据库健康检查 - 每5分钟执行"; echo "$CRON_HEALTH")

# 安装新的 crontab
echo "$NEW_CRON" | crontab -

echo ""
echo "[OK] Cron jobs installed successfully!"
echo ""
echo "Installed jobs:"
echo "  - Backup: Every hour at :00"
echo "  - Health check: Every 5 minutes"
echo ""
echo "View logs:"
echo "  - Backup log: $BACKUP_DIR/cron.log"
echo "  - Health log: $BACKUP_DIR/healthcheck.log"
echo ""
echo "Current crontab:"
crontab -l | grep -E "(backup|healthcheck|Mimic)" | head -10
