#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Restaurar una copia de seguridad del SGDEA.  Se ejecuta EN EL SERVIDOR, en la
# carpeta del proyecto (donde están compose.yml y .env).
#
#   ./infra/backup/restaurar.sh                       → lista las copias
#   ./infra/backup/restaurar.sh <carpeta>             → menú (qué restaurar)
#   ./infra/backup/restaurar.sh <carpeta> db          → solo la base de datos
#   ./infra/backup/restaurar.sh <carpeta> objetos     → solo los documentos
#   ./infra/backup/restaurar.sh <carpeta> config      → extrae .env/compose
#   ./infra/backup/restaurar.sh <carpeta> todo        → base + documentos
#
# ⚠  Restaurar la base y los documentos SOBREESCRIBE los datos actuales.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/../.."          # raíz del proyecto

set -a; [ -f .env ] && . ./.env; set +a
PGUSER="${POSTGRES_USER:-radicados}"
PGDB="${POSTGRES_DB:-radicados}"
BUCKET="${MINIO_BUCKET:-radicados}"
BDIR="${BACKUP_DIR:-./backups}"
DC="docker compose -f compose.yml -f compose.prod.yml"

json_val() { grep -o "\"$2\"[^,}]*" "$1" | head -1 | sed 's/.*: *//; s/"//g; s/ *$//'; }

listar() {
  echo "Copias disponibles en $BDIR:"
  local encontrada=0 m
  for d in "$BDIR"/20*_*; do
    [ -d "$d" ] || continue; encontrada=1
    m="$d/manifest.json"
    if [ -f "$m" ]; then
      printf '  %-19s  radicados=%s  anexos=%s  objetos=%s  cadena=%s  cifrado=%s\n' \
        "$(basename "$d")" "$(json_val "$m" radicados)" "$(json_val "$m" anexos)" \
        "$(json_val "$m" objetos_minio)" \
        "$([ "$(json_val "$m" cadena_integra)" = true ] && echo OK || echo REVISAR)" \
        "$(json_val "$m" cifrado)"
    else
      echo "  $(basename "$d")  (sin manifest)"
    fi
  done
  [ "$encontrada" = 1 ] || echo "  (ninguna)"
}

descifra1() {   # $1 = .enc origen, $2 = destino, $3 = frase
  if command -v openssl >/dev/null; then
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass pass:"$3" < "$1" > "$2"
  else
    docker run --rm -i --entrypoint openssl radicados-backup \
      enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass pass:"$3" < "$1" > "$2"
  fi
}

descifrar_si_hace_falta() {   # $1 = carpeta origen  →  deja los .dump/.tar.gz en $WORK
  WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
  local hay_enc=0
  for f in "$1"/*.enc; do [ -e "$f" ] && hay_enc=1; done
  if [ "$hay_enc" = 1 ]; then
    local pass="${BACKUP_ENC_PASSPHRASE:-}"
    [ -n "$pass" ] || { read -rsp "Frase de cifrado de la copia: " pass; echo; }
    for f in "$1"/*.enc; do
      [ -e "$f" ] || continue
      descifra1 "$f" "$WORK/$(basename "${f%.enc}")" "$pass" || { echo "frase incorrecta"; exit 1; }
    done
  else
    cp "$1"/*.dump "$1"/*.tar.gz "$WORK/" 2>/dev/null || true
  fi
}

verificar_checksums() {
  [ -f "$1/SHA256SUMS" ] || { echo "aviso: no hay SHA256SUMS en la copia"; return 0; }
  ( cd "$1" && sha256sum -c SHA256SUMS ) || { echo "❌ checksums no coinciden — copia corrupta"; exit 1; }
  echo "✓ checksums OK"
}

restaurar_db() {
  echo ">> Restaurando la BASE DE DATOS ($PGDB)…"
  $DC stop api worker >/dev/null
  # recrear la base para no arrastrar objetos huérfanos
  $DC exec -T postgres psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"$PGDB\" WITH (FORCE);" -c "CREATE DATABASE \"$PGDB\" OWNER \"$PGUSER\";"
  $DC exec -T postgres pg_restore -U "$PGUSER" -d "$PGDB" --no-owner --no-privileges --exit-on-error < "$WORK/db.dump"
  $DC start api worker >/dev/null
  echo "✓ base de datos restaurada. Verificando la cadena de la bitácora…"
  $DC exec -T postgres psql -U "$PGUSER" -d "$PGDB" -c "SELECT * FROM fn_verificar_bitacora();"
}

restaurar_objetos() {
  echo ">> Restaurando los DOCUMENTOS (bucket $BUCKET)…"
  local tmp; tmp="$(mktemp -d)"
  tar -C "$tmp" -xzf "$WORK/objetos.tar.gz"
  docker run --rm --network radicados_default -v "$tmp/.objetos:/data:ro" --entrypoint sh minio/mc:latest -c "
    mc alias set dst http://minio:9000 '${MINIO_ROOT_USER:-minioadmin}' '${MINIO_ROOT_PASSWORD:-minioadmin_dev}' >/dev/null
    mc mb --ignore-existing dst/$BUCKET >/dev/null
    mc mirror --overwrite /data dst/$BUCKET
  "
  rm -rf "$tmp"
  echo "✓ documentos restaurados"
}

restaurar_config() {
  local out="$1/config-restaurado"
  mkdir -p "$out"; tar -C "$out" -xzf "$WORK/config.tar.gz"
  echo "✓ configuración extraída en $out (revísela; NO se sobreescribió el .env activo)"
}

# ── main ───────────────────────────────────────────────────────────────────
[ $# -ge 1 ] || { listar; echo; echo "Uso: $0 <carpeta> [db|objetos|config|todo]"; exit 0; }

SRC="$1"; [ -d "$SRC" ] || SRC="$BDIR/$1"
[ -d "$SRC" ] || { echo "No existe la copia: $1"; echo; listar; exit 1; }
QUE="${2:-menu}"

echo "Copia:  $SRC"
[ -f "$SRC/manifest.json" ] && cat "$SRC/manifest.json"
echo
verificar_checksums "$SRC"

if [ "$QUE" = "menu" ]; then
  echo; echo "¿Qué restaurar?  [1] base de datos   [2] documentos   [3] base + documentos   [4] configuración   [0] cancelar"
  read -rp "> " op
  case "$op" in 1) QUE=db;; 2) QUE=objetos;; 3) QUE=todo;; 4) QUE=config;; *) echo "cancelado"; exit 0;; esac
fi

read -rp "Esto SOBREESCRIBE los datos actuales ($QUE). Escriba 'RESTAURAR' para continuar: " ok
[ "$ok" = "RESTAURAR" ] || { echo "cancelado"; exit 0; }

descifrar_si_hace_falta "$SRC"
case "$QUE" in
  db)       restaurar_db ;;
  objetos)  restaurar_objetos ;;
  config)   restaurar_config "$SRC" ;;
  todo)     restaurar_db; restaurar_objetos ;;
  *) echo "opción no válida: $QUE"; exit 1 ;;
esac
echo "Listo."
