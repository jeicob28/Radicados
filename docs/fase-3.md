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
