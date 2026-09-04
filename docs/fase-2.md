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

## Adenda (2026-09-04) — Captura por cámara y firma en la recepción

Sin cambios de API: la foto y la firma se suben por el mismo
`POST /radicados/adjuntos` que cualquier archivo, y viajan en `adjuntos[]` al
radicar. Ver requisito formal en Requerimientos §20 y componentes de frontend:

- `apps/web/src/components/CapturaCamara.tsx` — `getUserMedia` con selector de
  dispositivo (útil para elegir una webcam USB) y captura a JPEG; si el sitio no
  corre en un contexto seguro (HTTPS o `localhost`) o el navegador niega el
  permiso, cae a `<input type="file" accept="image/*" capture="environment">`,
  que abre la cámara nativa en un móvil sin necesitar HTTPS.
- `apps/web/src/components/FirmaPad.tsx` — lienzo con eventos de puntero
  unificados (mouse, táctil, lápiz); exporta PNG al soltar el trazo.
- Integrados en `Radicar.tsx` (foto siempre disponible; firma solo si
  `canal === 'PRESENCIAL'`) y en `Expedientes.tsx` (incorporar documento).
- El archivo de firma se sube con el nombre fijo `firma-recepcion.png`, que el
  frontend usa para etiquetarlo con la descripción "Firma de quien entrega el
  documento" antes de radicar.

Verificado con Chrome headless + dispositivo de cámara simulado: vista previa
en vivo, captura, miniatura con opción de quitar, firma dibujada con eventos de
mouse simulados, radicación con **2 anexos reales** (`captura-*.jpg` 9 KB,
`firma-recepcion.png` 5.8 KB, con su descripción) verificados vía API tras el
envío; e incorporación de la misma foto/firma al índice del expediente.

## Verificado (stack en contenedores)

```
✓ 3 radicaciones → 000001, 000002, 000003 (consecutivas)
✓ derecho de petición → fechaVencimiento a 15 días hábiles (calendario 2026)
✓ salida con enRespuestaA → entrada pasa a RESPONDIDO + evento RESPUESTA_GENERADA
✓ anulación de 000002 → ANULADO; siguiente radicado es 000004 (sin reutilizar)
✓ adjunto multipart con checksum SHA-256; descarga auditada
✓ cadena de bitácora intacta
```
