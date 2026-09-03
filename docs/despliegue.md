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
# Ajustar: HTTP_PORT (puerto libre en el host), DATABASE_URL (misma contraseña que POSTGRES_PASSWORD),
# SEED_ADMIN_PASSWORD, TZ.
```

> `DATABASE_URL` debe llevar la misma contraseña que `POSTGRES_PASSWORD`.

## 4. Levantar

```bash
docker compose -f compose.yml -f compose.prod.yml up -d --build
# esperar a que 'api' esté healthy:
docker compose ps
# sembrar catálogos (una sola vez):
docker compose exec api npm run seed
```

App: `http://SERVIDOR:HTTP_PORT` · API: `.../api/v1/docs`

## 5. TLS (pendiente)

Hoy el proxy expone HTTP. Para producción real, terminar TLS delante (balanceador
corporativo) o cambiar `infra/nginx` por Caddy con Let's Encrypt. Los datos personales
de terceros (Ley 1581) exigen HTTPS antes del arranque real.

## 6. Backups

```bash
crontab -e
# 0 2 * * * cd /home/administrador/radicados-sgdea && ./infra/backup/backup.sh >> backups/backup.log 2>&1
```

## Operación

| | |
|---|---|
| Ver estado | `docker compose ps` |
| Logs | `docker compose logs -f api worker` |
| Actualizar | subir código (paso 2) → `docker compose -f compose.yml -f compose.prod.yml up -d --build` |
| Migraciones | se aplican solas al arrancar `api` (`prisma migrate deploy`) |
| Parar | `docker compose down` (conserva datos) |
| Reset total | `docker compose down -v` (⚠ borra la base y los objetos) |
