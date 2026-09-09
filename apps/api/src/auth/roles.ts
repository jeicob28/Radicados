/**
 * Catálogo base de roles del SGDEA (RBAC). Se siembra en la tabla `rol` y puede
 * ampliarse desde /api/v1/roles. Los guards evalúan el código del rol; `ADMIN`
 * y `DEV` son superroles que satisfacen cualquier requisito.
 *
 * Separación de funciones: `ADMIN` es la administración funcional (usuarios,
 * roles, dependencias, metas de indicadores, disposición documental); `DEV` es
 * el soporte técnico (marca, copias de seguridad, parámetros del sistema,
 * mantenimiento y la infraestructura del SGSI). Solo un usuario `DEV` puede
 * otorgar el rol `DEV`.
 */
export const ROLES = {
  ADMIN: 'ADMIN',
  DEV: 'DEV',
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
    descripcion: 'Administración funcional: usuarios, roles, dependencias, metas de indicadores y disposición documental.',
    permisos: ['*'],
  },
  {
    codigo: ROLES.DEV,
    nombre: 'Soporte técnico',
    descripcion: 'Soporte técnico y superusuario: marca, copias de seguridad, parámetros del sistema, mantenimiento e infraestructura del SGSI. Solo un DEV puede otorgar el rol DEV.',
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
    descripcion:
      'Recepción, digitalización y registro de terceros; único rol que radica (entrada y salida) — centraliza la radicación de toda la empresa.',
    permisos: ['recepcion:crear', 'radicado:crear', 'tercero:crear', 'tercero:leer', 'radicado:leer'],
  },
  {
    codigo: ROLES.FUNCIONARIO,
    nombre: 'Funcionario',
    descripcion:
      'Tramita los radicados de su dependencia y prepara las respuestas; Ventanilla es quien las radica y despacha.',
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
