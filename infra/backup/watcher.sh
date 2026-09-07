#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Watcher del servicio de copias.  Atiende las peticiones que el panel de la
# aplicación (módulo "Copias de seguridad", solo ADMIN) deja como archivos JSON
# en  $BACKUP_DEST/.control/queue/ , ejecuta la copia o la restauración y
# publica el resultado en  $BACKUP_DEST/.control/estado.json .
#
# La API nunca ejecuta pg_dump / pg_restore: solo escribe la petición y lee el
# estado. Este contenedor no tiene el socket de Docker.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

DEST="${BACKUP_DEST:-/backups}"
CTL="$DEST/.control"
QUEUE="$CTL/queue"
JOBS="$CTL/jobs"
ESTADO="$CTL/estado.json"
INTERVALO="${BACKUP_WATCH_INTERVAL:-5}"

mkdir -p "$QUEUE" "$JOBS"
log() { echo "[watcher $(date -Is)] $*"; }

# ── estado.json ─────────────────────────────────────────────────────────────
estado_init() {
  [ -f "$ESTADO" ] && jq -e . "$ESTADO" >/dev/null 2>&1 && return 0
  jq -n --arg hb "$(date -Is)" \
    '{servicio:"sgdea-backup", heartbeat:$hb, job:null, historial:[]}' > "$ESTADO"
}

estado_set() {  # $1 = filtro jq   (el resto = argumentos --arg/--argjson ya expandidos por el caller)
  local filtro="$1"; shift
  local tmp; tmp="$(mktemp)"
  if jq --arg hb "$(date -Is)" "$@" ".heartbeat = \$hb | $filtro" "$ESTADO" > "$tmp" 2>/dev/null; then
    mv "$tmp" "$ESTADO"
  else
    rm -f "$tmp"
  fi
}

heartbeat() { estado_set '.'; }

job_actual() {  # $1 json del job en curso
  estado_set '.job = $j' --argjson j "$1"
}

job_cierra() {  # $1 json final del job
  estado_set '.job = $j | .historial = ([$j] + (.historial // []))[0:10]' --argjson j "$1"
}

# ── procesar una petición ──────────────────────────────────────────────────
procesar() {
  local jobfile="$1"
  local job id tipo alcance carpeta passphrase solicitante
  job="$(cat "$jobfile" 2>/dev/null)"
  if ! echo "$job" | jq -e . >/dev/null 2>&1; then
    log "petición ilegible, se descarta: $jobfile"; rm -f "$jobfile"; return
  fi
  id="$(echo "$job"        | jq -r '.id // empty')"
  tipo="$(echo "$job"      | jq -r '.tipo // empty')"
  alcance="$(echo "$job"   | jq -r '.alcance // "db"')"
  carpeta="$(echo "$job"   | jq -r '.carpeta // empty')"
  passphrase="$(echo "$job"| jq -r '.passphrase // empty')"
  solicitante="$(echo "$job" | jq -r '.solicitante // empty')"
  [ -n "$id" ] || id="job-$(date +%s)"

  local logf="$JOBS/$id.log"
  local inicio; inicio="$(date -Is)"
  : > "$logf"
  log "→ trabajo $id  tipo=$tipo  alcance=$alcance  carpeta=${carpeta:-–}  por=${solicitante:-–}"

  job_actual "$(jq -n --arg id "$id" --arg t "$tipo" --arg a "$alcance" \
      --arg c "$carpeta" --arg s "$solicitante" --arg i "$inicio" \
      '{id:$id,tipo:$t,estado:"EN_CURSO",alcance:$a,carpeta:$c,solicitante:$s,inicio:$i}')"

  local rc=0 resumen=""
  case "$tipo" in
    backup)
      /scripts/backup.sh >> "$logf" 2>&1 || rc=$?
      if [ "$rc" -eq 0 ]; then
        carpeta="$(ls -1dt "$DEST"/20*_*/ 2>/dev/null | head -1 | xargs -r basename)"
        resumen="$(grep -E '^\[.*\] OK ·' "$logf" | tail -1)"
        [ -n "$resumen" ] || resumen="copia creada"
      else
        resumen="$(grep -iE 'ERROR:' "$logf" | tail -1)"
        [ -n "$resumen" ] || resumen="la copia falló (rc=$rc)"
      fi
      ;;
    restore)
      if [ -z "$carpeta" ] || [ ! -d "$DEST/$carpeta" ]; then
        rc=1; resumen="la carpeta '$carpeta' no existe"
        echo "ERROR: $resumen" >> "$logf"
      else
        BACKUP_ENC_PASSPHRASE="$passphrase" /scripts/restore.sh "$DEST/$carpeta" "$alcance" >> "$logf" 2>&1 || rc=$?
        if [ "$rc" -eq 0 ]; then
          resumen="$(grep -E 'restauración .* completada' "$logf" | tail -1)"
          [ -n "$resumen" ] || resumen="restauración terminada"
        else
          resumen="$(grep -iE 'ERROR:' "$logf" | tail -1)"
          [ -n "$resumen" ] || resumen="la restauración falló (rc=$rc)"
        fi
      fi
      ;;
    *)
      rc=1; resumen="tipo de trabajo desconocido: $tipo"
      echo "ERROR: $resumen" >> "$logf"
      ;;
  esac

  local estado_job; [ "$rc" -eq 0 ] && estado_job="OK" || estado_job="ERROR"
  local fin; fin="$(date -Is)"
  log "← trabajo $id  $estado_job  ($resumen)"

  job_cierra "$(jq -n --arg id "$id" --arg t "$tipo" --arg e "$estado_job" --arg a "$alcance" \
      --arg c "$carpeta" --arg s "$solicitante" --arg i "$inicio" --arg f "$fin" --arg r "$resumen" \
      '{id:$id,tipo:$t,estado:$e,alcance:$a,carpeta:$c,solicitante:$s,inicio:$i,fin:$f,resumen:$r}')"

  rm -f "$jobfile"
  # conserva solo los 20 logs de trabajo más recientes
  ls -1dt "$JOBS"/*.log 2>/dev/null | tail -n +21 | xargs -r rm -f
}

# ── bucle principal ────────────────────────────────────────────────────────
estado_init
log "watcher listo · cola: $QUEUE · intervalo: ${INTERVALO}s"
while true; do
  heartbeat
  # el más antiguo primero; ignora archivos .tmp a medio escribir
  siguiente="$(ls -1tr "$QUEUE"/*.json 2>/dev/null | head -1)"
  if [ -n "${siguiente:-}" ] && [ -f "$siguiente" ]; then
    procesar "$siguiente"
  else
    sleep "$INTERVALO"
  fi
done
