#!/bin/bash
# Arranque del servicio de backup: programa el cron y lo deja corriendo.
#   BACKUP_CRON       expresión cron (por defecto "0 2 * * *")
#   BACKUP_ON_START   si es "1", hace una copia al arrancar
set -euo pipefail

echo "[backup] servicio iniciado $(date -Is)"
echo "[backup] programado: '${BACKUP_CRON}'  (TZ=${TZ:-UTC})  ·  retención ${BACKUP_RETENTION_DAYS} días  ·  destino ${BACKUP_DEST}"

mkdir -p "${BACKUP_DEST}"

# cron no hereda el entorno de Docker: lo congelamos en un archivo que el job lee.
env | grep -E '^(POSTGRES_|MINIO_|BACKUP_|DATABASE_URL|TZ)=' | sed 's/^/export /' > /scripts/backup.env
chmod 600 /scripts/backup.env

# crontab de root
cat > /etc/crontabs/root <<EOF
SHELL=/bin/bash
TZ=${TZ:-UTC}
${BACKUP_CRON} . /scripts/backup.env; /scripts/backup.sh >> ${BACKUP_DEST}/backup.log 2>&1
EOF

if [ "${BACKUP_ON_START:-0}" = "1" ]; then
  echo "[backup] BACKUP_ON_START=1 → copia inicial"
  /scripts/backup.sh >> "${BACKUP_DEST}/backup.log" 2>&1 || echo "[backup] la copia inicial falló (revise ${BACKUP_DEST}/backup.log)"
fi

echo "[backup] cron en marcha; los registros van a ${BACKUP_DEST}/backup.log y a 'docker compose logs backup'"
exec crond -f -d 8
