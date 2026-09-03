# Fase 0 — Andamiaje e infraestructura

## Qué entrega

- **`compose.yml`** con los 7 servicios y un solo punto de entrada (`http://localhost:8080`).
- **`backend-api`** (NestJS) con:
  - `GET /api/v1/health` — estado de postgres, redis y minio.
  - `GET /api/v1/info` — metadatos del sistema y estado de los consecutivos.
  - `GET /api/v1/docs` — Swagger UI.
  - Módulos base: configuración, Prisma, almacenamiento (MinIO), interceptor de bitácora (cableado, sin persistir aún).
- **`worker`** (NestJS + BullMQ) conectado a Redis y con el cron de vencimientos como stub.
- **`frontend`** (React + Vite) con un tablero que consulta `/health` e `/info`.
- **PostgreSQL**: esquema núcleo + **triggers de integridad** + funciones
  `fn_asignar_consecutivo` y `fn_anular_radicado` (migración `20260901000000_init`).
- **Seed**: parámetros de negocio, festivos de Colombia 2026, organigrama mínimo,
  usuario administrador y consecutivos de la vigencia 2026 (modo diferenciado).
- **CI** (GitHub Actions): build + test de cada app y `docker compose build`.

## Cómo ejecutar

```bash
cp .env.example .env
npm run up            # docker compose up --build

# cuando todos los servicios estén "healthy":
npm run seed          # carga catálogos y consecutivos 2026
```

Luego:

- App / tablero: <http://localhost:8080>
- API health: <http://localhost:8080/api/v1/health>
- API info: <http://localhost:8080/api/v1/info>
- Swagger: <http://localhost:8080/api/v1/docs>

### Desarrollo con hot-reload

```bash
npm run up:dev        # expone 3000/5173/5432/6379/9000/9001 y monta ./src
```

- Frontend (Vite): <http://localhost:5173>
- API directa: <http://localhost:3000/api/v1/health>
- Consola MinIO: <http://localhost:9001> (`minioadmin` / `minioadmin_dev`)

## Verificación rápida (criterios de aceptación aplicables en F0)

```bash
# La cadena de integridad del consecutivo existe a nivel de BD:
npm run psql
```
```sql
-- asignar dos números consecutivos de entrada 2026
SELECT * FROM fn_asignar_consecutivo(2026, 'ENT');   -- 2026-ENT-000001
SELECT * FROM fn_asignar_consecutivo(2026, 'ENT');   -- 2026-ENT-000002

-- intentar borrar evidencia -> debe fallar
DELETE FROM bitacora WHERE id = 1;                    -- ERROR: append-only
```

## Qué NO hace todavía

Radicar de verdad, autenticación, distribución, expedientes, TRD, reportes, correo.
Eso llega en F1–F6 (ver `docs/arquitectura.md`).

## Nota

Los `package-lock.json` de cada app se generan al primer `npm install` y sí se versionan.
Los Dockerfiles usan `npm install` (tolerante a que falte el lock); se puede endurecer a
`npm ci` más adelante, junto con ESLint/Prettier compartidos y tests de integración con
Testcontainers.
