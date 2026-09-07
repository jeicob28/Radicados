# Servicio de copias de seguridad del SGDEA.
# Base = postgres:16-alpine → trae pg_dump / pg_restore / psql en la MISMA
# versión que la base de datos (evita el error "server version mismatch") y
# ya está descargada en el servidor (no suma imagen nueva grande).
FROM postgres:16-alpine

# bash para los scripts, tzdata para que el cron respete America/Bogota,
# jq para leer la cola de trabajos que deja la API, mc (cliente de MinIO)
# para copiar los objetos. crond lo trae busybox.
RUN apk add --no-cache bash tzdata curl openssl coreutils jq \
 && curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc \
 && chmod +x /usr/local/bin/mc

COPY backup.sh restore.sh watcher.sh entrypoint.sh /scripts/
RUN chmod +x /scripts/*.sh

ENV BACKUP_DEST=/backups \
    BACKUP_CRON="0 2 * * *" \
    BACKUP_RETENTION_DAYS=14 \
    BACKUP_MIN_FREE_MB=1500 \
    BACKUP_ON_START=0 \
    TZ=America/Bogota

VOLUME ["/backups"]
ENTRYPOINT ["/scripts/entrypoint.sh"]
