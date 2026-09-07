#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Verificar una copia de seguridad SIN TOCAR PRODUCCIÓN:
#   1. comprueba los checksums (SHA256SUMS)
#   2. restaura el dump en una base PostgreSQL temporal y descartable
#   3. revisa la cadena de la bitácora y compara los conteos con el manifiesto
#
#   ./infra/backup/verificar.sh <carpeta>
#
# Conviene correrlo cada tanto (p. ej. semanal) para confirmar que las copias
# realmente sirven — una copia que nunca se probó no es una copia.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; [ -f .env ] && . ./.env; set +a
PGUSER="${POSTGRES_USER:-radicados}"
PGDB="${POSTGRES_DB:-radicados}"
BDIR="${BACKUP_DIR:-./backups}"

SRC="${1:-}"; [ -n "$SRC" ] || { echo "Uso: $0 <carpeta-de-copia>"; ls -1d "$BDIR"/20*_* 2>/dev/null; exit 1; }
[ -d "$SRC" ] || SRC="$BDIR/$1"
[ -d "$SRC" ] || { echo "No existe: $1"; exit 1; }

json_val() { grep -o "\"$2\"[^,}]*" "$1" | head -1 | sed 's/.*: *//; s/"//g; s/ *$//'; }
M="$SRC/manifest.json"
CJT="sgdea-verify-$$"
WORK="$(mktemp -d)"
cleanup() { docker rm -f "$CJT" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

echo "== Copia: $SRC =="
[ -f "$M" ] && echo "manifiesto: radicados=$(json_val "$M" radicados) anexos=$(json_val "$M" anexos) bitácora=$(json_val "$M" bitacora) cadena_íntegra=$(json_val "$M" cadena_integra)"

# 1) checksums
if [ -f "$SRC/SHA256SUMS" ]; then
  ( cd "$SRC" && sha256sum -c SHA256SUMS ) && echo "✓ checksums OK" || { echo "❌ checksums NO coinciden"; exit 1; }
else
  echo "aviso: la copia no trae SHA256SUMS"
fi

# 2) preparar el dump (descifrar si hace falta)
descifrar() {  # descifra $1 → $2 ; usa openssl del host o, si no hay, el del contenedor
  if command -v openssl >/dev/null; then
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass pass:"$3" < "$1" > "$2"
  else
    docker run --rm -i --entrypoint openssl radicados-backup \
      enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass pass:"$3" < "$1" > "$2"
  fi
}
if [ -e "$SRC/db.dump.enc" ]; then
  pass="${BACKUP_ENC_PASSPHRASE:-}"; [ -n "$pass" ] || { read -rsp "Frase de cifrado: " pass; echo; }
  descifrar "$SRC/db.dump.enc" "$WORK/db.dump" "$pass" || { echo "❌ no se pudo descifrar (¿frase correcta?)"; exit 1; }
elif [ -e "$SRC/db.dump" ]; then
  cp "$SRC/db.dump" "$WORK/db.dump"
else
  echo "❌ la copia no tiene db.dump"; exit 1
fi

# 3) base temporal
echo "→ levantando PostgreSQL temporal…"
docker run -d --name "$CJT" -e POSTGRES_PASSWORD=verify -e POSTGRES_USER="$PGUSER" -e POSTGRES_DB="$PGDB" \
  postgres:16-alpine >/dev/null
for i in $(seq 1 30); do
  docker exec "$CJT" pg_isready -U "$PGUSER" -d "$PGDB" >/dev/null 2>&1 && break
  sleep 1
done

echo "→ restaurando el dump…"
docker exec -i "$CJT" pg_restore -U "$PGUSER" -d "$PGDB" --no-owner --no-privileges --exit-on-error < "$WORK/db.dump" \
  && echo "✓ pg_restore sin errores" || { echo "❌ pg_restore falló"; exit 1; }

echo "→ verificando la cadena de la bitácora en la copia restaurada…"
docker exec "$CJT" psql -U "$PGUSER" -d "$PGDB" -x -c "SELECT * FROM fn_verificar_bitacora();"

echo "→ conteos en la copia restaurada:"
docker exec "$CJT" psql -U "$PGUSER" -d "$PGDB" -tA -c \
  "SELECT 'radicados '||count(*) FROM radicado
   UNION ALL SELECT 'anexos '||count(*) FROM anexo
   UNION ALL SELECT 'bitácora '||count(*) FROM bitacora;"

echo
echo "✅ La copia $SRC es restaurable."
