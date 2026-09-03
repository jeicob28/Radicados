-- SGDEA · migración inicial
-- Esquema núcleo + controles de integridad del consecutivo (Acuerdo 001 de 2024, AGN).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Tipos
-- ============================================================================
CREATE TYPE "TipoConsecutivo" AS ENUM ('ENT', 'SAL', 'UNICO');

CREATE TYPE "EstadoRadicado" AS ENUM (
  'RECIBIDO', 'RADICADO', 'CLASIFICADO', 'ASIGNADO', 'EN_TRAMITE',
  'RESPONDIDO', 'CERRADO', 'REABIERTO', 'ANULADO'
);

CREATE TYPE "CanalRecepcion" AS ENUM (
  'PRESENCIAL', 'CORREO', 'WEB', 'FORMULARIO', 'SISTEMA', 'TELEFONO', 'FISICO'
);

CREATE TYPE "TipoComunicacion" AS ENUM (
  'GENERAL', 'DERECHO_PETICION', 'PETICION_INFORMACION', 'PETICION_DOCUMENTOS',
  'CONSULTA', 'QUEJA', 'RECLAMO', 'SOLICITUD', 'FELICITACION', 'SUGERENCIA', 'OTRO'
);

CREATE TYPE "TipoEventoTramite" AS ENUM (
  'RADICADO', 'CLASIFICADO', 'ASIGNADO', 'RECIBIDO', 'EN_TRAMITE', 'TRASLADADO',
  'REASIGNADO', 'RESPUESTA_GENERADA', 'CERRADO', 'ANULADO', 'REABIERTO', 'NOTA'
);

CREATE TYPE "AccionBitacora" AS ENUM (
  'CREAR', 'LEER', 'ACTUALIZAR', 'ANULAR', 'ASIGNAR', 'REASIGNAR', 'TRASLADAR',
  'CAMBIAR_ESTADO', 'DESCARGAR', 'EXPORTAR', 'LOGIN', 'LOGOUT'
);

CREATE TYPE "OrigenRadicado" AS ENUM ('SISTEMA', 'CONTINGENCIA', 'MIGRACION');

-- ============================================================================
-- Catálogos y organización
-- ============================================================================
CREATE TABLE "parametro" (
  "clave"       TEXT PRIMARY KEY,
  "valor"       JSONB NOT NULL,
  "descripcion" TEXT,
  "actualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "festivo" (
  "fecha"       DATE PRIMARY KEY,
  "descripcion" TEXT NOT NULL
);

CREATE TABLE "dependencia" (
  "id"        TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "codigo"    TEXT NOT NULL,
  "nombre"    TEXT NOT NULL,
  "parent_id" TEXT,
  "activa"    BOOLEAN NOT NULL DEFAULT true,
  "creada"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dependencia_codigo_key" UNIQUE ("codigo"),
  CONSTRAINT "dependencia_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "dependencia"("id")
);

CREATE TABLE "usuario" (
  "id"             TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "documento"      TEXT NOT NULL,
  "nombre"         TEXT NOT NULL,
  "email"          TEXT NOT NULL,
  "password_hash"  TEXT,
  "activo"         BOOLEAN NOT NULL DEFAULT true,
  "roles"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "dependencia_id" TEXT,
  "creado"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usuario_documento_key" UNIQUE ("documento"),
  CONSTRAINT "usuario_email_key" UNIQUE ("email"),
  CONSTRAINT "usuario_dependencia_fk" FOREIGN KEY ("dependencia_id") REFERENCES "dependencia"("id")
);

CREATE TABLE "tercero" (
  "id"                   TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "tipo_persona"         TEXT NOT NULL,
  "tipo_documento"       TEXT NOT NULL,
  "numero_documento"     TEXT NOT NULL,
  "nombre"               TEXT NOT NULL,
  "email"                TEXT,
  "telefono"             TEXT,
  "direccion"            TEXT,
  "ciudad"               TEXT,
  "autoriza_tratamiento" BOOLEAN NOT NULL DEFAULT false,
  "creado"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tercero_documento_key" UNIQUE ("tipo_documento", "numero_documento")
);

-- ============================================================================
-- Consecutivo
-- ============================================================================
CREATE TABLE "consecutivo" (
  "id"                       TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "vigencia"                 INTEGER NOT NULL,
  "tipo"                     "TipoConsecutivo" NOT NULL,
  "ultimo_numero"            INTEGER NOT NULL DEFAULT 0,
  "formato"                  TEXT NOT NULL DEFAULT '{vigencia}-{tipo}-{numero:06}',
  "rango_contingencia_desde" INTEGER,
  "rango_contingencia_hasta" INTEGER,
  "ultimo_contingencia"      INTEGER,
  "creado"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consecutivo_vigencia_tipo_key" UNIQUE ("vigencia", "tipo"),
  CONSTRAINT "consecutivo_ultimo_numero_no_negativo" CHECK ("ultimo_numero" >= 0)
);

-- ============================================================================
-- Radicado  (APPEND-ONLY)
-- ============================================================================
CREATE TABLE "radicado" (
  "id"                    TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "numero"                TEXT NOT NULL,
  "vigencia"              INTEGER NOT NULL,
  "tipo"                  "TipoConsecutivo" NOT NULL,
  "consecutivo_id"        TEXT NOT NULL,
  "secuencial"            INTEGER NOT NULL,
  "origen"                "OrigenRadicado" NOT NULL DEFAULT 'SISTEMA',
  "canal"                 "CanalRecepcion" NOT NULL,
  "fecha_hora_radicacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tercero_id"            TEXT,
  "destinatario"          TEXT,
  "dependencia_id"        TEXT,
  "funcionario_id"        TEXT,
  "asunto"                TEXT NOT NULL,
  "tipo_comunicacion"     "TipoComunicacion" NOT NULL DEFAULT 'GENERAL',
  "medio_respuesta"       TEXT,
  "estado"                "EstadoRadicado" NOT NULL DEFAULT 'RADICADO',
  "folios"                INTEGER NOT NULL DEFAULT 0,
  "fecha_vencimiento"     DATE,
  "radicado_respuesta_id" TEXT,
  "hash_registro"         TEXT NOT NULL,
  "hash_anterior"         TEXT,
  "creado"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "radicado_numero_key" UNIQUE ("numero"),
  CONSTRAINT "radicado_consecutivo_secuencial_key" UNIQUE ("consecutivo_id", "secuencial"),
  CONSTRAINT "radicado_consecutivo_fk" FOREIGN KEY ("consecutivo_id") REFERENCES "consecutivo"("id"),
  CONSTRAINT "radicado_tercero_fk"     FOREIGN KEY ("tercero_id") REFERENCES "tercero"("id"),
  CONSTRAINT "radicado_dependencia_fk" FOREIGN KEY ("dependencia_id") REFERENCES "dependencia"("id"),
  CONSTRAINT "radicado_funcionario_fk" FOREIGN KEY ("funcionario_id") REFERENCES "usuario"("id")
);
CREATE INDEX "radicado_vigencia_tipo_idx"     ON "radicado" ("vigencia", "tipo");
CREATE INDEX "radicado_estado_idx"            ON "radicado" ("estado");
CREATE INDEX "radicado_fecha_vencimiento_idx" ON "radicado" ("fecha_vencimiento");
CREATE INDEX "radicado_asunto_fts_idx"        ON "radicado" USING gin (to_tsvector('spanish', "asunto"));

-- ============================================================================
-- Evento de trámite / trazabilidad  (APPEND-ONLY)
-- ============================================================================
CREATE TABLE "evento_tramite" (
  "id"              TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "radicado_id"     TEXT NOT NULL,
  "secuencia"       INTEGER NOT NULL,
  "tipo_evento"     "TipoEventoTramite" NOT NULL,
  "estado_anterior" "EstadoRadicado",
  "estado_nuevo"    "EstadoRadicado",
  "actor_id"        TEXT,
  "ip"              TEXT,
  "observacion"     TEXT,
  "datos"           JSONB,
  "fecha_hora"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evento_tramite_radicado_secuencia_key" UNIQUE ("radicado_id", "secuencia"),
  CONSTRAINT "evento_tramite_radicado_fk" FOREIGN KEY ("radicado_id") REFERENCES "radicado"("id"),
  CONSTRAINT "evento_tramite_actor_fk"    FOREIGN KEY ("actor_id") REFERENCES "usuario"("id")
);
CREATE INDEX "evento_tramite_radicado_idx" ON "evento_tramite" ("radicado_id");

-- ============================================================================
-- Anulación
-- ============================================================================
CREATE TABLE "anulacion" (
  "id"            TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "radicado_id"   TEXT NOT NULL,
  "usuario_id"    TEXT,
  "motivo"        TEXT NOT NULL,
  "justificacion" TEXT NOT NULL,
  "fecha"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anulacion_radicado_key" UNIQUE ("radicado_id"),
  CONSTRAINT "anulacion_radicado_fk" FOREIGN KEY ("radicado_id") REFERENCES "radicado"("id"),
  CONSTRAINT "anulacion_usuario_fk"  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
);

-- ============================================================================
-- Anexos (objetos en MinIO)
-- ============================================================================
CREATE TABLE "anexo" (
  "id"              TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "radicado_id"     TEXT NOT NULL,
  "nombre"          TEXT NOT NULL,
  "descripcion"     TEXT,
  "object_key"      TEXT NOT NULL,
  "content_type"    TEXT,
  "tamano_bytes"    INTEGER,
  "checksum_sha256" TEXT,
  "paginas"         INTEGER,
  "creado"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anexo_radicado_fk" FOREIGN KEY ("radicado_id") REFERENCES "radicado"("id")
);
CREATE INDEX "anexo_radicado_idx" ON "anexo" ("radicado_id");

-- ============================================================================
-- Bitácora de auditoría  (APPEND-ONLY, hash encadenado)
-- ============================================================================
CREATE TABLE "bitacora" (
  "id"             BIGSERIAL PRIMARY KEY,
  "fecha_hora"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usuario_id"     TEXT,
  "usuario_nombre" TEXT,
  "ip"             TEXT,
  "user_agent"     TEXT,
  "entidad"        TEXT NOT NULL,
  "entidad_id"     TEXT,
  "accion"         "AccionBitacora" NOT NULL,
  "antes"          JSONB,
  "despues"        JSONB,
  "observacion"    TEXT,
  "hash_anterior"  TEXT,
  "hash"           TEXT NOT NULL
);
CREATE INDEX "bitacora_entidad_idx"    ON "bitacora" ("entidad", "entidad_id");
CREATE INDEX "bitacora_fecha_hora_idx" ON "bitacora" ("fecha_hora");

-- ============================================================================
-- CONTROLES DE INTEGRIDAD (capítulos 3, 6 y 10)
-- ============================================================================

-- 1) Prohibir DELETE en tablas de evidencia -----------------------------------
CREATE OR REPLACE FUNCTION fn_prohibir_delete() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Operacion no permitida: "%" es append-only (Acuerdo 001 de 2024)', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_radicado_no_delete  BEFORE DELETE ON "radicado"       FOR EACH ROW EXECUTE FUNCTION fn_prohibir_delete();
CREATE TRIGGER trg_evento_no_delete    BEFORE DELETE ON "evento_tramite" FOR EACH ROW EXECUTE FUNCTION fn_prohibir_delete();
CREATE TRIGGER trg_anulacion_no_delete BEFORE DELETE ON "anulacion"      FOR EACH ROW EXECUTE FUNCTION fn_prohibir_delete();
CREATE TRIGGER trg_bitacora_no_delete  BEFORE DELETE ON "bitacora"       FOR EACH ROW EXECUTE FUNCTION fn_prohibir_delete();

-- 2) Prohibir UPDATE total (evento_tramite, bitacora) ------------------------
CREATE OR REPLACE FUNCTION fn_prohibir_update() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Operacion no permitida: "%" es append-only', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evento_no_update   BEFORE UPDATE ON "evento_tramite" FOR EACH ROW EXECUTE FUNCTION fn_prohibir_update();
CREATE TRIGGER trg_bitacora_no_update BEFORE UPDATE ON "bitacora"       FOR EACH ROW EXECUTE FUNCTION fn_prohibir_update();

-- 3) Radicado: identidad y fecha inmutables ---------------------------------
CREATE OR REPLACE FUNCTION fn_radicado_inmutable() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."numero" <> OLD."numero"
     OR NEW."vigencia" <> OLD."vigencia"
     OR NEW."tipo" <> OLD."tipo"
     OR NEW."consecutivo_id" <> OLD."consecutivo_id"
     OR NEW."secuencial" <> OLD."secuencial"
     OR NEW."fecha_hora_radicacion" <> OLD."fecha_hora_radicacion"
     OR NEW."hash_registro" <> OLD."hash_registro"
     OR COALESCE(NEW."hash_anterior", '') <> COALESCE(OLD."hash_anterior", '') THEN
    RAISE EXCEPTION 'No se puede alterar el numero, la fecha de radicacion ni la cadena de integridad de un radicado'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_radicado_inmutable BEFORE UPDATE ON "radicado" FOR EACH ROW EXECUTE FUNCTION fn_radicado_inmutable();

-- 4) Bitácora: hash encadenado calculado en la base ------------------------
CREATE OR REPLACE FUNCTION fn_bitacora_hash() RETURNS TRIGGER AS $$
DECLARE
  v_prev TEXT;
BEGIN
  SELECT "hash" INTO v_prev FROM "bitacora" ORDER BY "id" DESC LIMIT 1;
  NEW."hash_anterior" := v_prev;
  NEW."hash" := encode(
    digest(
      COALESCE(v_prev, '') || '|' ||
      COALESCE(NEW."usuario_id", '') || '|' ||
      COALESCE(to_char(NEW."fecha_hora", 'YYYY-MM-DD"T"HH24:MI:SS.MS'), '') || '|' ||
      NEW."entidad" || '|' || COALESCE(NEW."entidad_id", '') || '|' ||
      NEW."accion"::text || '|' ||
      COALESCE(NEW."antes"::text, '') || '|' ||
      COALESCE(NEW."despues"::text, '') || '|' ||
      COALESCE(NEW."observacion", ''),
      'sha256'
    ), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bitacora_hash BEFORE INSERT ON "bitacora" FOR EACH ROW EXECUTE FUNCTION fn_bitacora_hash();

-- 5) Asignación atómica del consecutivo -----------------------------------
--    SELECT * FROM fn_asignar_consecutivo(2026, 'ENT');
--    Debe invocarse dentro de la transacción que inserta el radicado.
CREATE OR REPLACE FUNCTION fn_asignar_consecutivo(p_vigencia INTEGER, p_tipo "TipoConsecutivo")
RETURNS TABLE ("consecutivo_id" TEXT, "secuencial" INTEGER, "numero" TEXT) AS $$
DECLARE
  v "consecutivo"%ROWTYPE;
  v_num INTEGER;
  v_txt TEXT;
BEGIN
  SELECT * INTO v FROM "consecutivo"
    WHERE "vigencia" = p_vigencia AND "tipo" = p_tipo
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe consecutivo configurado para vigencia % y tipo %', p_vigencia, p_tipo;
  END IF;

  v_num := v."ultimo_numero" + 1;

  -- el generador normal nunca invade el rango reservado para contingencia
  IF v."rango_contingencia_desde" IS NOT NULL
     AND v_num >= v."rango_contingencia_desde"
     AND v_num <= v."rango_contingencia_hasta" THEN
    v_num := v."rango_contingencia_hasta" + 1;
  END IF;

  UPDATE "consecutivo" SET "ultimo_numero" = v_num WHERE "id" = v."id";

  v_txt := replace(v."formato", '{vigencia}', p_vigencia::text);
  v_txt := replace(v_txt, '{tipo}', p_tipo::text);
  v_txt := replace(v_txt, '{numero:06}', lpad(v_num::text, 6, '0'));
  v_txt := replace(v_txt, '{numero}', v_num::text);

  "consecutivo_id" := v."id";
  "secuencial" := v_num;
  "numero" := v_txt;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 6) Anular un radicado conservando la evidencia -------------------------
CREATE OR REPLACE FUNCTION fn_anular_radicado(
  p_radicado_id TEXT, p_usuario_id TEXT, p_motivo TEXT, p_justificacion TEXT
) RETURNS VOID AS $$
DECLARE
  v_estado "EstadoRadicado";
  v_seq INTEGER;
BEGIN
  SELECT "estado" INTO v_estado FROM "radicado" WHERE "id" = p_radicado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El radicado % no existe', p_radicado_id; END IF;
  IF v_estado = 'ANULADO' THEN RAISE EXCEPTION 'El radicado ya esta anulado'; END IF;
  IF p_justificacion IS NULL OR length(trim(p_justificacion)) = 0 THEN
    RAISE EXCEPTION 'La anulacion requiere justificacion';
  END IF;

  INSERT INTO "anulacion" ("radicado_id", "usuario_id", "motivo", "justificacion")
    VALUES (p_radicado_id, p_usuario_id, p_motivo, p_justificacion);

  UPDATE "radicado" SET "estado" = 'ANULADO' WHERE "id" = p_radicado_id;

  SELECT COALESCE(MAX("secuencia"), 0) + 1 INTO v_seq
    FROM "evento_tramite" WHERE "radicado_id" = p_radicado_id;

  INSERT INTO "evento_tramite"
    ("radicado_id", "secuencia", "tipo_evento", "estado_anterior", "estado_nuevo", "actor_id", "observacion")
  VALUES
    (p_radicado_id, v_seq, 'ANULADO', v_estado, 'ANULADO', p_usuario_id,
     p_motivo || ' - ' || p_justificacion);
END;
$$ LANGUAGE plpgsql;
