#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Copia de seguridad del SGDEA  ·  se ejecuta DENTRO del contenedor `backup`,
# hablando con `postgres` y `minio` por la red de Docker (no usa el socket de
# Docker). Para una copia manual:   docker compose run --rm backup
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

DEST="${BACKUP_DEST:-/backups}"
PGHOST="${BACKUP_PGHOST:-postgres}"
PGUSER="${POSTGRES_USER:-radicados}"
PGDB="${POSTGRES_DB:-radicados}"
export PGPASSWORD="${POSTGRES_PASSWORD:-radicados_dev}"
MC_URL="${BACKUP_MINIO_URL:-http://minio:9000}"
MC_KEY="${MINIO_ROOT_USER:-minioadmin}"
MC_SECRET="${MINIO_ROOT_PASSWORD:-minioadmin_dev}"
BUCKET="${MINIO_BUCKET:-radicados}"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
MIN_FREE_MB="${BACKUP_MIN_FREE_MB:-1500}"
CONFIG_DIR="${BACKUP_CONFIG_DIR:-}"
ENC_PASS="${BACKUP_ENC_PASSPHRASE:-}"
OFFSITE_CMD="${BACKUP_OFFSITE_CMD:-}"
NOTIFY_URL="${BACKUP_NOTIFY_URL:-}"

STAMP="$(date +%Y-%m-%d_%H%M%S)"
RUN="$DEST/$STAMP"
LOCK="$DEST/.lock"
log() { echo "[$(date -Is)] $*"; }
fail() { log "ERROR: $*"; finalizar "error" "$*"; exit 1; }

notificar() {
  [ -n "$NOTIFY_URL" ] || return 0
  curl -fsS -m 15 -X POST "$NOTIFY_URL" -H 'Content-Type: application/json' \
    -d "$1" >/dev/null 2>&1 || log "aviso: no se pudo notificar a $NOTIFY_URL"
}

finalizar() {
  local estado="$1" detalle="${2:-}"
  notificar "{\"servicio\":\"sgdea-backup\",\"estado\":\"$estado\",\"stamp\":\"$STAMP\",\"detalle\":\"${detalle//\"/}\"}"
  rmdir "$LOCK" 2>/dev/null || true
}

# ── candado: no solapar ejecuciones ─────────────────────────────────────────
mkdir -p "$DEST"
if ! mkdir "$LOCK" 2>/dev/null; then
  log "otra copia está en curso ($LOCK); se omite esta ejecución"
  exit 0
fi
trap 'finalizar "interrumpido"' INT TERM

# ── espacio en disco ───────────────────────────────────────────────────────
FREE_MB="$(df -Pk "$DEST" | awk 'NR==2{print int($4/1024)}')"
log "espacio libre en $DEST: ${FREE_MB} MB (mínimo exigido: ${MIN_FREE_MB} MB)"
[ "${FREE_MB:-0}" -ge "$MIN_FREE_MB" ] || fail "espacio insuficiente; no se hace la copia (libere disco o baje BACKUP_MIN_FREE_MB)"

mkdir -p "$RUN"
log "copia $STAMP → $RUN"

# ── 1. PostgreSQL (formato custom, comprimido, restaurable con pg_restore) ──
log "pg_dump de $PGDB@$PGHOST ..."
pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDB" -Fc -Z6 --no-owner --no-privileges \
  -f "$RUN/db.dump" || fail "pg_dump falló"
DB_BYTES="$(stat -c%s "$RUN/db.dump")"
log "   db.dump  $((DB_BYTES/1024)) KB"

# ── 1b. estado de la base al momento de la copia ───────────────────────────
STATS="$(psql -h "$PGHOST" -U "$PGUSER" -d "$PGDB" -tA -F'|' -c \
  "SELECT (SELECT count(*) FROM radicado),
          (SELECT count(*) FROM anexo),
          (SELECT count(*) FROM bitacora),
          v.ok, v.total, coalesce(v.ruptura_id::text,'')
     FROM fn_verificar_bitacora() v;" 2>/dev/null || echo "|||||")"
IFS='|' read -r N_RAD N_ANX N_BIT CHAIN_OK CHAIN_TOTAL CHAIN_BREAK <<< "$STATS"
log "   radicados=$N_RAD  anexos=$N_ANX  bitácora=$N_BIT  cadena_íntegra=${CHAIN_OK:-?}"
[ "${CHAIN_OK:-}" = "t" ] || log "   ⚠  la cadena de la bitácora NO verifica (ruptura en id=${CHAIN_BREAK:-?}) — se conserva la copia igual para análisis"

# ── 2. Objetos de MinIO (los documentos/anexos) ───────────────────────────
log "espejo de MinIO bucket '$BUCKET' ..."
mc alias set src "$MC_URL" "$MC_KEY" "$MC_SECRET" >/dev/null 2>&1 || fail "no se pudo conectar a MinIO"
TMP_OBJ="$RUN/.objetos"
mkdir -p "$TMP_OBJ"
mc mirror --overwrite "src/$BUCKET" "$TMP_OBJ" > "$RUN/.mirror.log" 2>&1 \
  || { tail -5 "$RUN/.mirror.log"; fail "mc mirror falló"; }
rm -f "$RUN/.mirror.log"
N_OBJ="$(find "$TMP_OBJ" -type f | wc -l | tr -d ' ')"
tar -C "$RUN" -czf "$RUN/objetos.tar.gz" .objetos && rm -rf "$TMP_OBJ"
OBJ_BYTES="$(stat -c%s "$RUN/objetos.tar.gz")"
log "   objetos.tar.gz  $((OBJ_BYTES/1024)) KB  ($N_OBJ archivos)"

# ── 3. Configuración (.env, compose*.yml) si se montó el repo ──────────────
CFG_BYTES=0
if [ -n "$CONFIG_DIR" ] && [ -d "$CONFIG_DIR" ]; then
  log "configuración desde $CONFIG_DIR ..."
  tar -C "$CONFIG_DIR" -czf "$RUN/config.tar.gz" \
    $( cd "$CONFIG_DIR" && ls -d .env .env.* compose*.yml 2>/dev/null ) 2>/dev/null || true
  [ -f "$RUN/config.tar.gz" ] && CFG_BYTES="$(stat -c%s "$RUN/config.tar.gz")" \
    && log "   config.tar.gz  $((CFG_BYTES/1024)) KB  (contiene secretos — protéjala)"
fi

# ── 4. Cifrado opcional (openssl AES-256) ─────────────────────────────────
CIFRADO="no"
if [ -n "$ENC_PASS" ]; then
  command -v openssl >/dev/null || fail "se pidió cifrado pero no hay openssl en el contenedor"
  log "cifrando artefactos (AES-256) ..."
  for f in "$RUN"/db.dump "$RUN"/objetos.tar.gz "$RUN"/config.tar.gz; do
    [ -f "$f" ] || continue
    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass pass:"$ENC_PASS" \
      -in "$f" -out "$f.enc" || fail "el cifrado de $(basename "$f") falló"
    rm -f "$f"
  done
  CIFRADO="aes-256-cbc/pbkdf2"
fi

# ── 5. Manifiesto + checksums ─────────────────────────────────────────────
ARCHIVOS_JSON="$(cd "$RUN" && for f in *; do
  case "$f" in SHA256SUMS|manifest.json|RESTAURAR.txt) continue ;; esac
  [ -f "$f" ] || continue
  printf '{"archivo":"%s","bytes":%s,"sha256":"%s"},' \
    "$f" "$(stat -c%s "$f")" "$(sha256sum "$f" | cut -d' ' -f1)"
done | sed 's/,$//')"
( cd "$RUN" && sha256sum db.dump* objetos.tar.gz* config.tar.gz* 2>/dev/null > SHA256SUMS ) || true

cat > "$RUN/manifest.json" <<EOF
{
  "sistema": "SGDEA · Cootracir",
  "stamp": "$STAMP",
  "creado": "$(date -Is)",
  "host_db": "$PGHOST",
  "cifrado": "$CIFRADO",
  "base_datos": {
    "radicados": ${N_RAD:-null},
    "anexos": ${N_ANX:-null},
    "bitacora": ${N_BIT:-null},
    "cadena_integra": $( [ "${CHAIN_OK:-}" = "t" ] && echo true || echo false ),
    "cadena_total": ${CHAIN_TOTAL:-null},
    "cadena_ruptura_id": $( [ -n "${CHAIN_BREAK:-}" ] && echo "\"$CHAIN_BREAK\"" || echo null )
  },
  "objetos_minio": ${N_OBJ:-null},
  "artefactos": [ ${ARCHIVOS_JSON:-} ]
}
EOF

cat > "$RUN/RESTAURAR.txt" <<'EOF'
Cómo restaurar esta copia
=========================
Desde el servidor, en la carpeta del proyecto (donde está compose.yml):

  ./infra/backup/restaurar.sh <esta-carpeta>            # menú interactivo
  ./infra/backup/restaurar.sh <esta-carpeta> db         # solo la base de datos
  ./infra/backup/restaurar.sh <esta-carpeta> objetos    # solo los documentos

Verificar que la copia sirve (restaura en una base temporal y revisa la
cadena de la bitácora), sin tocar producción:

  ./infra/backup/verificar.sh <esta-carpeta>

Si la copia está cifrada (archivos .enc) hace falta BACKUP_ENC_PASSPHRASE.
EOF

# ── 6. Retención: borra copias más viejas que BACKUP_RETENTION_DAYS ───────
log "retención: se conservan las copias de los últimos $RETENTION días"
find "$DEST" -maxdepth 1 -type d -name '20*_*' -mtime +"$RETENTION" -print -exec rm -rf {} \; \
  | sed 's/^/   purgada: /'

# ── 7. Copia fuera del servidor (opcional) ───────────────────────────────
if [ -n "$OFFSITE_CMD" ]; then
  log "copia externa: ${OFFSITE_CMD//$ENC_PASS/***}"
  CMD="${OFFSITE_CMD//\{\}/$RUN}"
  bash -c "$CMD" && log "   copia externa OK" || log "   ⚠ la copia externa falló"
fi

TOTAL_KB=$(( (DB_BYTES + OBJ_BYTES + CFG_BYTES) / 1024 ))
log "OK · copia $STAMP completa · ${TOTAL_KB} KB · $DEST/$STAMP"
finalizar "ok" "radicados=$N_RAD anexos=$N_ANX objetos=$N_OBJ ${TOTAL_KB}KB"
