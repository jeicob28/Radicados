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

## Adenda (2026-09-04) — Fecha de llegada y "entregado por"

A petición del usuario, faltaban en el radicado dos datos propios de la
recepción física, junto a la firma (Requerimientos §20.3):

- Migración `20260909000000_recepcion_fisica`: columnas nuevas y opcionales
  en `radicado` — `fecha_recepcion` (timestamp) y `entregado_por` (texto).
  No son de identidad: `fn_radicado_inmutable` no las protege por columna,
  pero como todo `radicado`, se fijan una sola vez al crear y no hay ningún
  `UPDATE` que las toque después — append-only en la práctica igual que el
  resto de la fila. No entran en el cálculo de `hashRegistro` (no cambia el
  formato del hash encadenado existente).
- `RadicarDto` acepta `fechaRecepcion` (ISO, opcional) y `entregadoPor`
  (texto, opcional); `RadicacionService.radicar` los persiste tal cual.
- `Radicar.tsx`: el bloque de recepción física (fecha de llegada + entregado
  por + firma) ahora se muestra para **entrada** con canal `PRESENCIAL` **o
  `FISICO`** (antes la firma solo aparecía en `PRESENCIAL`).
- `RadicadoDetalle.tsx`: nuevas filas "Llegada del documento" y "Entregado
  por" en la tarjeta *Datos* (solo si el radicado los trae), y una tarjeta
  "Firma de quien entrega el documento" con vista previa `<img>` de la firma
  (se resuelve por descarga autenticada del anexo `firma-recepcion.png` a un
  blob URL — helper `blobUrl` en `api.ts` — no por URL pública de MinIO).

Verificado: build de API (`tsc --noEmit`) y de `web` (`vite build`) limpios,
suite Jest de la API en verde, migración aplicada en el stack de Docker
Compose local, y creación de un radicado vía API con `fechaRecepcion` y
`entregadoPor` confirmando que ambos quedan guardados y se devuelven en
`GET /radicados/:numero`.

## Verificado (stack en contenedores)

```
✓ 3 radicaciones → 000001, 000002, 000003 (consecutivas)
✓ derecho de petición → fechaVencimiento a 15 días hábiles (calendario 2026)
✓ salida con enRespuestaA → entrada pasa a RESPONDIDO + evento RESPUESTA_GENERADA
✓ anulación de 000002 → ANULADO; siguiente radicado es 000004 (sin reutilizar)
✓ adjunto multipart con checksum SHA-256; descarga auditada
✓ cadena de bitácora intacta
```
