-- SGDEA · Módulo de usuarios (política de contraseña / caducidad) y
-- refuerzo del módulo de dependencias (sin cambios de esquema, solo el
-- registro de cuándo cambió la contraseña por última vez).

ALTER TABLE "usuario"
  ADD COLUMN "password_cambiada_en" TIMESTAMP(3);
