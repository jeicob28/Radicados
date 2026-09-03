-- SGDEA · Fase 5 — Integración de correo electrónico institucional.

CREATE TYPE "EstadoCorreo" AS ENUM ('PENDIENTE', 'RADICADO', 'DESCARTADO');

CREATE TABLE "comunicacion_correo" (
  "id"                   TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "message_id"           TEXT NOT NULL,
  "de"                   TEXT NOT NULL,
  "para"                 TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "cc"                   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "asunto"               TEXT NOT NULL,
  "cuerpo_texto"         TEXT,
  "cuerpo_html"          TEXT,
  "fecha"                TIMESTAMP(3) NOT NULL,
  "object_key_original"  TEXT,
  "adjuntos"             JSONB NOT NULL DEFAULT '[]'::jsonb,
  "estado"               "EstadoCorreo" NOT NULL DEFAULT 'PENDIENTE',
  "radicado_numero"      TEXT,
  "motivo_descarte"      TEXT,
  "procesado_por_id"     TEXT REFERENCES "usuario"("id"),
  "procesado"            TIMESTAMP(3),
  "creado"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comunicacion_correo_message_id_key" UNIQUE ("message_id")
);
CREATE INDEX "comunicacion_correo_estado_idx" ON "comunicacion_correo" ("estado");
