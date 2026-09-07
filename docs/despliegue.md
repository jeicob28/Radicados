# Despliegue

Stack en contenedores, construido en el propio servidor. Sin dependencias en el host
salvo Docker + Docker Compose v2.

## 1. Preparar el servidor

```bash
docker --version && docker compose version   # v2 requerido
mkdir -p /home/administrador/radicados-sgdea
```

## 2. Subir el código

Desde la máquina de desarrollo (solo archivos versionados, sin node_modules ni .git):

```bash
git archive --format=tar HEAD | ssh administrador@SERVIDOR \
  "mkdir -p /home/administrador/radicados-sgdea && tar -x -C /home/administrador/radicados-sgdea"
```

## 3. Configurar `.env`

```bash
cd /home/administrador/radicados-sgdea
cp .env.example .env
# Generar secretos fuertes:
sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -hex 32)|"   .env
sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(openssl rand -hex 32)|" .env
sed -i "s|^AUDIT_EXPORT_SECRET=.*|AUDIT_EXPORT_SECRET=$(openssl rand -hex 32)|" .env
sed -i "s|^INTERNAL_TOKEN=.*|INTERNAL_TOKEN=$(openssl rand -hex 24)|"         .env
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 16)|"   .env
sed -i "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=$(openssl rand -hex 16)|" .env
sed -i "s|^TLS_HOST=.*|TLS_HOST=SERVIDOR|" .env   # IP o nombre por el que entra el personal
# Ajustar: HTTP_PORT/HTTPS_PORT (puertos libres en el host), DATABASE_URL (misma
# contraseña que POSTGRES_PASSWORD), SEED_ADMIN_PASSWORD, TZ.
```

> `DATABASE_URL` debe llevar la misma contraseña que `POSTGRES_PASSWORD`.
> `TLS_HOST` debe ser la IP o el nombre exacto por el que el personal escribirá la
> dirección (p. ej. `192.168.1.50` o `sgdea.empresa.local`) — entra en el
> certificado autofirmado; si no coincide, el navegador marcará error de nombre
> además de "no confiable".

## 4. Levantar

```bash
docker compose -f compose.yml -f compose.prod.yml up -d --build
# esperar a que 'api' esté healthy:
docker compose ps
# sembrar catálogos (una sola vez):
docker compose exec api npm run seed
```

App: **`https://SERVIDOR`** (puerto 443 por defecto) · API: `.../api/v1/docs` ·
`http://SERVIDOR:HTTP_PORT` redirige automáticamente a HTTPS.

## 5. TLS (autofirmado, activo por defecto)

Es una intranet sin dominio público, así que no aplica una CA como Let's Encrypt: el
proxy genera solo, al primer arranque, un **certificado autofirmado** para `TLS_HOST`
(script `infra/nginx/docker-entrypoint.d/10-gen-cert.sh`) y lo guarda en el volumen
`proxycerts` para no regenerarlo — y no forzar a nadie a volver a confiar en él — en
cada actualización.

- **Primera vez en cada equipo**: el navegador muestra "la conexión no es privada" /
  "certificado no confiable". Es esperado (autofirmado, uso interno) — clic en
  "Avanzado" → "Continuar de todos modos". Se recuerda para las siguientes visitas.
- Esto es lo que habilita la **cámara en vivo** (captura de fotos, §20 de los
  requerimientos) desde cualquier PC de la red, no solo desde el propio servidor —
  el navegador exige un contexto seguro (HTTPS) para dar acceso a la cámara.
- Si cambia la IP/nombre del servidor, actualiza `TLS_HOST` en `.env` y borra el
  volumen del certificado para que se regenere: `docker compose down` (sin `-v`
  general) y `docker volume rm radicados_proxycerts`, luego vuelve a levantar.

## 6. Copias de seguridad

Ya quedan **activas solas** con el overlay de producción: el servicio
`backup` hace una copia completa (base de datos + documentos +
configuración) cada día a las 02:00 en `./backups/`, con manifiesto,
checksums y retención de 14 días. No hay que tocar `cron` en el servidor.

```bash
docker compose logs -f backup                    # actividad del servicio
tail -f backups/backup.log                        # registro de cada copia
# copia manual ahora:
docker compose -f compose.yml -f compose.prod.yml run --rm --entrypoint /scripts/backup.sh backup
# restaurar / verificar:
./infra/backup/restaurar.sh
./infra/backup/verificar.sh <carpeta>
```

Detalle completo (cifrado, copia fuera del servidor, recuperación ante
desastre): **[`docs/backups.md`](backups.md)**.

## Operación

| | |
|---|---|
| Ver estado | `docker compose ps` |
| Logs | `docker compose logs -f api worker` |
| Actualizar | subir código (paso 2) → `docker compose -f compose.yml -f compose.prod.yml up -d --build` |
| Migraciones | se aplican solas al arrancar `api` (`prisma migrate deploy`) |
| Parar | `docker compose down` (conserva datos) |
| Reset total | `docker compose down -v` (⚠ borra la base y los objetos) |

El `proxy` (nginx) resuelve `api`/`web` en caliente cada 10 s (`resolver 127.0.0.11`), así
que recrear esos contenedores en una actualización no requiere reiniciarlo aparte.
