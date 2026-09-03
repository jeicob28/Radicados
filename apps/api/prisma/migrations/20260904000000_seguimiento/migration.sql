-- SGDEA · Fase 3 — Distribución, seguimiento, semáforo de cumplimiento y notificaciones.

CREATE TYPE "NivelAlerta" AS ENUM ('NA', 'VERDE', 'AMARILLO', 'ROJO', 'VENCIDO');

ALTER TABLE "radicado"
  ADD COLUMN "fecha_asignacion"        TIMESTAMP(3),
  ADD COLUMN "fecha_primera_respuesta" TIMESTAMP(3),
  ADD COLUMN "fecha_cierre"            TIMESTAMP(3),
  ADD COLUMN "nivel_alerta"            "NivelAlerta" NOT NULL DEFAULT 'NA',
  ADD COLUMN "dias_habiles_restantes"  INTEGER;

CREATE INDEX "radicado_nivel_alerta_idx" ON "radicado" ("nivel_alerta");
CREATE INDEX "radicado_funcionario_idx"  ON "radicado" ("funcionario_id");

CREATE TABLE "notificacion" (
  "id"              TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "usuario_id"      TEXT NOT NULL,
  "tipo"            TEXT NOT NULL,
  "titulo"          TEXT NOT NULL,
  "cuerpo"          TEXT,
  "radicado_numero" TEXT,
  "leida_en"        TIMESTAMP(3),
  "creado"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notificacion_usuario_fk" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
);
CREATE INDEX "notificacion_usuario_idx" ON "notificacion" ("usuario_id", "leida_en");

-- Evita notificar dos veces el mismo hito de un radicado a un mismo usuario.
CREATE UNIQUE INDEX "notificacion_dedupe_idx"
  ON "notificacion" ("usuario_id", "tipo", "radicado_numero")
  WHERE "radicado_numero" IS NOT NULL;
