# Fase 2 — Núcleo de radicación

## Entrega

- `POST /api/v1/radicados/adjuntos` (multipart) — sube archivos, calcula **SHA-256**, valida tipo y tamaño (≤50 MB).
- `POST /api/v1/radicados` — **radica** en una transacción `SERIALIZABLE`:
  - `fn_asignar_consecutivo(vigencia, tipo)` toma el número con `SELECT … FOR UPDATE`.
  - Reintentos con backoff ante conflicto de serialización; el número **no se consume** si aborta.
  - Calcula `fechaVencimiento` (entrada) según el plazo legal del tipo de comunicación.
  - `hashRegistro` encadenado con el radicado anterior de la vigencia.
  - Radicado de **salida** con `enRespuestaA` → marca la entrada como `RESPONDIDO`.
- `GET /api/v1/radicados` — consulta por número, asunto, remitente, estado, tipo, fechas, vencidos; paginada.
- `GET /api/v1/radicados/:numero` — detalle con eventos, anexos, tercero, anulación.
- `GET /api/v1/radicados/:numero/trazabilidad` — historial completo.
- `POST /api/v1/radicados/:numero/anulacion` (RADICADOR) — `fn_anular_radicado`, exige justificación.
- `GET /api/v1/radicados/:numero/adjuntos/:id/descarga` — stream auditado (acción `DESCARGAR`).
- `GET /api/v1/consecutivos` · `PATCH /api/v1/consecutivos/:id` (RADICADOR) — formato y rango de contingencia.

## Verificado (stack en contenedores)

```
✓ 3 radicaciones → 000001, 000002, 000003 (consecutivas)
✓ derecho de petición → fechaVencimiento a 15 días hábiles (calendario 2026)
✓ salida con enRespuestaA → entrada pasa a RESPONDIDO + evento RESPUESTA_GENERADA
✓ anulación de 000002 → ANULADO; siguiente radicado es 000004 (sin reutilizar)
✓ adjunto multipart con checksum SHA-256; descarga auditada
✓ cadena de bitácora intacta
```
