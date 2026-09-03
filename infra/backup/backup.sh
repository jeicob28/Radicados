#!/usr/bin/env bash
# Copia de seguridad del SGDEA: dump de PostgreSQL + espejo del bucket de MinIO.
# Ejecutar desde la raíz del proyecto (donde está compose.yml y .env).
#
# Cron sugerido (diario 02:00, retención 14 días — ver PURGE_DAYS):
#   0 2 * * * cd /home/administrador/radicados-sgdea && ./infra/backup/backup.sh >> backups/backup.log 2>&1
set -euo pipefail

# carga .env (POSTGRES_*, MINIO_*, etc.)
set -a
[ -f .env ] && . ./.env
set +a

DEST="${BACKUP_DIR:-./backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
PURGE_DAYS="${PURGE_DAYS:-14}"
NET="${COMPOSE_NET:-radicados_default}"
BUCKET="${MINIO_BUCKET:-radicados}"
mkdir -p "$DEST"

# --- PostgreSQL ---
echo "[$(date -Is)] dump postgres..."
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-radicados}" -d "${POSTGRES_DB:-radicados}" -Fc \
  > "$DEST/pg_${STAMP}.dump"

# --- MinIO (objetos) — vía contenedor mc con la carpeta de backup montada ---
echo "[$(date -Is)] espejo minio..."
docker run --rm --network "$NET" -v "$(pwd)/$DEST:/backup" --entrypoint sh minio/mc:latest -c "
  mc alias set src http://minio:9000 '${MINIO_ROOT_USER:-minioadmin}' '${MINIO_ROOT_PASSWORD:-minioadmin_dev}' >/dev/null
  mkdir -p /backup/minio_${STAMP}
  mc mirror --overwrite --quiet src/${BUCKET} /backup/minio_${STAMP}
"
( cd "$DEST" && tar czf "minio_${STAMP}.tar.gz" "minio_${STAMP}" && rm -rf "minio_${STAMP}" )

# --- retención ---
find "$DEST" -name 'pg_*.dump' -mtime +"$PURGE_DAYS" -delete
find "$DEST" -name 'minio_*.tar.gz' -mtime +"$PURGE_DAYS" -delete

echo "[$(date -Is)] OK -> $DEST/pg_${STAMP}.dump , $DEST/minio_${STAMP}.tar.gz"
echo "Restaurar BD:  docker compose exec -T postgres pg_restore -U radicados -d radicados --clean --if-exists < pg_XXXX.dump"
