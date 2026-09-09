import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';

// El servicio `backup` (compose.prod.yml) monta ./backups en /backups y procesa
// aquí una cola de trabajos. Esta API deja la petición en .control/queue y lee
// el resultado de .control/estado.json — nunca ejecuta pg_dump/pg_restore ella
// misma ni usa el socket de Docker.
const DEST = process.env.BACKUP_DEST ?? '/backups';
const CTL = path.join(DEST, '.control');
const QUEUE = path.join(CTL, 'queue');
const JOBS = path.join(CTL, 'jobs');
const ESTADO = path.join(CTL, 'estado.json');

const RE_CARPETA = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const RE_ARCHIVO = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,80}$/;
const PARAM_MANTENIMIENTO = 'sistema.mantenimiento';
const HEARTBEAT_MAX_MS = 45_000;

type Alcance = 'db' | 'objetos' | 'todo';

interface JobEstado {
  id: string;
  tipo: 'backup' | 'restore';
  estado: 'EN_CURSO' | 'OK' | 'ERROR';
  alcance?: Alcance;
  carpeta?: string;
  solicitante?: string;
  inicio?: string;
  fin?: string;
  resumen?: string;
}
interface EstadoServicio {
  heartbeat?: string;
  job?: JobEstado | null;
  historial?: JobEstado[];
}
interface Mantenimiento {
  activo: boolean;
  motivo?: string;
  desde?: string;
}
interface CopiaInfo {
  carpeta: string;
  creado: string;
  bytes: number;
  cifrada: boolean;
  completa: boolean;
  archivos: string[];
  manifest: unknown;
}

class RestaurarDto {
  @IsIn(['db', 'objetos', 'todo'])
  alcance!: Alcance;

  @IsString()
  @IsIn(['RESTAURAR'], { message: 'Escriba RESTAURAR para confirmar' })
  confirmacion!: string;

  @IsOptional() @IsString() passphrase?: string;
}

class MantenimientoDto {
  @IsBoolean() activo!: boolean;
  @IsOptional() @IsString() motivo?: string;
}

@Injectable()
export class CopiasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  // ── utilidades de ruta ────────────────────────────────────────────────────
  private async carpetaValida(nombre: string): Promise<string> {
    if (!RE_CARPETA.test(nombre) || nombre.includes('..')) {
      throw new BadRequestException('Nombre de copia inválido');
    }
    const full = path.resolve(DEST, nombre);
    if (path.dirname(full) !== path.resolve(DEST)) {
      throw new BadRequestException('Ruta de copia inválida');
    }
    const st = await fs.stat(full).catch(() => null);
    if (!st?.isDirectory()) throw new NotFoundException('La copia no existe');
    return full;
  }

  private archivoValido(carpetaFull: string, archivo: string): string {
    if (!RE_ARCHIVO.test(archivo) || archivo.includes('..')) {
      throw new BadRequestException('Nombre de archivo inválido');
    }
    const full = path.resolve(carpetaFull, archivo);
    if (path.dirname(full) !== carpetaFull) {
      throw new BadRequestException('Ruta de archivo inválida');
    }
    return full;
  }

  // ── estado del servicio ───────────────────────────────────────────────────
  private async leerEstado(): Promise<EstadoServicio | null> {
    try {
      return JSON.parse(await fs.readFile(ESTADO, 'utf8')) as EstadoServicio;
    } catch {
      return null;
    }
  }

  private servicioActivo(estado: EstadoServicio | null): boolean {
    if (!estado?.heartbeat) return false;
    return Date.now() - new Date(estado.heartbeat).getTime() < HEARTBEAT_MAX_MS;
  }

  async mantenimiento(): Promise<Mantenimiento> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: PARAM_MANTENIMIENTO } });
    const v = (p?.valor ?? {}) as Partial<Mantenimiento>;
    return { activo: !!v.activo, motivo: v.motivo, desde: v.desde };
  }

  async setMantenimiento(activo: boolean, motivo: string | undefined, ctx: AuditCtx) {
    const antes = await this.mantenimiento();
    const valor: Mantenimiento = { activo, motivo, desde: activo ? new Date().toISOString() : undefined };
    await this.prisma.parametro.upsert({
      where: { clave: PARAM_MANTENIMIENTO },
      update: { valor: valor as never, descripcion: 'Modo mantenimiento: bloquea a los usuarios no ADMIN' },
      create: { clave: PARAM_MANTENIMIENTO, valor: valor as never, descripcion: 'Modo mantenimiento: bloquea a los usuarios no ADMIN' },
    });
    await this.bitacora.registrar({
      ctx,
      entidad: 'sistema',
      entidadId: PARAM_MANTENIMIENTO,
      accion: 'CAMBIAR_ESTADO',
      antes,
      despues: valor,
      observacion: activo ? `Mantenimiento activado: ${motivo ?? ''}` : 'Mantenimiento desactivado',
    });
    return valor;
  }

  private configServicio() {
    return {
      cron: process.env.BACKUP_CRON ?? '0 2 * * *',
      retencionDias: Number(process.env.BACKUP_RETENTION_DAYS ?? 14),
      minLibreMb: Number(process.env.BACKUP_MIN_FREE_MB ?? 1500),
      cifradoConfigurado: !!process.env.BACKUP_ENC_PASSPHRASE,
      offsiteConfigurado: !!process.env.BACKUP_OFFSITE_CMD,
    };
  }

  private async discoLibreMb(): Promise<number | null> {
    try {
      const s = await fs.statfs(DEST);
      return Math.round((Number(s.bavail) * Number(s.bsize)) / (1024 * 1024));
    } catch {
      return null;
    }
  }

  // ── listado de copias ─────────────────────────────────────────────────────
  async listar() {
    await fs.mkdir(DEST, { recursive: true });
    const entradas = await fs.readdir(DEST, { withFileTypes: true });
    const copias: CopiaInfo[] = [];
    for (const d of entradas) {
      if (!d.isDirectory() || d.name.startsWith('.')) continue;
      const full = path.join(DEST, d.name);
      let archivos: string[] = [];
      try {
        archivos = await fs.readdir(full);
      } catch {
        continue;
      }
      let manifest: unknown = null;
      try {
        manifest = JSON.parse(await fs.readFile(path.join(full, 'manifest.json'), 'utf8'));
      } catch {
        /* copia sin manifiesto (parcial o importada) */
      }
      let bytes = 0;
      for (const a of archivos) {
        const st = await fs.stat(path.join(full, a)).catch(() => null);
        if (st?.isFile()) bytes += st.size;
      }
      const st = await fs.stat(full);
      copias.push({
        carpeta: d.name,
        creado: (manifest as { creado?: string } | null)?.creado ?? st.mtime.toISOString(),
        bytes,
        cifrada: archivos.some((a) => a.endsWith('.enc')),
        completa: archivos.some((a) => a === 'db.dump' || a === 'db.dump.enc'),
        archivos,
        manifest,
      });
    }
    copias.sort((a, b) => (a.creado < b.creado ? 1 : -1));
    return copias;
  }

  async estadoGeneral() {
    const estado = await this.leerEstado();
    let mant = await this.mantenimiento();

    // Auto-salida de mantenimiento: si el trabajo de restauración terminó y el
    // mantenimiento sigue activo desde antes de ese fin, se libera solo.
    const job = estado?.job ?? null;
    if (
      mant.activo &&
      job?.tipo === 'restore' &&
      (job.estado === 'OK' || job.estado === 'ERROR') &&
      job.fin &&
      mant.desde &&
      job.fin > mant.desde
    ) {
      await this.setMantenimiento(false, undefined, {});
      mant = { activo: false };
    }

    return {
      servicioActivo: this.servicioActivo(estado),
      heartbeat: estado?.heartbeat ?? null,
      job,
      historial: estado?.historial ?? [],
      mantenimiento: mant,
      discoLibreMb: await this.discoLibreMb(),
      config: this.configServicio(),
    };
  }

  // ── cola de trabajos ──────────────────────────────────────────────────────
  private async encolar(job: Record<string, unknown>): Promise<{ id: string }> {
    await fs.mkdir(QUEUE, { recursive: true });
    const estado = await this.leerEstado();
    if (!this.servicioActivo(estado)) {
      throw new BadRequestException(
        'El servicio de copias no está activo (solo corre con el overlay de producción). Inténtelo desde el servidor.',
      );
    }
    if (estado?.job?.estado === 'EN_CURSO') {
      throw new BadRequestException('Ya hay una operación de copia/restauración en curso');
    }
    const pendientes = await fs.readdir(QUEUE).catch(() => [] as string[]);
    if (pendientes.length) throw new BadRequestException('Ya hay una operación encolada');

    const id =
      new Date().toISOString().replace(/[:.]/g, '').replace('T', '-').slice(0, 15) +
      '-' +
      Math.random().toString(36).slice(2, 8);
    const tmp = path.join(QUEUE, `.${id}.tmp`);
    const fin = path.join(QUEUE, `${id}.json`);
    await fs.writeFile(tmp, JSON.stringify({ id, ...job }));
    await fs.rename(tmp, fin); // atómico: el watcher nunca ve un JSON a medias
    return { id };
  }

  async ejecutarBackup(ctx: AuditCtx) {
    const r = await this.encolar({ tipo: 'backup', solicitante: ctx.usuario?.nombre ?? null });
    await this.bitacora.registrar({
      ctx,
      entidad: 'copia',
      entidadId: r.id,
      accion: 'CREAR',
      observacion: 'Copia de seguridad manual solicitada desde el panel',
    });
    return r;
  }

  async restaurar(carpeta: string, dto: RestaurarDto, ctx: AuditCtx) {
    await this.carpetaValida(carpeta);
    await this.setMantenimiento(true, `Restauración de la copia ${carpeta}`, ctx);
    try {
      const r = await this.encolar({
        tipo: 'restore',
        carpeta,
        alcance: dto.alcance,
        passphrase: dto.passphrase ?? null,
        solicitante: ctx.usuario?.nombre ?? null,
      });
      await this.bitacora.registrar({
        ctx,
        entidad: 'copia',
        entidadId: carpeta,
        accion: 'RESTAURAR',
        observacion: `Restauración solicitada (${dto.alcance}) — el sistema queda en mantenimiento hasta terminar`,
      });
      return r;
    } catch (e) {
      await this.setMantenimiento(false, undefined, ctx);
      throw e;
    }
  }

  // ── descarga / exportación ────────────────────────────────────────────────
  async streamArchivo(carpeta: string, archivo: string, res: Response, ctx: AuditCtx) {
    const full = await this.carpetaValida(carpeta);
    const ruta = this.archivoValido(full, archivo);
    const st = await fs.stat(ruta).catch(() => null);
    if (!st?.isFile()) throw new NotFoundException('El archivo no existe en la copia');
    await this.bitacora.registrar({
      ctx,
      entidad: 'copia',
      entidadId: `${carpeta}/${archivo}`,
      accion: 'DESCARGAR',
    });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(st.size));
    res.setHeader('Content-Disposition', `attachment; filename="${carpeta}-${archivo}"`);
    createReadStream(ruta).pipe(res);
  }

  async streamPaquete(carpeta: string, res: Response, ctx: AuditCtx) {
    await this.carpetaValida(carpeta);
    await this.bitacora.registrar({
      ctx,
      entidad: 'copia',
      entidadId: carpeta,
      accion: 'EXPORTAR',
      observacion: 'Descarga del paquete completo de la copia',
    });
    res.setHeader('Content-Type', 'application/x-tar');
    res.setHeader('Content-Disposition', `attachment; filename="sgdea-${carpeta}.tar"`);
    const tar = spawn('tar', ['-cf', '-', '-C', DEST, carpeta], { stdio: ['ignore', 'pipe', 'ignore'] });
    tar.stdout.pipe(res);
    tar.on('error', () => res.destroy());
    res.on('close', () => tar.kill());
  }

  // ── importación de una copia externa ──────────────────────────────────────
  async importar(file: Express.Multer.File, ctx: AuditCtx) {
    if (!file?.path) throw new BadRequestException('No se recibió ningún archivo');
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'imp-'));
    try {
      await this.ejecutar('tar', ['-xf', file.path, '-C', tmp]);
      // buscar la carpeta que contiene db.dump (o db.dump.enc), hasta 2 niveles
      const origen = await this.buscarRaizCopia(tmp);
      if (!origen) throw new BadRequestException('El archivo no contiene una copia válida (falta db.dump)');
      const nombre =
        'importada-' + new Date().toISOString().replace(/[:.]/g, '').replace('T', '-').slice(0, 15);
      const destino = path.join(DEST, nombre);
      await fs.cp(origen, destino, { recursive: true });
      await this.bitacora.registrar({
        ctx,
        entidad: 'copia',
        entidadId: nombre,
        accion: 'CREAR',
        observacion: `Copia importada desde archivo (${file.originalname})`,
      });
      return { carpeta: nombre };
    } finally {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
      await fs.rm(file.path, { force: true }).catch(() => undefined);
    }
  }

  private async buscarRaizCopia(dir: string, nivel = 0): Promise<string | null> {
    const entradas = await fs.readdir(dir, { withFileTypes: true });
    if (entradas.some((e) => e.isFile() && (e.name === 'db.dump' || e.name === 'db.dump.enc'))) {
      return dir;
    }
    if (nivel >= 2) return null;
    for (const e of entradas) {
      if (e.isDirectory()) {
        const r = await this.buscarRaizCopia(path.join(dir, e.name), nivel + 1);
        if (r) return r;
      }
    }
    return null;
  }

  private ejecutar(cmd: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', (d) => (err += d));
      p.on('error', reject);
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err || `${cmd} salió con código ${code}`))));
    });
  }

  async eliminar(carpeta: string, ctx: AuditCtx) {
    const full = await this.carpetaValida(carpeta);
    const estado = await this.leerEstado();
    if (estado?.job?.estado === 'EN_CURSO') {
      throw new BadRequestException('No se puede borrar mientras hay una operación en curso');
    }
    await fs.rm(full, { recursive: true, force: true });
    await this.bitacora.registrar({
      ctx,
      entidad: 'copia',
      entidadId: carpeta,
      accion: 'ANULAR',
      observacion: 'Copia de seguridad eliminada desde el panel',
    });
    return { ok: true };
  }

  async logJob(id: string): Promise<string> {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new BadRequestException('id inválido');
    try {
      return await fs.readFile(path.join(JOBS, `${id}.log`), 'utf8');
    } catch {
      return '';
    }
  }
}

@ApiTags('copias de seguridad')
@ApiBearerAuth()
@Controller('copias')
@Roles(ROLES.DEV)
export class CopiasController {
  constructor(private readonly copias: CopiasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las copias de seguridad disponibles en el servidor' })
  async listar() {
    return { copias: await this.copias.listar(), ...(await this.copias.estadoGeneral()) };
  }

  @Get('estado')
  @ApiOperation({ summary: 'Estado del servicio de copias y del trabajo en curso' })
  estado() {
    return this.copias.estadoGeneral();
  }

  @Get('trabajos/:id/log')
  @ApiOperation({ summary: 'Registro (log) de un trabajo de copia/restauración' })
  async log(@Param('id') id: string) {
    return { log: await this.copias.logJob(id) };
  }

  @Post('ejecutar')
  @ApiOperation({ summary: 'Lanza una copia de seguridad ahora' })
  ejecutar(@Auditoria() ctx: AuditCtx) {
    return this.copias.ejecutarBackup(ctx);
  }

  @Post('mantenimiento')
  @ApiOperation({ summary: 'Activa o desactiva el modo mantenimiento' })
  mantenimiento(@Body() dto: MantenimientoDto, @Auditoria() ctx: AuditCtx) {
    return this.copias.setMantenimiento(dto.activo, dto.motivo, ctx);
  }

  @Post('importar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Sube (importa) un paquete .tar de una copia al servidor' })
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_r, f, cb) => cb(null, `sgdea-import-${Date.now()}-${f.originalname.replace(/[^\w.-]/g, '_')}`),
      }),
      limits: { fileSize: 2 * 1024 * 1024 * 1024 },
    }),
  )
  importar(@UploadedFile() archivo: Express.Multer.File, @Auditoria() ctx: AuditCtx) {
    return this.copias.importar(archivo, ctx);
  }

  @Get(':carpeta/descargar')
  @ApiOperation({ summary: 'Descarga un artefacto de la copia (db.dump, objetos.tar.gz, …)' })
  descargar(
    @Param('carpeta') carpeta: string,
    @Query('archivo') archivo: string,
    @Res() res: Response,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.copias.streamArchivo(carpeta, archivo ?? '', res, ctx);
  }

  @Get(':carpeta/paquete')
  @ApiOperation({ summary: 'Descarga toda la copia como un solo archivo .tar' })
  paquete(@Param('carpeta') carpeta: string, @Res() res: Response, @Auditoria() ctx: AuditCtx) {
    return this.copias.streamPaquete(carpeta, res, ctx);
  }

  @Post(':carpeta/restaurar')
  @ApiOperation({ summary: 'Restaura la copia indicada (deja el sistema en mantenimiento)' })
  restaurar(
    @Param('carpeta') carpeta: string,
    @Body() dto: RestaurarDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.copias.restaurar(carpeta, dto, ctx);
  }

  @Delete(':carpeta')
  @ApiOperation({ summary: 'Elimina una copia de seguridad del servidor' })
  eliminar(@Param('carpeta') carpeta: string, @Auditoria() ctx: AuditCtx) {
    return this.copias.eliminar(carpeta, ctx);
  }
}

@Module({
  controllers: [CopiasController],
  providers: [CopiasService],
})
export class CopiasModule {}
