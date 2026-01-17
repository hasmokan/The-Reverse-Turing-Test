#!/bin/bash
set -e

# Create log directory
mkdir -p /var/log/supervisor

# Initialize PostgreSQL if not already done
if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
    echo "Initializing PostgreSQL database..."
    su - postgres -c "/usr/lib/postgresql/15/bin/initdb -D /var/lib/postgresql/data"
    
    # Start PostgreSQL temporarily to create database
    su - postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/data -l /tmp/pg_init.log start"
    sleep 3
    
    # Create database and run schema
    su - postgres -c "createdb mimic"
    su - postgres -c "psql -d mimic -f /app/backend/schema.sql"
    
    # Stop PostgreSQL (supervisord will start it)
    su - postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/data stop"
    sleep 2
fi

echo "Starting all services via supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
