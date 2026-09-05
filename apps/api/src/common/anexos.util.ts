import type { Prisma } from '@prisma/client';
import type { AdjuntoRefDto } from '../radicacion/dto';

/**
 * Adjunta como anexos del radicado los archivos ya subidos (vía
 * `/radicados/adjuntos-tramite`, que devuelve estos descriptores). Se usa
 * desde cualquier acción de trámite: responder, cerrar, devolver,
 * trasladar, asignar, reasignar, reabrir, aceptar, clasificar, anular —
 * en todas se pueden acompañar evidencias/soportes.
 */
export async function adjuntarComoAnexos(
  tx: Prisma.TransactionClient,
  radicadoId: string,
  adjuntos: AdjuntoRefDto[] | undefined,
  descripcion: string,
): Promise<void> {
  if (!adjuntos?.length) return;
  await tx.anexo.createMany({
    data: adjuntos.map((a) => ({
      radicadoId,
      nombre: a.nombre,
      descripcion: a.descripcion ?? descripcion,
      objectKey: a.objectKey,
      contentType: a.contentType ?? null,
      tamanoBytes: a.tamanoBytes ?? null,
      checksumSha256: a.checksumSha256 ?? null,
      paginas: a.paginas ?? null,
    })),
  });
}
