#!/bin/sh
# Daily database backup. Keeps the last 14 days in ./backups (next to this script).
# Install (on the server):  crontab -e   →   30 2 * * * /opt/open-crm/deploy/backup.sh
# Restore:  gunzip -c backups/opencrm-YYYY-MM-DD.sql.gz | docker compose -f deploy/docker-compose.prod.yml exec -T db psql -U opencrm -d opencrm
set -eu
cd "$(dirname "$0")/.."
mkdir -p deploy/backups
FILE="deploy/backups/opencrm-$(date +%F).sql.gz"
docker compose -f deploy/docker-compose.prod.yml --env-file .env exec -T db \
  pg_dump -U opencrm -d opencrm --no-owner --clean --if-exists | gzip > "$FILE"
find deploy/backups -name 'opencrm-*.sql.gz' -mtime +14 -delete
echo "Backup written to $FILE"
# Copy backups off the server too (e.g. rclone to Google Drive / any S3 storage) — a backup on the
# same disk does not survive a lost server.
