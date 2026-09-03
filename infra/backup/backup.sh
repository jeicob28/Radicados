#!/usr/bin/env bash
# Copia de seguridad del SGDEA: dump de PostgreSQL + espejo del bucket de MinIO.
# Ejecutar desde la raíz del proyecto (donde está compose.yml).
#
# Cron sugerido (diario 02:00, retención 14 días — ver PURGE_DAYS):
#   0 2 * * * cd /home/administrador/radicados-sgdea && ./infra/backup/backup.sh >> backups/backup.log 2>&1
set -euo pipefail

DEST="${BACKUP_DIR:-./backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
PURGE_DAYS="${PURGE_DAYS:-14}"
mkdir -p "$DEST"

# --- PostgreSQL ---
echo "[$(date -Is)] dump postgres..."
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-radicados}" -d "${POSTGRES_DB:-radicados}" -Fc \
  > "$DEST/pg_${STAMP}.dump"

# --- MinIO (objetos) ---
echo "[$(date -Is)] espejo minio..."
docker compose exec -T minio sh -c '
  mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1 || \
  mc alias set local http://localhost:9000 minioadmin minioadmin_dev >/dev/null 2>&1
  mc mirror --overwrite --quiet local/'"${MINIO_BUCKET:-radicados}"' /tmp/backup-mirror
  cd /tmp && tar czf - backup-mirror
' > "$DEST/minio_${STAMP}.tar.gz"

# --- retención ---
find "$DEST" -name 'pg_*.dump' -mtime +"$PURGE_DAYS" -delete
find "$DEST" -name 'minio_*.tar.gz' -mtime +"$PURGE_DAYS" -delete

echo "[$(date -Is)] OK -> $DEST/pg_${STAMP}.dump , $DEST/minio_${STAMP}.tar.gz"
echo "Restauración: docker compose exec -T postgres pg_restore -U radicados -d radicados --clean --if-exists < pg_XXXX.dump"
