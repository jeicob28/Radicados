# Fase 6 — Ciclo de vida, MFA y auditoría exportable

## Transferencias documentales (`/transferencias`, rol ARCHIVISTA)
- `POST /transferencias` — elabora la transferencia (`PRIMARIA` o `SECUNDARIA`) con su **inventario**
  de expedientes cerrados (número, título, serie, fechas extremas, folios).
- `GET /transferencias/:n/inventario` — formato único de inventario documental.
- `POST /transferencias/:n/enviar` → `ENVIADA`.
- `POST /transferencias/:n/recibir` → `RECIBIDA`; los expedientes pasan a
  `TRANSFERIDO_CENTRAL` (primaria) o `TRANSFERIDO_HISTORICO` (secundaria).

## Disposición final (`/disposicion-final`, doble aprobación)
- `POST /disposicion-final` (ARCHIVISTA) — solicita la disposición sobre uno o más expedientes,
  con justificación detallada y normativa.
- `POST /disposicion-final/:n/aprobar` — **dos aprobaciones de personas distintas**;
  el solicitante no puede ser el primer aprobador.
- `POST /disposicion-final/:n/rechazar`.
- `POST /disposicion-final/:n/ejecutar` — solo tras `APROBADA`; aplica el estado final a los
  expedientes (`ELIMINADO` / `CONSERVADO`).

## MFA (TOTP)
- `POST /auth/mfa/setup` — genera el secreto y la URL `otpauth://` para el autenticador.
- `POST /auth/mfa/activar` `{codigo}` — activa tras verificar un código.
- `POST /auth/mfa/desactivar` `{codigo}`.
- Con MFA activo, `POST /auth/login` exige el campo `codigo` (si falta → 401 "MFA requerido").

## Auditoría exportable
- `GET /bitacora/exportar` (AUDITOR) — todas las entradas + resultado de la verificación de la cadena
  + `ultimoHash` + **sello HMAC-SHA256** sobre `(ultimoHash · total · fecha)` con `AUDIT_EXPORT_SECRET`.

## Verificado

```
✓ MFA: setup → activar (TOTP) → login sin código = 401 → login con código = OK → desactivar
✓ transferencia PRIMARIA (2 exp, 2 folios) → enviar → recibir → expedientes TRANSFERIDO_CENTRAL
✓ disposición ELIMINACION: solicitante ≠ primer aprobador; 2ª aprobación ≠ 1ª persona
✓ APROBADA_PARCIAL → APROBADA → EJECUTADA → expediente ELIMINADO
✓ /bitacora/exportar → 25 entradas, verificación ok, sello HMAC
✓ cadena de bitácora intacta (26 entradas)
```

## Operación (no software)

- Copias de seguridad: `pgdata` y `miniodata` cifradas, prueba de restauración mensual (3-2-1).
- MinIO `object-lock` (WORM) para el documento archivado definitivo — configurar por bucket.
- Matriz de requisitos normativos: levantarla con Jurídica/Archivo antes de producción.
