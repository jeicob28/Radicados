# Fase 1 — Identidad, RBAC y auditoría persistente

## Qué entrega

### Autenticación (`/api/v1/auth`)
- `POST /auth/login` — access token (JWT, 15 min) + cookie `sgdea_refresh` httpOnly (7 días).
- `POST /auth/refresh` — rotación del refresh token (revoca el usado, emite uno nuevo).
- `POST /auth/logout` — revoca el refresh token y limpia la cookie.
- `GET  /auth/me` — perfil del usuario autenticado.
- `POST /auth/cambiar-password` — cambia la propia contraseña y cierra las demás sesiones.
- Contraseñas con **Argon2id** (`@node-rs/argon2`, sin compilación nativa).
- Refresh tokens guardados **hasheados** (SHA-256) en `refresh_token`, con IP y user-agent.

### RBAC
- Guard global `JwtAuthGuard` (todas las rutas exigen token salvo `@Public()`).
- Guard global `RolesGuard` con `@Roles(...)`; **`ADMIN` es superrol**.
- Catálogo de roles en la tabla `rol` (sembrado, ampliable desde `/api/v1/roles`):
  `ADMIN · RADICADOR · VENTANILLA · FUNCIONARIO · JEFE · ARCHIVISTA · AUDITOR`.

### CRUD de administración
| Recurso | Lectura | Escritura |
|---|---|---|
| `/usuarios` | ADMIN | ADMIN — crea con contraseña temporal, `reset-password`, activar/desactivar (revoca sesiones) |
| `/roles` | autenticado | ADMIN |
| `/dependencias` | autenticado (árbol jerárquico) | ADMIN |
| `/terceros` | autenticado (búsqueda) | VENTANILLA · FUNCIONARIO · RADICADOR |
| `/parametros` | autenticado | ADMIN |

### Auditoría persistente (`/api/v1/bitacora`)
- Cada escritura relevante llama a `BitacoraService.registrar(...)` → fila en `bitacora`
  con usuario, IP, user-agent, `antes`/`despues` y observación.
- El **hash encadenado lo calcula PostgreSQL** (trigger `fn_bitacora_hash`, función
  `fn_bitacora_contenido`).
- `GET /bitacora` — consulta filtrada y paginada (rol `AUDITOR`).
- `GET /bitacora/verificacion` — recorre la cadena completa (`fn_verificar_bitacora`) y
  devuelve `{ total, ok, rupturaEnId }`.

## Migración

`apps/api/prisma/migrations/20260902000000_auth` — columnas de auth en `usuario`,
tablas `rol` y `refresh_token`, y las funciones de verificación de la bitácora.

## Verificado (stack en contenedores)

```
✓ ruta protegida sin token            → 401
✓ login admin                         → accessToken + cookie
✓ /auth/me                            → perfil correcto
✓ crear usuario (admin)               → devuelve contraseña temporal
✓ contraseña incorrecta               → 401 (+ entrada "Intento fallido" en bitácora)
✓ FUNCIONARIO → GET /dependencias      → 200
✓ FUNCIONARIO → GET /usuarios          → 403
✓ FUNCIONARIO → POST /roles            → 403
✓ FUNCIONARIO → GET /bitacora          → 403
✓ cambiar-password                    → ok, cierra otras sesiones
✓ POST /auth/refresh (cookie)         → 200, rota el token
✓ GET /bitacora/verificacion          → { ok: true } con 7 entradas encadenadas
```

## Credenciales sembradas

`admin@empresa.local` / `Admin2026*Cambiar` (marca `debeCambiarPassword`).
Sobrescribir con `SEED_ADMIN_PASSWORD` al ejecutar el seed.

## Siguiente: Fase 2 — Núcleo de radicación

Ventanilla única (presencial + web), transacción del consecutivo (`fn_asignar_consecutivo`
dentro de una transacción `SERIALIZABLE`), radicado de entrada y salida, carga de anexos a
MinIO con checksum, anulación con justificación desde la API, y consulta/búsqueda de radicados.
