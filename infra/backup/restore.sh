#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Restauración de una copia — se ejecuta DENTRO del contenedor `backup`, lo
# lanza el watcher cuando el ADMIN pide restaurar desde el panel.
#
#   restore.sh <carpeta-de-la-copia> <db|objetos|todo>
#
# A diferencia de infra/backup/restaurar.sh (host, recrea la base), aquí no se
# pueden parar contenedores: se vacía el esquema `public` y se hace pg_restore
# con la API arriba (que responde 503 por el modo mantenimiento mientras tanto).
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

RUN="${1:?falta la carpeta de la copia}"
ALCANCE="${2:-db}"

PGHOST="${BACKUP_PGHOST:-postgres}"
PGUSER="${POSTGRES_USER:-radicados}"
PGDB="${POSTGRES_DB:-radicados}"
export PGPASSWORD="${POSTGRES_PASSWORD:-radicados_dev}"
MC_URL="${BACKUP_MINIO_URL:-http://minio:9000}"
MC_KEY="${MINIO_ROOT_USER:-minioadmin}"
MC_SECRET="${MINIO_ROOT_PASSWORD:-minioadmin_dev}"
BUCKET="${MINIO_BUCKET:-radicados}"
ENC_PASS="${BACKUP_ENC_PASSPHRASE:-}"

log()  { echo "[$(date -Is)] $*"; }
fail() { log "ERROR: $*"; exit 1; }

[ -d "$RUN" ] || fail "no existe la carpeta $RUN"
PSQL=(psql -h "$PGHOST" -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=1 -X -q)

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# ── verificación de checksums ──────────────────────────────────────────────
if [ -f "$RUN/SHA256SUMS" ]; then
  log "verificando checksums ..."
  ( cd "$RUN" && sha256sum -c SHA256SUMS ) || fail "los checksums no coinciden — la copia está corrupta o incompleta"
fi

# ── prepara un artefacto: lo descifra si hace falta ────────────────────────
prep() {  # $1 = nombre base (db.dump / objetos.tar.gz)
  local b="$1"
  if [ -f "$RUN/$b" ]; then echo "$RUN/$b"; return 0; fi
  if [ -f "$RUN/$b.enc" ]; then
    [ -n "$ENC_PASS" ] || fail "la copia está cifrada y no se recibió la frase (passphrase)"
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass pass:"$ENC_PASS" \
      -in "$RUN/$b.enc" -out "$WORK/$b" 2>/dev/null || fail "no se pudo descifrar $b (¿frase incorrecta?)"
    echo "$WORK/$b"; return 0
  fi
  fail "la copia no contiene $b"
}

# ── base de datos ─────────────────────────────────────────────────────────
if [ "$ALCANCE" = "db" ] || [ "$ALCANCE" = "todo" ]; then
  DUMP="$(prep db.dump)"
  head -c 5 "$DUMP" | grep -q 'PGDMP' || fail "db.dump no parece un volcado de PostgreSQL (formato custom)"

  log "cerrando conexiones y vaciando el esquema public de $PGDB@$PGHOST ..."
  "${PSQL[@]}" <<'SQL' || fail "no se pudo preparar el esquema (¿alguien mantiene la base ocupada?)"
SET lock_timeout = '20s';
SET statement_timeout = '120s';
SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
 WHERE datname = current_database()
   AND pid <> pg_backend_pid()
   AND backend_type = 'client backend';
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
SQL

  log "pg_restore ..."
  pg_restore -h "$PGHOST" -U "$PGUSER" -d "$PGDB" --no-owner --no-privileges --no-comments \
    "$DUMP" 2> "$WORK/pgrestore.err"
  rc=$?
  if grep -qiE '^pg_restore: error:' "$WORK/pgrestore.err"; then
    sed 's/^/   /' "$WORK/pgrestore.err"
    fail "pg_restore reportó errores"
  fi
  [ "$rc" -ne 0 ] && { log "pg_restore terminó con avisos (rc=$rc):"; sed 's/^/   /' "$WORK/pgrestore.err"; }

  CAD="$("${PSQL[@]}" -tA -c "SELECT ok || ' · ' || total || ' registros' FROM fn_verificar_bitacora() v" 2>/dev/null || echo '?')"
  RAD="$("${PSQL[@]}" -tA -c 'SELECT count(*) FROM radicado' 2>/dev/null || echo '?')"
  log "base restaurada · radicados=$RAD · cadena de la bitácora: $CAD"
fi

# ── documentos (MinIO) ───────────────────────────────────────────────────
if [ "$ALCANCE" = "objetos" ] || [ "$ALCANCE" = "todo" ]; then
  OBJ="$(prep objetos.tar.gz)"
  mkdir -p "$WORK/obj"
  tar -C "$WORK/obj" -xzf "$OBJ" || fail "no se pudo extraer objetos.tar.gz"
  SRC="$WORK/obj/.objetos"; [ -d "$SRC" ] || SRC="$WORK/obj"
  mc alias set dst "$MC_URL" "$MC_KEY" "$MC_SECRET" >/dev/null 2>&1 || fail "no se pudo conectar a MinIO"
  mc mb --ignore-existing "dst/$BUCKET" >/dev/null 2>&1 || true
  mc mirror --overwrite "$SRC" "dst/$BUCKET" > "$WORK/mirror.log" 2>&1 \
    || { tail -5 "$WORK/mirror.log"; fail "mc mirror falló"; }
  N="$(find "$SRC" -type f | wc -l | tr -d ' ')"
  log "documentos restaurados a MinIO/$BUCKET ($N archivos)"
fi

log "restauración ($ALCANCE) completada"
