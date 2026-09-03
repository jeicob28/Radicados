# Registro de decisiones (ADR resumido)

## ADR-001 · Stack y arquitectura
**Fecha:** 2026-09-03 · **Estado:** aceptada

- Arquitectura en **contenedores** orquestados con Docker Compose: `proxy`, `frontend`, `backend-api`, `worker`, `postgres`, `redis`, `minio`.
- **Backend:** NestJS (Node + TypeScript) con Prisma sobre **PostgreSQL 16**.
- **Frontend:** React + Vite + TypeScript.
- **Archivos:** **MinIO** (almacenamiento de objetos compatible con S3) en contenedor.
- **Alcance:** SGDEA completo, entregado **por fases** (F0 → F7).
- Documento de arquitectura: `docs/arquitectura.md` y el canvas publicado.

## ADR-002 · Modo de consecutivo
**Fecha:** 2026-09-03 · **Estado:** aceptada

- Modo **DIFERENCIADO** por defecto: consecutivos separados de **entrada** (`2026-ENT-000001`)
  y **salida** (`2026-SAL-000001`).
- Se mantiene disponible el modo **ÚNICO institucional** (`2026-000001`) como configuración
  (`parametro: consecutivo.modo`).
- **Vigencia inicial: 2026**, con arranque real de radicación en **septiembre de 2026**.
  El consecutivo empieza en `000001` con el primer radicado, sin importar el mes.
- Rango de contingencia reservado por tipo (`900001–900500` para ENT/SAL, `990001–990500` para ÚNICO);
  el generador normal nunca lo invade (ver `fn_asignar_consecutivo`).

## ADR-003 · Autenticación
**Fecha:** 2026-09-03 · **Estado:** aceptada

- **Autenticación propia** (JWT de acceso corto + refresh en cookie httpOnly) desde la Fase 1.
- Preparada para integrar más adelante un proveedor **OIDC** (Keycloak / Azure AD) sin reescribir
  la capa de autorización (RBAC por dependencia).

## ADR-004 · Parámetros de negocio
**Fecha:** 2026-09-03 · **Estado:** aceptada (valores por defecto — verificar con Jurídica/Archivo)

- Días hábiles: lunes a viernes.
- Calendario de **festivos de Colombia 2026** cargado en la tabla `festivo` (seed).
- Términos por tipo de comunicación (días hábiles), parametrizables en `parametro: plazos.dias_habiles`:
  derecho de petición general 15 · petición de información 10 · petición de documentos 10 ·
  consultas 30 · quejas/reclamos/solicitudes 15.
- Semáforo de cumplimiento: amarillo a 5 días hábiles, rojo a 2 (`parametro: alertas.dias_habiles`).

> Estos valores son un punto de partida configurable. Antes de producción deben validarse
> contra la normativa vigente y el reglamento interno (ver matriz normativa, pendiente).
