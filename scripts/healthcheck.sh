#!/bin/bash
# 数据库健康检查 + 自动恢复脚本
# 每 5 分钟由 cron 执行

PROJECT_DIR="/home/test/The-Reverse-Turing-Test"
BACKUP_DIR="$PROJECT_DIR/backups"
LOCK_FILE="/tmp/mimic-restore.lock"
LOG_FILE="$BACKUP_DIR/healthcheck.log"

log() {
    echo "[$(date)] $1" | tee -a "$LOG_FILE"
}

# 检查 postgres 容器是否运行
check_container() {
    docker ps --format '{{.Names}}' | grep -q '^mimic-postgres$'
    return $?
}

# 检查数据库连接和核心表
check_database() {
    docker exec mimic-postgres psql -U postgres -d mimic -c \
        "SELECT 1 FROM drawings LIMIT 1;" > /dev/null 2>&1
    return $?
}

# 检查 mimic 数据库是否存在
check_database_exists() {
    docker exec mimic-postgres psql -U postgres -c \
        "SELECT 1 FROM pg_database WHERE datname='mimic';" 2>/dev/null | grep -q "1"
    return $?
}

# 主逻辑
main() {
    # 检查容器
    if ! check_container; then
        log "WARNING: mimic-postgres container is not running"
        # 尝试启动容器
        cd "$PROJECT_DIR"
        docker compose up -d postgres
        sleep 10
        if ! check_container; then
            log "ERROR: Failed to start postgres container"
            return 1
        fi
    fi

    # 检查数据库是否存在
    if ! check_database_exists; then
        log "CRITICAL: Database 'mimic' does not exist! Possible attack detected."
        trigger_restore
        return $?
    fi

    # 检查数据库表
    if ! check_database; then
        log "WARNING: Database check failed, tables may be missing"
        trigger_restore
        return $?
    fi

    # 一切正常
    log "OK: Database healthy"
    return 0
}

trigger_restore() {
    log "Initiating automatic restore..."

    # 防止重复恢复
    if [ -f "$LOCK_FILE" ]; then
        LOCK_AGE=$(($(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0)))
        if [ $LOCK_AGE -lt 600 ]; then  # 10 分钟内的锁
            log "Restore already in progress (lock age: ${LOCK_AGE}s), skipping"
            return 1
        else
            log "Stale lock file found (age: ${LOCK_AGE}s), removing"
            rm -f "$LOCK_FILE"
        fi
    fi

    # 检查备份是否存在
    if [ ! -f "$BACKUP_DIR/latest.sql.gz" ]; then
        log "ERROR: No backup available for restore!"
        return 1
    fi

    # 创建锁文件
    touch "$LOCK_FILE"
    trap "rm -f $LOCK_FILE" EXIT

    # 执行恢复
    log "Running restore script..."
    if "$PROJECT_DIR/scripts/restore.sh" < /dev/null; then
        log "Auto-restore completed successfully"
        rm -f "$LOCK_FILE"
        return 0
    else
        log "ERROR: Auto-restore failed"
        rm -f "$LOCK_FILE"
        return 1
    fi
}

# 执行
main
