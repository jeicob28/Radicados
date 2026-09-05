-- Estado nuevo: el funcionario ya respondió el radicado y marcó que la
-- respuesta debe salir como comunicado oficial de Ventanilla Única. El
-- radicado queda a la espera de que Ventanilla emita ese comunicado; al
-- hacerlo pasa a CERRADO. Ver Requerimientos §21.2.
ALTER TYPE "EstadoRadicado" ADD VALUE IF NOT EXISTS 'POR_COMUNICAR';
