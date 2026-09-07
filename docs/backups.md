# Copias de seguridad

El SGDEA trae un **servicio de copias de seguridad** que funciona solo: se
levanta con el resto del stack de producción y hace una copia completa cada
día. No hay que configurar `cron` en el servidor.

## Qué se copia

| Componente | Qué es | Cómo se guarda |
|---|---|---|
| **Base de datos** | Radicados, expedientes, bitácora, usuarios, parámetros… | `db.dump` — volcado de PostgreSQL en formato *custom* (`pg_dump -Fc`), restaurable con `pg_restore` |
| **Documentos** | Los archivos/anexos que están en MinIO | `objetos.tar.gz` — espejo del bucket, comprimido |
| **Configuración** | `.env` y los `compose*.yml` | `config.tar.gz` — **contiene secretos**, protéjala |

Cada copia va a su propia carpeta con fecha y hora:

```
backups/
  2026-09-07_020000/
    db.dump
    objetos.tar.gz
    config.tar.gz
    manifest.json      ← qué contiene, conteos y estado de la cadena de la bitácora
    SHA256SUMS         ← checksums de los archivos
    RESTAURAR.txt      ← recordatorio de cómo restaurar
  backup.log           ← registro de todas las ejecuciones
```

El **manifiesto** deja constancia, para cada copia, de cuántos radicados,
anexos y registros de bitácora había, y si la **cadena de integridad de la
bitácora verificaba** en ese momento.

## Cómo funciona

- Servicio `backup` en `compose.prod.yml`. Imagen basada en
  `postgres:16-alpine` (misma versión que la BD) + el cliente `mc` de MinIO.
- Habla con `postgres` y `minio` por la red interna de Docker. **No usa el
  socket de Docker** (no tiene privilegios sobre el host).
- Un `cron` interno dispara `infra/backup/backup.sh` a la hora programada.
- Los archivos quedan en `./backups/` de la carpeta del proyecto en el
  servidor (bind-mount), para poder copiarlos o inspeccionarlos fácilmente.

Registros:

```bash
docker compose logs -f backup            # actividad del servicio
tail -f backups/backup.log               # registro de cada copia
```

## Desde la aplicación (Administración › Copias de seguridad)

El ADMIN tiene en el panel un módulo **Copias de seguridad** para operar sin
entrar por consola al servidor:

| Acción | Qué hace |
|---|---|
| **Hacer copia ahora** | Lanza una copia completa igual que la del cron. Aparece en la lista al terminar. |
| **Descargar** | Baja la copia como un único `.tar` (`sgdea-<fecha>.tar`) para guardarla fuera del servidor. |
| **Importar copia (.tar)** | Sube un `.tar` descargado antes y lo deja disponible para restaurar. |
| **Restaurar** | Sobrescribe los datos actuales con los de la copia elegida (base y/o documentos). Pide escribir `RESTAURAR`; si la copia está cifrada, pide la frase. |
| **Activar / salir de mantenimiento** | Bloquea temporalmente a los usuarios que no son ADMIN (503). Se activa solo durante una restauración y se libera al terminar. |
| **Eliminar** | Borra una copia del servidor. |

Cómo encaja con el servicio:

- La API **no** ejecuta `pg_dump` / `pg_restore` ni usa el socket de Docker.
  Deja la petición en `./backups/.control/queue/` y el servicio `backup`
  (watcher) la procesa y publica el resultado en `./backups/.control/estado.json`.
- Por eso el botón *Hacer copia ahora* solo funciona con el overlay de
  producción levantado (es el que trae el servicio `backup`). El panel avisa si
  el servicio está inactivo.
- La **restauración desde el panel** no puede parar contenedores: cierra las
  conexiones a la base, vacía el esquema `public` y hace `pg_restore` con la
  aplicación arriba (que responde 503 por el modo mantenimiento mientras dura).
  Para una recuperación ante desastre completa se sigue usando
  `infra/backup/restaurar.sh` desde el servidor.
- Todas estas acciones quedan en la **bitácora** (`copia` / `sistema`).

## Configuración (`.env`, todo opcional)

| Variable | Por defecto | Para qué |
|---|---|---|
| `BACKUP_CRON` | `0 2 * * *` | Cuándo se hace la copia (formato cron, hora local `TZ`) |
| `BACKUP_RETENTION_DAYS` | `14` | Cuántos días de copias se conservan; las más viejas se borran solas |
| `BACKUP_MIN_FREE_MB` | `1500` | Si hay menos disco libre que esto, **no** hace la copia (evita llenar el disco) |
| `BACKUP_ON_START` | `0` | `1` = hace una copia apenas arranca el servicio (útil para probar) |
| `BACKUP_ENC_PASSPHRASE` | — | Si se define, cifra los archivos con AES-256. **Guarde la frase aparte**: sin ella la copia es inservible |
| `BACKUP_OFFSITE_CMD` | — | Comando para llevar la copia fuera del servidor; `{}` se reemplaza por la carpeta de la copia |
| `BACKUP_NOTIFY_URL` | — | URL a la que se hace `POST` con el resultado de cada copia (webhook) |

Después de cambiar el `.env`:

```bash
docker compose -f compose.yml -f compose.prod.yml up -d backup
```

### Hacer una copia ahora (manual)

```bash
docker compose -f compose.yml -f compose.prod.yml run --rm --entrypoint /scripts/backup.sh backup
```

## Copia fuera del servidor (recomendado)

Una copia que vive solo en el mismo servidor se pierde si el servidor se
daña o lo roban. Para un sistema de archivo (Acuerdo 001 de 2024) conviene
tener una copia en otro sitio. Dos formas:

**a) Desde el host, con su propio `cron`** (lo más simple):

```bash
# /etc/cron.d o crontab del servidor — copia la carpeta backups/ a un NAS
30 3 * * *  rsync -a --delete /home/administrador/radicados-sgdea/backups/  usuario@nas:/respaldos/sgdea/
```

**b) Desde el propio servicio, con `BACKUP_OFFSITE_CMD`** (si el destino
necesita una herramienta como `rclone`, hay que añadirla a la imagen
`infra/backup/Dockerfile`):

```
BACKUP_OFFSITE_CMD=rclone copy {} gdrive:sgdea/$(date +%F)
```

## Restaurar

Desde el servidor, en la carpeta del proyecto:

```bash
./infra/backup/restaurar.sh                              # lista las copias
./infra/backup/restaurar.sh 2026-09-07_020000            # menú: qué restaurar
./infra/backup/restaurar.sh 2026-09-07_020000 db         # solo la base de datos
./infra/backup/restaurar.sh 2026-09-07_020000 objetos    # solo los documentos
./infra/backup/restaurar.sh 2026-09-07_020000 todo       # base + documentos
```

- Verifica los checksums antes de tocar nada.
- Para restaurar la base: detiene `api` y `worker`, recrea la base, hace
  `pg_restore`, los vuelve a levantar y verifica la cadena de la bitácora.
- Pide escribir `RESTAURAR` para confirmar (la restauración **sobreescribe**
  los datos actuales).
- Si la copia está cifrada, pide la frase (o toma `BACKUP_ENC_PASSPHRASE`).
- La configuración **no** se sobreescribe: se extrae a
  `backups/<copia>/config-restaurado/` para que la revise a mano.

## Verificar que las copias sirven

Una copia que nunca se probó no es una copia. `verificar.sh` restaura el
dump en una base **temporal y descartable** (no toca producción), corre
`pg_restore` y revisa la cadena de la bitácora:

```bash
./infra/backup/verificar.sh 2026-09-07_020000
```

Sugerencia: correrlo una vez por semana sobre la copia más reciente.

## Recuperación ante desastre (servidor perdido)

1. Servidor nuevo con Docker + Docker Compose v2.
2. Traer el código: `git clone` o el `git archive` de siempre.
3. Recuperar la última carpeta `backups/<fecha>/` desde la copia externa.
4. Extraer la configuración:
   `./infra/backup/restaurar.sh <fecha> config` → revisar y poner el `.env`.
5. `docker compose -f compose.yml -f compose.prod.yml up -d`
6. `./infra/backup/restaurar.sh <fecha> todo` (base + documentos).
7. `./infra/backup/verificar.sh <fecha>` y revisar `SELECT * FROM fn_verificar_bitacora()` en la app (menú Auditoría).

## Nota sobre RPO

Las copias son diarias: en el peor caso se pierde hasta un día de trabajo.
Si se necesita un objetivo de recuperación más ajustado (minutos), habría
que añadir *WAL archiving* de PostgreSQL — no está montado hoy.
