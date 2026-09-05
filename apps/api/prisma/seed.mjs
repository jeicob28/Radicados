// Seed (F0 + F1): parámetros de negocio, festivos 2026, catálogo de roles,
// organigrama mínimo, usuario administrador con contraseña y consecutivos 2026.
// Ejecutar:  docker compose exec api npm run seed
import { PrismaClient } from '@prisma/client';
import { hash as argon2Hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

// Rol del sistema (no editable en permisos) — coincide con CATALOGO_ROLES de la API.
const CATALOGO_ROLES = [
  ['ADMIN', 'Administrador', 'Configuración del sistema, usuarios, roles y parámetros.', ['*']],
  ['RADICADOR', 'Coordinador de correspondencia', 'Configura el consecutivo y el rango de contingencia; anula radicados con justificación.', ['radicado:anular', 'consecutivo:configurar']],
  ['VENTANILLA', 'Ventanilla única', 'Recepción, digitalización y registro de terceros; único rol que radica (entrada y salida) — centraliza la radicación de toda la empresa.', ['recepcion:crear', 'radicado:crear', 'tercero:crear']],
  ['FUNCIONARIO', 'Funcionario', 'Tramita los radicados de su dependencia y prepara las respuestas; Ventanilla es quien las radica y despacha.', ['radicado:tramitar', 'radicado:responder']],
  ['JEFE', 'Jefe de dependencia', 'Asigna y reasigna trámites, aprueba respuestas, ve indicadores del área.', ['radicado:asignar', 'radicado:aprobar', 'indicador:leer']],
  ['ARCHIVISTA', 'Archivista', 'Series, subseries, TRD, expedientes, transferencias y disposición final.', ['trd:gestionar', 'expediente:gestionar']],
  ['AUDITOR', 'Auditor', 'Lectura total de la bitácora y la trazabilidad; verificación de la cadena.', ['bitacora:leer', 'bitacora:verificar']],
];

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin2026*Cambiar';

// Festivos de Colombia 2026 (Ley 51 de 1983 / Ley Emiliani).
// Verificar contra el calendario oficial antes de producción.
const FESTIVOS_2026 = [
  ['2026-01-01', 'Año Nuevo'],
  ['2026-01-12', 'Día de los Reyes Magos'],
  ['2026-03-23', 'Día de San José'],
  ['2026-04-02', 'Jueves Santo'],
  ['2026-04-03', 'Viernes Santo'],
  ['2026-05-01', 'Día del Trabajo'],
  ['2026-05-18', 'Ascensión del Señor'],
  ['2026-06-08', 'Corpus Christi'],
  ['2026-06-15', 'Sagrado Corazón de Jesús'],
  ['2026-06-29', 'San Pedro y San Pablo'],
  ['2026-07-20', 'Día de la Independencia'],
  ['2026-08-07', 'Batalla de Boyacá'],
  ['2026-08-17', 'Asunción de la Virgen'],
  ['2026-10-12', 'Día de la Raza'],
  ['2026-11-02', 'Día de Todos los Santos'],
  ['2026-11-16', 'Independencia de Cartagena'],
  ['2026-12-08', 'Inmaculada Concepción'],
  ['2026-12-25', 'Navidad'],
];

const PARAMETROS = [
  ['jornada.dias_habiles', [1, 2, 3, 4, 5], 'Días hábiles de la semana (1=Lunes ... 7=Domingo)'],
  ['consecutivo.modo', 'DIFERENCIADO', 'DIFERENCIADO (ENT/SAL) o UNICO institucional'],
  ['consecutivo.vigencia_actual', 2026, 'Vigencia sobre la que radica el sistema'],
  [
    'plazos.dias_habiles',
    {
      GENERAL: 15, DERECHO_PETICION: 15, PETICION_INFORMACION: 10,
      PETICION_DOCUMENTOS: 10, CONSULTA: 30, QUEJA: 15, RECLAMO: 15,
      SOLICITUD: 15, FELICITACION: 0, SUGERENCIA: 0, OTRO: 15,
    },
    'Términos por tipo de comunicación en días hábiles. Verificar con Jurídica.',
  ],
  ['alertas.dias_habiles', { amarillo: 5, rojo: 2 }, 'Umbral de días hábiles restantes para el semáforo'],
  [
    'seguridad.password_policy',
    {
      minLength: 10, requireUpper: true, requireLower: true, requireNumber: true,
      requireSpecial: false, caducidadDias: null,
    },
    'Política de contraseñas. caducidadDias=null desactiva la caducidad.',
  ],
];

const DEPENDENCIAS = [
  ['GEN', 'Dirección General', null],
  ['ADM', 'Administración', 'GEN'],
  ['JUR', 'Oficina Jurídica', 'GEN'],
  ['ARC', 'Gestión Documental y Archivo', 'ADM'],
  ['VUC', 'Ventanilla Única de Correspondencia', 'ADM'],
];

const CONSECUTIVOS_2026 = [
  { tipo: 'ENT', formato: '{vigencia}-ENT-{numero:06}', desde: 900001, hasta: 900500 },
  { tipo: 'SAL', formato: '{vigencia}-SAL-{numero:06}', desde: 900001, hasta: 900500 },
  { tipo: 'UNICO', formato: '{vigencia}-{numero:06}', desde: 990001, hasta: 990500 },
];

async function main() {
  for (const [clave, valor, descripcion] of PARAMETROS) {
    await prisma.parametro.upsert({
      where: { clave },
      update: { valor, descripcion },
      create: { clave, valor, descripcion },
    });
  }

  for (const [fecha, descripcion] of FESTIVOS_2026) {
    await prisma.festivo.upsert({
      where: { fecha: new Date(fecha) },
      update: { descripcion },
      create: { fecha: new Date(fecha), descripcion },
    });
  }

  for (const [codigo, nombre, parentCodigo] of DEPENDENCIAS) {
    const parent = parentCodigo
      ? await prisma.dependencia.findUnique({ where: { codigo: parentCodigo } })
      : null;
    await prisma.dependencia.upsert({
      where: { codigo },
      update: { nombre, parentId: parent?.id ?? null },
      create: { codigo, nombre, parentId: parent?.id ?? null },
    });
  }

  for (const [codigo, nombre, descripcion, permisos] of CATALOGO_ROLES) {
    await prisma.rol.upsert({
      where: { codigo },
      update: { nombre, descripcion, permisos, sistema: true },
      create: { codigo, nombre, descripcion, permisos, sistema: true },
    });
  }

  const arc = await prisma.dependencia.findUnique({ where: { codigo: 'ARC' } });
  const passwordHash = await argon2Hash(ADMIN_PASSWORD, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await prisma.usuario.upsert({
    where: { email: 'admin@empresa.local' },
    update: { roles: ['ADMIN', 'RADICADOR', 'AUDITOR'] },
    create: {
      documento: '00000000',
      nombre: 'Administrador del Sistema',
      email: 'admin@empresa.local',
      roles: ['ADMIN', 'RADICADOR', 'AUDITOR'],
      dependenciaId: arc?.id ?? null,
      passwordHash,
      debeCambiarPassword: true,
    },
  });

  for (const c of CONSECUTIVOS_2026) {
    await prisma.consecutivo.upsert({
      where: { vigencia_tipo: { vigencia: 2026, tipo: c.tipo } },
      update: {
        formato: c.formato,
        rangoContingenciaDesde: c.desde,
        rangoContingenciaHasta: c.hasta,
      },
      create: {
        vigencia: 2026,
        tipo: c.tipo,
        formato: c.formato,
        rangoContingenciaDesde: c.desde,
        rangoContingenciaHasta: c.hasta,
      },
    });
  }

  // Cuadro de clasificación de ejemplo (dependencia ADM)
  const adm = await prisma.dependencia.findUnique({ where: { codigo: 'ADM' } });
  if (adm) {
    const serieCorr = await prisma.serie.upsert({
      where: { dependenciaId_codigo: { dependenciaId: adm.id, codigo: '100' } },
      update: {},
      create: {
        codigo: '100', nombre: 'COMUNICACIONES OFICIALES', dependenciaId: adm.id,
        retencionArchivoGestion: 2, retencionArchivoCentral: 8,
        disposicionFinal: 'SELECCION',
        procedimiento: 'Selección del 10% con valor testimonial; el resto se elimina.',
      },
    });
    for (const [codigo, nombre] of [
      ['100.1', 'Comunicaciones oficiales recibidas'],
      ['100.2', 'Comunicaciones oficiales enviadas'],
    ]) {
      await prisma.subserie.upsert({
        where: { serieId_codigo: { serieId: serieCorr.id, codigo } },
        update: {},
        create: { codigo, nombre, serieId: serieCorr.id },
      });
    }
    await prisma.serie.upsert({
      where: { dependenciaId_codigo: { dependenciaId: adm.id, codigo: '200' } },
      update: {},
      create: {
        codigo: '200', nombre: 'DERECHOS DE PETICIÓN', dependenciaId: adm.id,
        retencionArchivoGestion: 3, retencionArchivoCentral: 7,
        disposicionFinal: 'CONSERVACION_TOTAL',
      },
    });
  }

  console.log(
    'Seed OK: parámetros, %d festivos 2026, %d roles, %d dependencias, admin, %d consecutivos y series de ejemplo.',
    FESTIVOS_2026.length, CATALOGO_ROLES.length, DEPENDENCIAS.length, CONSECUTIVOS_2026.length,
  );
  console.log('Admin: admin@empresa.local  ·  contraseña inicial: %s  (debe cambiarse al ingresar)', ADMIN_PASSWORD);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
