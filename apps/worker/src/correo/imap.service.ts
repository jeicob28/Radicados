import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

/**
 * Captura del buzón institucional por IMAP. Cada mensaje nuevo se envía a la API
 * (`POST /correo/capturar`) para que quede en el buzón de radicación pendiente.
 * Se activa sólo si IMAP_HOST está configurado.
 */
@Injectable()
export class ImapService {
  private readonly logger = new Logger(ImapService.name);
  private corriendo = false;

  private get configurado() {
    return Boolean(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async revisar() {
    if (!this.configurado) {
      this.logger.debug('IMAP no configurado; se omite la revisión del buzón');
      return;
    }
    if (this.corriendo) return;
    this.corriendo = true;

    const client = new ImapFlow({
      host: process.env.IMAP_HOST!,
      port: Number(process.env.IMAP_PORT ?? 993),
      secure: (process.env.IMAP_SECURE ?? 'true') === 'true',
      auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASSWORD! },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const noLeidos = (await client.search({ seen: false })) || [];
        this.logger.log(`${noLeidos.length} mensaje(s) sin leer en el buzón`);

        for (const uid of noLeidos) {
          const { content } = await client.download(String(uid));
          const parsed = await simpleParser(content);
          const messageId = parsed.messageId ?? `imap-${uid}-${Date.now()}`;

          const adjuntos = (parsed.attachments ?? []).map((a) => ({
            nombre: a.filename ?? 'adjunto',
            tamanoBytes: a.size,
            contentType: a.contentType,
          }));

          const payload = {
            messageId,
            de: parsed.from?.value?.[0]?.address ?? 'desconocido@correo',
            para: (parsed.to && !Array.isArray(parsed.to) ? parsed.to.value : []).map((v) => v.address ?? ''),
            asunto: parsed.subject ?? '(sin asunto)',
            cuerpoTexto: parsed.text ?? null,
            cuerpoHtml: typeof parsed.html === 'string' ? parsed.html : null,
            fecha: (parsed.date ?? new Date()).toISOString(),
            adjuntos,
          };

          const res = await fetch(
            `${process.env.API_INTERNAL_URL ?? 'http://api:3000/api/v1'}/correo/capturar`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Token': process.env.INTERNAL_TOKEN ?? '',
              },
              body: JSON.stringify(payload),
            },
          );
          if (res.ok) {
            await client.messageFlagsAdd(String(uid), ['\\Seen']);
            this.logger.log(`Correo capturado: ${payload.asunto}`);
          } else {
            this.logger.error(`API rechazó el correo (${res.status})`);
          }
        }
      } finally {
        lock.release();
      }
    } catch (e) {
      this.logger.error(`Revisión IMAP falló: ${(e as Error).message}`);
    } finally {
      await client.logout().catch(() => undefined);
      this.corriendo = false;
    }
  }
}
