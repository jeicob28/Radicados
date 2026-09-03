# Fase 4 — Gestión documental y TRD

## Entrega

### Cuadro de clasificación y TRD
- `GET /trd` — cuadro completo: dependencia → serie → subserie con reglas de retención.
- `series` / `series/:id/subseries` / `tipos-documentales` — CRUD (ARCHIVISTA).
- Cada serie define: retención en archivo de gestión (años), retención en archivo central (años),
  disposición final (`CONSERVACION_TOTAL` · `ELIMINACION` · `SELECCION` · `MICROFILMACION_DIGITALIZACION`).
  Las subseries pueden sobrescribir esos valores.

### Expedientes electrónicos
- `POST /expedientes` (ARCHIVISTA) — abre el expediente; número `{DEP}-{SERIE}-{año}-{consec:04}`
  (secuencia atómica `fn_siguiente_secuencia`).
- `POST /expedientes/:n/documentos` (multipart) — incorpora un documento simple o un anexo existente.
- `POST /expedientes/:n/foliar` — foliado consecutivo (rango folio inicio–fin por documento).
- `GET /expedientes/:n/indice` — hoja de control / índice.
- `POST /expedientes/:n/verificar-integridad` — compara el checksum de cada documento contra MinIO.
- `POST /expedientes/:n/cerrar` — calcula fechas extremas y **fechas límite de retención**
  (cierre + AG años → límite archivo de gestión; + AC años → límite archivo central) y fija la disposición final.

### Clasificación del radicado
- `POST /radicados/:n/clasificar` (ARCHIVISTA·VENTANILLA) — asigna serie/subserie, crea o reutiliza
  el expediente, incorpora el radicado y sus anexos como documentos, evento `CLASIFICADO`.

## Verificado

```
✓ cuadro TRD con subseries heredando retención de la serie
✓ radicar → clasificar → expediente ADM-100-2026-0001 creado
✓ incorporar documento (multipart) → orden 2
✓ foliar → totalFolios 2 (folios 1-1, 2-2)
✓ verificar-integridad → OK / SIN_CHECKSUM por documento
✓ cerrar → límite archivo gestión 2028, central 2036, disposición SELECCION
✓ cadena de bitácora intacta
```
