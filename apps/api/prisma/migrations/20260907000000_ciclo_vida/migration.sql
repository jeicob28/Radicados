-- SGDEA · Fase 6 — Transferencias documentales, disposición final y MFA.

CREATE TYPE "TipoTransferencia" AS ENUM ('PRIMARIA', 'SECUNDARIA');
CREATE TYPE "EstadoTransferencia" AS ENUM ('BORRADOR', 'ENVIADA', 'RECIBIDA', 'RECHAZADA');
CREATE TYPE "EstadoAprobacion" AS ENUM ('PENDIENTE', 'APROBADA_PARCIAL', 'APROBADA', 'RECHAZADA', 'EJECUTADA');

-- ============================================================================
-- MFA
-- ============================================================================
ALTER TABLE "usuario"
  ADD COLUMN "mfa_secret"     TEXT,
  ADD COLUMN "mfa_habilitado" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- Transferencias documentales
-- ============================================================================
CREATE TABLE "transferencia" (
  "id"                   TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "numero"               TEXT NOT NULL UNIQUE,
  "tipo"                 "TipoTransferencia" NOT NULL,
  "estado"               "EstadoTransferencia" NOT NULL DEFAULT 'BORRADOR',
  "dependencia_origen_id" TEXT NOT NULL REFERENCES "dependencia"("id"),
  "fecha_elaboracion"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_envio"          TIMESTAMP(3),
  "fecha_recepcion"      TIMESTAMP(3),
  "elaborado_por_id"     TEXT REFERENCES "usuario"("id"),
  "recibido_por_id"      TEXT REFERENCES "usuario"("id"),
  "acta_object_key"      TEXT,
  "observaciones"        TEXT,
  "creado"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "transferencia_estado_idx" ON "transferencia" ("estado");

CREATE TABLE "transferencia_item" (
  "id"               TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "transferencia_id" TEXT NOT NULL REFERENCES "transferencia"("id"),
  "expediente_id"    TEXT NOT NULL REFERENCES "expediente"("id"),
  "numero_expediente" TEXT NOT NULL,
  "titulo"           TEXT NOT NULL,
  "serie"            TEXT,
  "fecha_inicio"     DATE,
  "fecha_fin"        DATE,
  "folios"           INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "transferencia_item_unico" UNIQUE ("transferencia_id", "expediente_id")
);

CREATE TRIGGER "trg_transferencia_item_no_delete"
  BEFORE DELETE ON "transferencia_item"
  FOR EACH ROW EXECUTE FUNCTION fn_prohibir_delete();

-- ============================================================================
-- Disposición final (doble aprobación)
-- ============================================================================
CREATE TABLE "disposicion_final" (
  "id"                TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "numero"            TEXT NOT NULL UNIQUE,
  "disposicion"       "DisposicionFinal" NOT NULL,
  "estado"            "EstadoAprobacion" NOT NULL DEFAULT 'PENDIENTE',
  "justificacion"     TEXT NOT NULL,
  "normativa"         TEXT,
  "solicitado_por_id" TEXT REFERENCES "usuario"("id"),
  "solicitado"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "aprobacion1_por_id" TEXT REFERENCES "usuario"("id"),
  "aprobacion1_en"    TIMESTAMP(3),
  "aprobacion2_por_id" TEXT REFERENCES "usuario"("id"),
  "aprobacion2_en"    TIMESTAMP(3),
  "ejecutado_en"      TIMESTAMP(3),
  "acta_object_key"   TEXT,
  "creado"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "disposicion_final_item" (
  "id"                 TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "disposicion_id"     TEXT NOT NULL REFERENCES "disposicion_final"("id"),
  "expediente_id"      TEXT NOT NULL REFERENCES "expediente"("id"),
  "numero_expediente"  TEXT NOT NULL,
  "titulo"             TEXT NOT NULL,
  CONSTRAINT "disposicion_final_item_unico" UNIQUE ("disposicion_id", "expediente_id")
);

CREATE TRIGGER "trg_disposicion_item_no_delete"
  BEFORE DELETE ON "disposicion_final_item"
  FOR EACH ROW EXECUTE FUNCTION fn_prohibir_delete();
CREATE TRIGGER "trg_disposicion_no_delete"
  BEFORE DELETE ON "disposicion_final"
  FOR EACH ROW EXECUTE FUNCTION fn_prohibir_delete();
