-- SGDEA · Fase 1 — Identidad, RBAC y verificación de la cadena de auditoría.

-- ============================================================================
-- Usuario: campos de autenticación
-- ============================================================================
ALTER TABLE "usuario"
  ADD COLUMN "ultimo_acceso"         TIMESTAMP(3),
  ADD COLUMN "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- Catálogo de roles
-- ============================================================================
CREATE TABLE "rol" (
  "id"          TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "codigo"      TEXT NOT NULL,
  "nombre"      TEXT NOT NULL,
  "descripcion" TEXT,
  "permisos"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sistema"     BOOLEAN NOT NULL DEFAULT false,
  "creado"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rol_codigo_key" UNIQUE ("codigo")
);

-- ============================================================================
-- Refresh tokens (rotación y revocación)
-- ============================================================================
CREATE TABLE "refresh_token" (
  "id"          TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "usuario_id"  TEXT NOT NULL,
  "token_hash"  TEXT NOT NULL,
  "expira_en"   TIMESTAMP(3) NOT NULL,
  "revocado_en" TIMESTAMP(3),
  "user_agent"  TEXT,
  "ip"          TEXT,
  "creado"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_token_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "refresh_token_usuario_fk" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
);
CREATE INDEX "refresh_token_usuario_idx" ON "refresh_token" ("usuario_id");

-- ============================================================================
-- Bitácora: contenido canónico reutilizable + verificación de la cadena
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_bitacora_contenido(r "bitacora") RETURNS TEXT AS $$
  SELECT COALESCE(r."usuario_id", '') || '|' ||
         COALESCE(to_char(r."fecha_hora", 'YYYY-MM-DD"T"HH24:MI:SS.MS'), '') || '|' ||
         r."entidad" || '|' || COALESCE(r."entidad_id", '') || '|' ||
         r."accion"::text || '|' ||
         COALESCE(r."antes"::text, '') || '|' ||
         COALESCE(r."despues"::text, '') || '|' ||
         COALESCE(r."observacion", '');
$$ LANGUAGE sql STABLE;

-- Reemplaza la función del F0 con la misma fórmula (cadena idéntica byte a byte).
CREATE OR REPLACE FUNCTION fn_bitacora_hash() RETURNS TRIGGER AS $$
DECLARE
  v_prev TEXT;
BEGIN
  SELECT "hash" INTO v_prev FROM "bitacora" ORDER BY "id" DESC LIMIT 1;
  NEW."hash_anterior" := v_prev;
  NEW."hash" := encode(
    digest(COALESCE(v_prev, '') || '|' || fn_bitacora_contenido(NEW), 'sha256'),
    'hex'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recorre toda la bitácora y detecta la primera ruptura de la cadena de hashes.
CREATE OR REPLACE FUNCTION fn_verificar_bitacora()
RETURNS TABLE ("total" BIGINT, "ok" BOOLEAN, "ruptura_id" BIGINT) AS $$
DECLARE
  r "bitacora";
  v_prev TEXT := NULL;
  v_calc TEXT;
  v_total BIGINT := 0;
  v_bad BIGINT := NULL;
BEGIN
  FOR r IN SELECT * FROM "bitacora" ORDER BY "id" LOOP
    v_total := v_total + 1;
    v_calc := encode(
      digest(COALESCE(v_prev, '') || '|' || fn_bitacora_contenido(r), 'sha256'),
      'hex'
    );
    IF v_calc <> r."hash" AND v_bad IS NULL THEN
      v_bad := r."id";
    END IF;
    v_prev := r."hash";
  END LOOP;
  "total" := v_total;
  "ok" := (v_bad IS NULL);
  "ruptura_id" := v_bad;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
