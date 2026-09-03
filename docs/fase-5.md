# Fase 5 — Reportes, correo y contingencia

## Reportes
`GET /reportes/{tipo}?desde=&hasta=&dependenciaId=&vigencia=&formato=json|xlsx` (JEFE·RADICADOR·AUDITOR·ARCHIVISTA)

Tipos: `recibidos` · `enviados` · `pendientes` · `vencidos` · `por-dependencia` · `por-funcionario` ·
`tiempo-respuesta` · `derechos-peticion` · `documentos-por-serie` · `anulados`.

`formato=xlsx` devuelve un `.xlsx` (ExcelJS). Toda generación queda en bitácora (`EXPORTAR`).

## Integración de correo (`/correo`)
- `POST /correo/capturar` — **solo token interno** (`X-Internal-Token`); lo llama el worker.
- `GET /correo/pendientes` · `GET /correo/:id` (VENTANILLA·RADICADOR).
- `POST /correo/:id/radicar` — crea un radicado de entrada `canal=CORREO`, adjunta el `.eml` original
  y los archivos, enlaza y marca el correo como `RADICADO`.
- `POST /correo/:id/descartar` — con motivo.
- **Worker**: `ImapService` revisa `INBOX` por IMAP cada 5 min si `IMAP_HOST` está configurado
  (`imapflow` + `mailparser`), y envía cada mensaje nuevo a `/correo/capturar`.

## Plan de contingencia (`/contingencia`, rol RADICADOR)
- `POST /contingencia/incorporar` — incorpora un radicado hecho manualmente durante una caída:
  - valida que `numeroTalonario` esté **dentro del rango de contingencia** del consecutivo;
  - impide **reutilizar** un número ya usado (`ultimoContingencia`);
  - conserva la **fecha/hora real**, marca `origen=CONTINGENCIA`, exige justificación/acta.
- `GET /contingencia/conciliacion?tipo=` — verifica que todo el rango incorporado no tenga
  huecos (`faltantes`) ni **colisiones** con el generador normal.

## Verificado

```
✓ 10 reportes con resumen; export XLSX válido (Microsoft Excel 2007+)
✓ /correo/capturar sin token → 403; con token → OK; radicar → 2026-ENT-000003
✓ contingencia: talonario 900001 → 2026-ENT-900001
✓ reutilizar 900001 → 400 "ya fue usado en contingencia"
✓ número 5 fuera de rango → 400
✓ conciliación → faltantes [], colisiones [], ok:true
✓ cadena de bitácora intacta
```
