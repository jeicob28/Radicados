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

## Adenda (2026-09-04) — Módulo de usuarios y módulo de dependencias

A petición del usuario, una vez construidas F0–F6, se reforzaron estos dos módulos con
pantallas propias de administración y funciones de seguridad adicionales. Ver requisito
formal en `Requerimientos_Sistema_Radicacion_Gestion_Documental_Colombia.md` §19.

### API nueva

| Endpoint | Rol | Qué hace |
|---|---|---|
| `POST /usuarios/:id/password` | ADMIN | Fija una contraseña específica; `forzarCambio` (bool) decide si exige cambio en el próximo ingreso |
| `POST /usuarios/:id/cerrar-sesiones` | ADMIN | Revoca todos los refresh tokens activos del usuario |
| `GET /usuarios?dependenciaId=` | ADMIN | Filtra el personal por dependencia (usado por los selectores de asignación) |
| `GET /dependencias/:id` | autenticado | Detalle de una dependencia: superior, sub-dependencias, **personal asignado**, conteo de radicados/expedientes |

### Política de contraseñas

Parámetro `seguridad.password_policy` (`PasswordPolicyService`, cacheado 60s):
`minLength`, `requireUpper`, `requireLower`, `requireNumber`, `requireSpecial`,
`caducidadDias`. Se valida en creación de usuario, cambio propio y contraseña fijada por
admin. Si `caducidadDias` está definido y se vence, el siguiente `login` marca
`debeCambiarPassword=true` automáticamente (mismo mecanismo que el primer ingreso).

### Frontend

- `/admin/usuarios` — alta, edición de roles/dependencia/estado, restablecer (temporal),
  fijar contraseña específica, cerrar sesiones.
- `/admin/roles` — catálogo de roles y permisos (los roles de sistema no editan permisos).
- `/admin/dependencias` — organigrama con panel de personal por dependencia; quitar
  personal reutiliza `PATCH /usuarios/:id` (`dependenciaId: null`).
- Pantalla de **cambio de contraseña obligatorio**: si `usuario.debeCambiarPassword`,
  bloquea el resto de la aplicación hasta que se cambie.
- Los modales de *asignar / trasladar / reasignar* de un radicado ahora listan el
  **personal real de la dependencia elegida** en vez de pedir un ID a mano.

### Verificado

```
✓ crear usuario con contraseña débil → 400 (política)
✓ admin fija contraseña con forzarCambio=false → login inmediato, sin pantalla forzada
✓ cerrar-sesiones revoca el refresh token
✓ GET /dependencias/:id incluye el personal asignado
✓ mover un usuario de dependencia lo retira de la anterior
✓ pantalla de cambio forzado bloquea la navegación hasta cambiar la contraseña
✓ modal de asignación lista el personal real de la dependencia seleccionada
```

## Siguiente: Fase 2 — Núcleo de radicación

Ventanilla única (presencial + web), transacción del consecutivo (`fn_asignar_consecutivo`
dentro de una transacción `SERIALIZABLE`), radicado de entrada y salida, carga de anexos a
MinIO con checksum, anulación con justificación desde la API, y consulta/búsqueda de radicados.
