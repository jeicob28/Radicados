# Arquitectura — SGDEA de Radicación y Gestión Documental

> Documento vivo. La versión visual (diagramas, modelo de datos, plan por fases) está
> publicada como canvas: **https://claude.ai/code/artifact/75e2121b-477b-4618-9de7-1c00365a6de8**
> Marco normativo: **Acuerdo 001 de 2024 del Archivo General de la Nación**.

## 1. Contenedores

| Servicio | Rol |
|---|---|
| `proxy` (nginx) | TLS, cabeceras de seguridad, límite de peticiones, enrutado `/api` ↔ `/`. |
| `frontend` (React+Vite → nginx) | SPA de operación: ventanilla, radicados, expedientes, reportes, administración. |
| `backend-api` (NestJS) | API REST + OpenAPI, autenticación, RBAC, **transacción del consecutivo**, reglas archivísticas. |
| `worker` (NestJS + BullMQ) | Vencimientos y alertas, captura IMAP del buzón, generación de PDF/índices, verificación de checksums. |
| `postgres` 16 | Fuente de verdad. Tablas *append-only* para radicado, trazabilidad y bitácora. |
| `redis` 7 | Colas BullMQ, bloqueos, caché. |
| `minio` | Objetos S3: documentos, anexos, correos; `object-lock` (WORM) para el archivo definitivo. |

## 2. Integridad del consecutivo (capítulos 3 y 4 de los requerimientos)

Se implementa en la **base de datos**, no solo en la aplicación:

- `radicado`, `evento_tramite`, `anulacion` y `bitacora` son **append-only**: triggers `BEFORE DELETE`
  (todas) y `BEFORE UPDATE` (evento y bitácora) que lanzan excepción.
- `radicado`: trigger que impide alterar `numero`, `vigencia`, `tipo`, `secuencial`,
  `fecha_hora_radicacion` y la cadena de hash.
- `fn_asignar_consecutivo(vigencia, tipo)`: toma el siguiente número con `SELECT … FOR UPDATE`
  dentro de la transacción de radicación; nunca reutiliza ni invade el rango de contingencia.
- `fn_anular_radicado(...)`: exige motivo y justificación, conserva el registro y consume el número
  para siempre.
- `bitacora`: trigger `BEFORE INSERT` que calcula `hash = sha256(hash_anterior || contenido)` —
  cadena verificable de extremo a extremo.

## 3. Modelo de datos (núcleo F0)

`parametro · festivo · dependencia · usuario · tercero · consecutivo · radicado · evento_tramite ·
anulacion · anexo · bitacora`

Series/subseries, TRD, expedientes y transferencias se incorporan en fases posteriores
(ver plan). Esquema completo: `apps/api/prisma/schema.prisma`.

## 4. Plan por fases — **todas entregadas y verificadas end-to-end**

| Fase | Contenido | Detalle |
|---|---|---|
| **F0** ✅ | Andamiaje: compose con los 7 servicios, esqueletos, esquema + triggers, seed, `/health` `/info`. | [`fase-0.md`](fase-0.md) |
| **F1** ✅ | Auth JWT + refresh, RBAC, CRUD usuarios/roles/dependencias/terceros/parámetros, bitácora persistente + verificación. | [`fase-1.md`](fase-1.md) |
| **F2** ✅ | Ventanilla, transacción `SERIALIZABLE` del consecutivo, entrada/salida, anexos a MinIO con checksum, anulación, consulta. | [`fase-2.md`](fase-2.md) |
| **F3** ✅ | Máquina de estados, asignación/traslado/reasignación, vencimientos por tipo, worker + semáforo + notificaciones. | [`fase-3.md`](fase-3.md) |
| **F4** ✅ | Cuadro de clasificación, TRD, expediente electrónico con foliado, índice, verificación de integridad, retención. | [`fase-4.md`](fase-4.md) |
| **F5** ✅ | 10 reportes con export XLSX, captura de correo (IMAP en worker), contingencia con conciliación. | [`fase-5.md`](fase-5.md) |
| **F6** ✅ | Transferencias con inventario, disposición final con doble aprobación, MFA (TOTP), auditoría exportable firmada. | [`fase-6.md`](fase-6.md) |

**Frontend (React + Vite):** panel de indicadores, radicar, consulta, detalle con trazabilidad y acciones
por rol, mi bandeja, expedientes (índice, foliado, cierre), reportes, auditoría. Sesión con refresh
transparente; navegación filtrada por rol.

## 5. Decisiones

Ver `docs/decisiones.md` (ADR-001 a ADR-004).
