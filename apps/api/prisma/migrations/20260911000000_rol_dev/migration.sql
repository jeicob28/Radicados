-- SGDEA · Rol técnico DEV — separación de funciones.
-- ADMIN queda con la administración funcional (usuarios, roles, dependencias,
-- metas de indicadores, disposición documental). DEV es el soporte técnico /
-- superusuario: marca, copias de seguridad, parámetros del sistema,
-- mantenimiento e infraestructura del SGSI. Solo un DEV puede otorgar DEV.

INSERT INTO "rol" ("id", "codigo", "nombre", "descripcion", "permisos", "sistema", "creado", "actualizado")
VALUES (
  (gen_random_uuid())::text,
  'DEV',
  'Soporte técnico',
  'Soporte técnico y superusuario: marca, copias de seguridad, parámetros del sistema, mantenimiento e infraestructura del SGSI. Solo un DEV puede otorgar el rol DEV.',
  ARRAY['*']::TEXT[],
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("codigo") DO NOTHING;

-- Bootstrap único: los administradores existentes (uno por entorno) pasan a
-- tener también el rol DEV. Los administradores creados después NO reciben DEV
-- automáticamente (separación de funciones hacia adelante).
UPDATE "usuario"
SET "roles" = array_append("roles", 'DEV')
WHERE 'ADMIN' = ANY("roles") AND NOT ('DEV' = ANY("roles"));
