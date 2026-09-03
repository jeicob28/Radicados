# SGDEA — Sistema de Radicación y Gestión Documental

Sistema de radicación y gestión de documentos electrónicos de archivo para una empresa en
Colombia, alineado con el **Acuerdo 001 de 2024 del Archivo General de la Nación**.

Arquitectura en contenedores: **frontend** (React) · **backend-api** (NestJS) · **worker** ·
**PostgreSQL** · **Redis** · **MinIO**, tras un **proxy** nginx.

**Estado: SGDEA completo (F0–F6)** — radicación con consecutivo controlado, distribución y seguimiento
con semáforo, gestión documental y TRD, expedientes electrónicos, reportes, integración de correo,
plan de contingencia, transferencias, disposición final con doble aprobación, MFA y auditoría
inalterable exportable. Todas las fases verificadas end-to-end en contenedores.

- Arquitectura y modelo de datos: [`docs/arquitectura.md`](docs/arquitectura.md)
  · canvas: <https://claude.ai/code/artifact/75e2121b-477b-4618-9de7-1c00365a6de8>
- Decisiones: [`docs/decisiones.md`](docs/decisiones.md)
- Fases entregadas (todas verificadas end-to-end en contenedores):
  - **F0** andamiaje — [`docs/fase-0.md`](docs/fase-0.md)
  - **F1** identidad, RBAC y auditoría — [`docs/fase-1.md`](docs/fase-1.md)
  - **F2** núcleo de radicación — [`docs/fase-2.md`](docs/fase-2.md)
  - **F3** distribución y seguimiento — [`docs/fase-3.md`](docs/fase-3.md)
  - **F4** gestión documental y TRD — [`docs/fase-4.md`](docs/fase-4.md)
  - **F5** reportes, correo y contingencia — [`docs/fase-5.md`](docs/fase-5.md)
  - **F6** ciclo de vida, MFA y auditoría exportable — [`docs/fase-6.md`](docs/fase-6.md)

## Requisitos

- Docker + Docker Compose v2
- (opcional, para desarrollo sin contenedores) Node.js 22

## Arranque

```bash
cp .env.example .env
npm run up                 # levanta los 7 servicios y construye imágenes
npm run seed               # catálogos, festivos 2026, roles, consecutivos y usuario admin
```

| Recurso | URL |
|---|---|
| Aplicación | http://localhost:8080 |
| API — health | http://localhost:8080/api/v1/health |
| API — info | http://localhost:8080/api/v1/info |
| API — Swagger | http://localhost:8080/api/v1/docs |

Usuario inicial: `admin@empresa.local` / `Admin2026*Cambiar` (debe cambiarse al ingresar).

Desarrollo con hot-reload y puertos expuestos:

```bash
npm run up:dev
```

Producción:

```bash
npm run up:prod            # compose.yml + compose.prod.yml, en segundo plano
```

## Estructura

```
apps/
  api/      backend NestJS + Prisma  (backend-api)
  worker/   trabajos en segundo plano (BullMQ + cron)
  web/      frontend React + Vite
infra/
  nginx/    proxy inverso
docs/       arquitectura, decisiones, fases
compose.yml · compose.dev.yml · compose.prod.yml
```

## Scripts

| Comando | Acción |
|---|---|
| `npm run up` / `up:dev` / `up:prod` | Levantar el stack |
| `npm run down` / `down:volumes` | Detener (y borrar datos) |
| `npm run logs` | Ver logs |
| `npm run seed` | Ejecutar el seed dentro del contenedor `api` |
| `npm run psql` | Abrir `psql` en la base de datos |

## API (resumen, todo bajo `/api/v1`, ver Swagger)

| Área | Endpoints |
|---|---|
| Autenticación | `auth/login` `auth/refresh` `auth/logout` `auth/me` `auth/cambiar-password` `auth/mfa/*` |
| Administración | `usuarios` `roles` `dependencias` `terceros` `parametros` |
| Radicación | `radicados` (`POST`=radicar) · `radicados/adjuntos` · `radicados/:n/{anulacion,trazabilidad}` · `consecutivos` |
| Seguimiento | `radicados/:n/{asignar,aceptar,trasladar,reasignar,devolver,cerrar,reabrir}` · `bandeja` · `seguimiento/{vencimientos,indicadores}` · `notificaciones` |
| Gestión documental | `trd` `series` `subseries` `tipos-documentales` · `expedientes` (`:n/{documentos,foliar,cerrar,indice,verificar-integridad}`) · `radicados/:n/clasificar` |
| Reportes | `reportes/{recibidos,enviados,pendientes,vencidos,por-dependencia,por-funcionario,tiempo-respuesta,derechos-peticion,documentos-por-serie,anulados}?formato=xlsx` |
| Correo | `correo/{capturar,pendientes,:id,:id/radicar,:id/descartar}` |
| Contingencia | `contingencia/{incorporar,conciliacion}` |
| Ciclo de vida | `transferencias` (`:n/{enviar,recibir,inventario}`) · `disposicion-final` (`:n/{aprobar,rechazar,ejecutar}`) |
| Auditoría | `bitacora` `bitacora/verificacion` `bitacora/exportar` |
