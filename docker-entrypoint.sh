#!/bin/bash
set -e

PGDATA_DIR="/mnt/workspace/postgresql/data"
REDIS_DIR="/mnt/workspace/redis"
LOG_DIR="/var/log/supervisor"

mkdir -p "$LOG_DIR"
mkdir -p "$REDIS_DIR"
mkdir -p "$(dirname $PGDATA_DIR)"

if [ ! -f "$PGDATA_DIR/PG_VERSION" ]; then
    echo "[PostgreSQL] Initializing database at $PGDATA_DIR..."
    
    mkdir -p "$PGDATA_DIR"
    chown -R postgres:postgres "$PGDATA_DIR"
    chmod 700 "$PGDATA_DIR"
    
    su - postgres -c "/usr/lib/postgresql/15/bin/initdb -D $PGDATA_DIR"
    
    echo "host all all 127.0.0.1/32 trust" >> "$PGDATA_DIR/pg_hba.conf"
    
    su - postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D $PGDATA_DIR -l /tmp/pg_init.log start"
    sleep 3
    
    su - postgres -c "createdb mimic" || true
    su - postgres -c "psql -d mimic -f /app/backend/schema.sql"
    
    su - postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D $PGDATA_DIR stop"
    sleep 2
    
    echo "[PostgreSQL] Database initialized successfully!"
else
    echo "[PostgreSQL] Using existing database at $PGDATA_DIR"
    chown -R postgres:postgres "$PGDATA_DIR"
fi

chown -R redis:redis "$REDIS_DIR" 2>/dev/null || true

export PGDATA="$PGDATA_DIR"

echo "[Startup] Starting all services via supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
