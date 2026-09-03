/**
 * Catálogo base de roles del SGDEA (RBAC). Se siembra en la tabla `rol` y puede
 * ampliarse desde /api/v1/roles. Los guards evalúan el código del rol; `ADMIN`
 * es un superrol que satisface cualquier requisito.
 */
export const ROLES = {
  ADMIN: 'ADMIN',
  RADICADOR: 'RADICADOR',
  VENTANILLA: 'VENTANILLA',
  FUNCIONARIO: 'FUNCIONARIO',
  JEFE: 'JEFE',
  ARCHIVISTA: 'ARCHIVISTA',
  AUDITOR: 'AUDITOR',
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];

export const CATALOGO_ROLES: Array<{
  codigo: Rol;
  nombre: string;
  descripcion: string;
  permisos: string[];
}> = [
  {
    codigo: ROLES.ADMIN,
    nombre: 'Administrador',
    descripcion: 'Configuración del sistema, usuarios, roles y parámetros.',
    permisos: ['*'],
  },
  {
    codigo: ROLES.RADICADOR,
    nombre: 'Coordinador de correspondencia',
    descripcion: 'Gestiona el formato del consecutivo y el rango de contingencia; anula radicados con justificación.',
    permisos: ['radicado:anular', 'consecutivo:configurar', 'radicado:leer', 'reporte:leer'],
  },
  {
    codigo: ROLES.VENTANILLA,
    nombre: 'Ventanilla única',
    descripcion: 'Recepción y radicación de entrada, digitalización, registro de terceros.',
    permisos: ['recepcion:crear', 'radicado:crear', 'tercero:crear', 'tercero:leer', 'radicado:leer'],
  },
  {
    codigo: ROLES.FUNCIONARIO,
    nombre: 'Funcionario',
    descripcion: 'Tramita los radicados de su dependencia y genera respuestas.',
    permisos: ['radicado:tramitar', 'radicado:responder', 'documento:adjuntar', 'radicado:leer'],
  },
  {
    codigo: ROLES.JEFE,
    nombre: 'Jefe de dependencia',
    descripcion: 'Asigna y reasigna trámites, aprueba respuestas, consulta indicadores del área.',
    permisos: ['radicado:asignar', 'radicado:reasignar', 'radicado:aprobar', 'indicador:leer', 'radicado:leer'],
  },
  {
    codigo: ROLES.ARCHIVISTA,
    nombre: 'Archivista',
    descripcion: 'Series, subseries, TRD, expedientes, transferencias y disposición final.',
    permisos: ['trd:gestionar', 'expediente:gestionar', 'transferencia:gestionar', 'radicado:clasificar'],
  },
  {
    codigo: ROLES.AUDITOR,
    nombre: 'Auditor',
    descripcion: 'Lectura total de la bitácora y la trazabilidad; verificación de la cadena de integridad.',
    permisos: ['bitacora:leer', 'bitacora:verificar', 'trazabilidad:leer', 'reporte:leer'],
  },
];
