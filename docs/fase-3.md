# Fase 3 — Distribución y seguimiento

## Entrega

Transiciones de estado (todas con actor, fecha/hora e IP, irreversibles en el historial):

| Endpoint | Rol | Efecto |
|---|---|---|
| `POST /radicados/:n/asignar` | JEFE·VENTANILLA·RADICADOR | → `ASIGNADO`, fija dependencia y funcionario, notifica |
| `POST /radicados/:n/aceptar` | FUNCIONARIO·JEFE | → `EN_TRAMITE` (el funcionario asignado) |
| `POST /radicados/:n/trasladar` | FUNCIONARIO·JEFE | cambia dependencia, exige motivo, notifica |
| `POST /radicados/:n/reasignar` | JEFE | cambia funcionario, exige motivo |
| `POST /radicados/:n/devolver` | FUNCIONARIO·JEFE | → `RADICADO` |
| `POST /radicados/:n/cerrar` | FUNCIONARIO·JEFE | → `CERRADO` (requiere `RESPONDIDO`, salvo tipos sin respuesta obligatoria) |
| `POST /radicados/:n/reabrir` | JEFE | `CERRADO` → `EN_TRAMITE` |

- `GET /bandeja` — radicados asignados al usuario, con semáforo.
- `GET /seguimiento/vencimientos?dependenciaId=&nivel=` — abiertos con fecha de vencimiento.
- `GET /seguimiento/indicadores` — abiertos, vencidos, por vencer, tiempo promedio de respuesta, semáforo.
- `POST /seguimiento/recalcular-alertas` — recálculo manual del semáforo.

## Semáforo de cumplimiento

`AlertasService.recalcular()` (invocado cada 30 min por el **worker** vía `POST /internal/recalcular-alertas`
con `X-Internal-Token`) recalcula `nivelAlerta` y `diasHabilesRestantes` de todo radicado abierto con
vencimiento, usando el calendario de festivos:

`VERDE` → `AMARILLO` (≤5 días háb.) → `ROJO` (≤2) → `VENCIDO` (<0)

Al entrar en `ROJO`/`VENCIDO` genera una **notificación** para el funcionario responsable
(`GET /notificaciones`, `POST /notificaciones/:id/leida`, `leer-todas`).

## Verificado

```
✓ radicar → asignar → aceptar → responder → cerrar (máquina de estados)
✓ notificación de ASIGNACION al funcionario
✓ vencimiento a +1 día → ROJO (diasHabilesRestantes 1) + notificación
✓ vencimiento a -2 días → VENCIDO (diasHabilesRestantes -2)
✓ filtro vencimientos?nivel=ROJO
✓ cadena de bitácora intacta
```

## Adenda (2026-09-05) — Trámite del funcionario: notas, evidencias y respuesta en dos variantes

Petición de negocio validada y documentada en Requerimientos §21.2.
Migración `20260910000000_respuesta_tramite` (`ALTER TYPE "EstadoRadicado" ADD VALUE 'POR_COMUNICAR'`).

- `POST /radicados/adjuntos-tramite` (FUNCIONARIO/JEFE/VENTANILLA) — sube
  evidencias/soportes y devuelve descriptores (reutiliza `AdjuntosService`).
- `POST /radicados/:numero/responder` (FUNCIONARIO/JEFE) — `ResponderDto`:
  `variante` DIRECTA|COMUNICADO_OFICIAL, `medioRespuesta` (enum), `notas`,
  `adjuntos` (≥1). Precondición: `EN_TRAMITE` y funcionario asignado (o
  JEFE/ADMIN). DIRECTA → `CERRADO` + `notificarRol('VENTANILLA', …)`
  informativa; COMUNICADO_OFICIAL → `POR_COMUNICAR` + tarea a Ventanilla.
  No genera consecutivo de salida — la respuesta se archiva sobre el
  radicado de entrada (decisión del área: SAL solo para lo que la empresa
  origina).
- `POST /radicados/:numero/comunicado-oficial` (VENTANILLA) — solo desde
  `POR_COMUNICAR`; adjunta el comunicado, cierra, notifica al funcionario.
- `devolver` y `trasladar` (`MotivoDto`/`TrasladarDto`) aceptan `adjuntos`
  opcionales; helper `adjuntarSoporte(tx, radicadoId, adjuntos, descripcion)`
  crea los `Anexo`. Nuevo helper `notificarRol(rol, …)`.
- `bitacora.service`: nueva acción `RESPONDER`.
- Frontend `RadicadoDetalle.tsx`: `ResponderModal` y `ComunicadoModal`
  dedicados (fuera del `AccionModal` genérico), helper `subirEvidencias()`
  y componente `CampoEvidencias`; acciones nuevas `responder`, `devolver`,
  `comunicado`; fila "Forma de respuesta"; `POR_COMUNICAR` en `EstadoPill`
  y en el filtro de `Consulta`.

Verificado contra la API real con usuarios de prueba en la dependencia
Administración: responder DIRECTA (→ CERRADO, 1 evidencia, notificación
`RADICADO_CERRADO` a Ventanilla), responder COMUNICADO_OFICIAL (→
POR_COMUNICAR, notificación `COMUNICADO_PENDIENTE`), funcionario intenta
`comunicado-oficial` → 403, Ventanilla lo emite (→ CERRADO, comunicado
adjunto, notificación al funcionario), devolver con evidencia (→ RADICADO,
"Soporte de la devolución"). Jest 8/8, builds limpios.

### Complemento (2026-09-05) — quién puede responder/cerrar

Se retira `@Roles(FUNCIONARIO, JEFE)` de `aceptar` / `trasladar` /
`devolver` / `cerrar` / `responder`. En su lugar, `SeguimientoService`
usa `cargarParaTramite(numero, ctx)` → `puedeTramitar(usuario, radicado)`
(`common/visibilidad-radicados.ts`): `ADMIN` siempre; `AUDITOR` nunca;
el resto si `radicado.funcionarioId === usuario.id` o
`usuario.dependenciaId === radicado.dependenciaId`. `responder` acepta
`EN_TRAMITE` o `RESPONDIDO`. `POST /radicados/adjuntos-tramite` pierde el
gate de rol (cualquier autenticado; la restricción real está en la
acción). Frontend: se elimina la acción `cerrar`; `responder` se
renombra a **"Responder / cerrar"** y su visibilidad se calcula con la
misma lógica (`esAuditorPuro`, dependencia o asignación). Interface
`funcionario` del detalle pasa a incluir `id`. Verificado: un ARCHIVISTA
de la dependencia acepta y responde (→ CERRADO); un AUDITOR de la misma
dependencia recibe 403 al responder pero 200 al consultar el detalle.

### Complemento (2026-09-05) — evidencias en todas las acciones

`adjuntarComoAnexos()` movido a `apps/api/src/common/anexos.util.ts`.
Base `AccionConEvidenciasDto` (campo `adjuntos?` opcional) de la que
extienden `AsignarDto`, `TrasladarDto`, `ReasignarDto`, `MotivoDto`
(devolver/reabrir) y `ObservacionDto` (cerrar/aceptar); `aceptar` pasa a
recibir `@Body() ObservacionDto`. `AnularRadicadoDto` y
`ClasificarRadicadoDto` también aceptan `adjuntos?` (insertados fuera del
`fn_anular_radicado` en el primer caso, dentro de la tx de clasificación
en el segundo). Frontend: `AccionModal` muestra siempre `CampoEvidencias`
y adjunta si hay archivos. Verificado: asignar + aceptar + cerrar con
evidencia → 3 anexos con su descripción respectiva.
