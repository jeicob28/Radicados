-- SGDEA · Fase 4 — Cuadro de clasificación (series/subseries), TRD, expedientes y foliado.

CREATE TYPE "DisposicionFinal" AS ENUM (
  'CONSERVACION_TOTAL', 'ELIMINACION', 'SELECCION', 'MICROFILMACION_DIGITALIZACION'
);

CREATE TYPE "EstadoExpediente" AS ENUM (
  'ABIERTO', 'CERRADO', 'TRANSFERIDO_CENTRAL', 'TRANSFERIDO_HISTORICO', 'ELIMINADO', 'CONSERVADO'
);

CREATE TYPE "TipoItemExpediente" AS ENUM ('RADICADO', 'ANEXO', 'DOCUMENTO_SIMPLE');

-- Secuencia genérica (expedientes, contingencia, etc.)
CREATE TABLE "secuencia" (
  "clave"  TEXT PRIMARY KEY,
  "ultimo" INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION fn_siguiente_secuencia(p_clave TEXT) RETURNS INTEGER AS $$
DECLARE v INTEGER;
BEGIN
  INSERT INTO "secuencia" ("clave", "ultimo") VALUES (p_clave, 1)
  ON CONFLICT ("clave") DO UPDATE SET "ultimo" = "secuencia"."ultimo" + 1
  RETURNING "ultimo" INTO v;
  RETURN v;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Cuadro de clasificación documental + TRD
-- ============================================================================
CREATE TABLE "serie" (
  "id"                        TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "codigo"                    TEXT NOT NULL,
  "nombre"                    TEXT NOT NULL,
  "dependencia_id"            TEXT NOT NULL,
  "retencion_archivo_gestion" INTEGER NOT NULL DEFAULT 0,
  "retencion_archivo_central" INTEGER NOT NULL DEFAULT 0,
  "disposicion_final"         "DisposicionFinal" NOT NULL DEFAULT 'CONSERVACION_TOTAL',
  "procedimiento"             TEXT,
  "activa"                    BOOLEAN NOT NULL DEFAULT true,
  "creado"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "serie_dependencia_codigo_key" UNIQUE ("dependencia_id", "codigo"),
  CONSTRAINT "serie_dependencia_fk" FOREIGN KEY ("dependencia_id") REFERENCES "dependencia"("id")
);

CREATE TABLE "subserie" (
  "id"                        TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "codigo"                    TEXT NOT NULL,
  "nombre"                    TEXT NOT NULL,
  "serie_id"                  TEXT NOT NULL,
  "retencion_archivo_gestion" INTEGER,
  "retencion_archivo_central" INTEGER,
  "disposicion_final"         "DisposicionFinal",
  "activa"                    BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "subserie_serie_codigo_key" UNIQUE ("serie_id", "codigo"),
  CONSTRAINT "subserie_serie_fk" FOREIGN KEY ("serie_id") REFERENCES "serie"("id")
);

CREATE TABLE "tipo_documental" (
  "id"          TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "codigo"      TEXT NOT NULL UNIQUE,
  "nombre"      TEXT NOT NULL,
  "serie_id"    TEXT REFERENCES "serie"("id"),
  "subserie_id" TEXT REFERENCES "subserie"("id")
);

-- ============================================================================
-- Expedientes
-- ============================================================================
CREATE TABLE "expediente" (
  "id"                          TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "numero"                      TEXT NOT NULL UNIQUE,
  "titulo"                      TEXT NOT NULL,
  "serie_id"                    TEXT NOT NULL REFERENCES "serie"("id"),
  "subserie_id"                 TEXT REFERENCES "subserie"("id"),
  "dependencia_id"              TEXT NOT NULL REFERENCES "dependencia"("id"),
  "estado"                      "EstadoExpediente" NOT NULL DEFAULT 'ABIERTO',
  "fecha_apertura"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_cierre"                TIMESTAMP(3),
  "fecha_inicio_extrema"        DATE,
  "fecha_fin_extrema"           DATE,
  "fecha_limite_archivo_gestion" DATE,
  "fecha_limite_archivo_central" DATE,
  "disposicion_final"           "DisposicionFinal",
  "total_folios"                INTEGER NOT NULL DEFAULT 0,
  "ubicacion_fisica"            TEXT,
  "creado_por_id"               TEXT REFERENCES "usuario"("id"),
  "creado"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expediente_serie_fk_dep" CHECK (true)
);
CREATE INDEX "expediente_serie_idx" ON "expediente" ("serie_id");
CREATE INDEX "expediente_dependencia_idx" ON "expediente" ("dependencia_id");
CREATE INDEX "expediente_estado_idx" ON "expediente" ("estado");

CREATE TABLE "documento_expediente" (
  "id"              TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "expediente_id"   TEXT NOT NULL REFERENCES "expediente"("id"),
  "orden"           INTEGER NOT NULL,
  "tipo"            "TipoItemExpediente" NOT NULL,
  "titulo"          TEXT NOT NULL,
  "fecha"           TIMESTAMP(3),
  "folio_inicio"    INTEGER,
  "folio_fin"       INTEGER,
  "radicado_id"     TEXT REFERENCES "radicado"("id"),
  "anexo_id"        TEXT REFERENCES "anexo"("id"),
  "object_key"      TEXT,
  "content_type"    TEXT,
  "tamano_bytes"    INTEGER,
  "checksum_sha256" TEXT,
  "incorporado_por_id" TEXT REFERENCES "usuario"("id"),
  "incorporado"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documento_expediente_orden_key" UNIQUE ("expediente_id", "orden")
);
CREATE INDEX "documento_expediente_exp_idx" ON "documento_expediente" ("expediente_id");

-- documento_expediente es append-only en cuanto a evidencia (se puede refoliar)
CREATE TRIGGER "trg_docexp_no_delete"
  BEFORE DELETE ON "documento_expediente"
  FOR EACH ROW EXECUTE FUNCTION fn_prohibir_delete();

-- ============================================================================
-- Clasificación archivística del radicado
-- ============================================================================
ALTER TABLE "radicado"
  ADD COLUMN "serie_id"      TEXT REFERENCES "serie"("id"),
  ADD COLUMN "subserie_id"   TEXT REFERENCES "subserie"("id"),
  ADD COLUMN "expediente_id" TEXT REFERENCES "expediente"("id");

CREATE INDEX "radicado_expediente_idx" ON "radicado" ("expediente_id");
