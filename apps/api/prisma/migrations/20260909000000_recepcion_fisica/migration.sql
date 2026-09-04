-- Recepción física del radicado: fecha real de llegada del documento (puede
-- diferir de la fecha/hora de radicación cuando hay rezago al digitar) y
-- nombre de quien lo entrega físicamente (mensajero, no siempre es el
-- tercero/remitente). Columnas nulas, se fijan solo al crear el radicado —
-- no quedan cubiertas por fn_radicado_inmutable (no son de identidad), pero
-- tampoco hay ningún UPDATE de radicado que las toque, así que en la
-- práctica también son append-only.
ALTER TABLE "radicado" ADD COLUMN "fecha_recepcion" TIMESTAMP(3);
ALTER TABLE "radicado" ADD COLUMN "entregado_por" TEXT;
