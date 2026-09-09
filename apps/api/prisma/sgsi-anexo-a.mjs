// Catálogo del Anexo A de ISO/IEC 27001:2022 (93 controles, 4 temas).
// Se usa en la migración (INSERT ... ON CONFLICT DO NOTHING) y en el seed.
// Títulos en español, alineados con ISO/IEC 27002:2022.

/** @type {Array<{ codigo: string, tema: 'ORGANIZACIONAL'|'PERSONAS'|'FISICO'|'TECNOLOGICO', titulo: string }>} */
export const ANEXO_A = [
  // A.5 — Controles organizacionales (37)
  ['5.1', 'ORGANIZACIONAL', 'Políticas de seguridad de la información'],
  ['5.2', 'ORGANIZACIONAL', 'Roles y responsabilidades de seguridad de la información'],
  ['5.3', 'ORGANIZACIONAL', 'Segregación de funciones'],
  ['5.4', 'ORGANIZACIONAL', 'Responsabilidades de la dirección'],
  ['5.5', 'ORGANIZACIONAL', 'Contacto con las autoridades'],
  ['5.6', 'ORGANIZACIONAL', 'Contacto con grupos de interés especial'],
  ['5.7', 'ORGANIZACIONAL', 'Inteligencia de amenazas'],
  ['5.8', 'ORGANIZACIONAL', 'Seguridad de la información en la gestión de proyectos'],
  ['5.9', 'ORGANIZACIONAL', 'Inventario de información y otros activos asociados'],
  ['5.10', 'ORGANIZACIONAL', 'Uso aceptable de la información y otros activos asociados'],
  ['5.11', 'ORGANIZACIONAL', 'Devolución de activos'],
  ['5.12', 'ORGANIZACIONAL', 'Clasificación de la información'],
  ['5.13', 'ORGANIZACIONAL', 'Etiquetado de la información'],
  ['5.14', 'ORGANIZACIONAL', 'Transferencia de información'],
  ['5.15', 'ORGANIZACIONAL', 'Control de acceso'],
  ['5.16', 'ORGANIZACIONAL', 'Gestión de identidades'],
  ['5.17', 'ORGANIZACIONAL', 'Información de autenticación'],
  ['5.18', 'ORGANIZACIONAL', 'Derechos de acceso'],
  ['5.19', 'ORGANIZACIONAL', 'Seguridad de la información en las relaciones con proveedores'],
  ['5.20', 'ORGANIZACIONAL', 'Seguridad de la información en los acuerdos con proveedores'],
  ['5.21', 'ORGANIZACIONAL', 'Gestión de la seguridad de la información en la cadena de suministro de TIC'],
  ['5.22', 'ORGANIZACIONAL', 'Seguimiento, revisión y gestión de cambios de los servicios de proveedores'],
  ['5.23', 'ORGANIZACIONAL', 'Seguridad de la información para el uso de servicios en la nube'],
  ['5.24', 'ORGANIZACIONAL', 'Planificación y preparación de la gestión de incidentes de seguridad de la información'],
  ['5.25', 'ORGANIZACIONAL', 'Evaluación y decisión sobre los eventos de seguridad de la información'],
  ['5.26', 'ORGANIZACIONAL', 'Respuesta a incidentes de seguridad de la información'],
  ['5.27', 'ORGANIZACIONAL', 'Aprendizaje de los incidentes de seguridad de la información'],
  ['5.28', 'ORGANIZACIONAL', 'Recolección de evidencia'],
  ['5.29', 'ORGANIZACIONAL', 'Seguridad de la información durante una disrupción'],
  ['5.30', 'ORGANIZACIONAL', 'Preparación de las TIC para la continuidad del negocio'],
  ['5.31', 'ORGANIZACIONAL', 'Requisitos legales, estatutarios, reglamentarios y contractuales'],
  ['5.32', 'ORGANIZACIONAL', 'Derechos de propiedad intelectual'],
  ['5.33', 'ORGANIZACIONAL', 'Protección de registros'],
  ['5.34', 'ORGANIZACIONAL', 'Privacidad y protección de datos personales (PII)'],
  ['5.35', 'ORGANIZACIONAL', 'Revisión independiente de la seguridad de la información'],
  ['5.36', 'ORGANIZACIONAL', 'Cumplimiento de políticas, reglas y normas de seguridad de la información'],
  ['5.37', 'ORGANIZACIONAL', 'Procedimientos operativos documentados'],
  // A.6 — Controles de personas (8)
  ['6.1', 'PERSONAS', 'Verificación de antecedentes'],
  ['6.2', 'PERSONAS', 'Términos y condiciones del empleo'],
  ['6.3', 'PERSONAS', 'Concienciación, educación y formación en seguridad de la información'],
  ['6.4', 'PERSONAS', 'Proceso disciplinario'],
  ['6.5', 'PERSONAS', 'Responsabilidades tras la terminación o el cambio de empleo'],
  ['6.6', 'PERSONAS', 'Acuerdos de confidencialidad o no divulgación'],
  ['6.7', 'PERSONAS', 'Trabajo remoto'],
  ['6.8', 'PERSONAS', 'Reporte de eventos de seguridad de la información'],
  // A.7 — Controles físicos (14)
  ['7.1', 'FISICO', 'Perímetros de seguridad física'],
  ['7.2', 'FISICO', 'Entrada física'],
  ['7.3', 'FISICO', 'Seguridad de oficinas, salas e instalaciones'],
  ['7.4', 'FISICO', 'Vigilancia de la seguridad física'],
  ['7.5', 'FISICO', 'Protección contra amenazas físicas y ambientales'],
  ['7.6', 'FISICO', 'Trabajo en áreas seguras'],
  ['7.7', 'FISICO', 'Puesto de trabajo despejado y pantalla limpia'],
  ['7.8', 'FISICO', 'Ubicación y protección de equipos'],
  ['7.9', 'FISICO', 'Seguridad de activos fuera de las instalaciones'],
  ['7.10', 'FISICO', 'Soportes de almacenamiento'],
  ['7.11', 'FISICO', 'Servicios de suministro (energía, climatización)'],
  ['7.12', 'FISICO', 'Seguridad del cableado'],
  ['7.13', 'FISICO', 'Mantenimiento de equipos'],
  ['7.14', 'FISICO', 'Eliminación segura o reutilización de equipos'],
  // A.8 — Controles tecnológicos (34)
  ['8.1', 'TECNOLOGICO', 'Dispositivos de usuario final'],
  ['8.2', 'TECNOLOGICO', 'Derechos de acceso privilegiado'],
  ['8.3', 'TECNOLOGICO', 'Restricción de acceso a la información'],
  ['8.4', 'TECNOLOGICO', 'Acceso al código fuente'],
  ['8.5', 'TECNOLOGICO', 'Autenticación segura'],
  ['8.6', 'TECNOLOGICO', 'Gestión de la capacidad'],
  ['8.7', 'TECNOLOGICO', 'Protección contra código malicioso'],
  ['8.8', 'TECNOLOGICO', 'Gestión de vulnerabilidades técnicas'],
  ['8.9', 'TECNOLOGICO', 'Gestión de la configuración'],
  ['8.10', 'TECNOLOGICO', 'Borrado de información'],
  ['8.11', 'TECNOLOGICO', 'Enmascaramiento de datos'],
  ['8.12', 'TECNOLOGICO', 'Prevención de fuga de datos'],
  ['8.13', 'TECNOLOGICO', 'Copias de respaldo de la información'],
  ['8.14', 'TECNOLOGICO', 'Redundancia de las instalaciones de procesamiento de información'],
  ['8.15', 'TECNOLOGICO', 'Registro de eventos (logs)'],
  ['8.16', 'TECNOLOGICO', 'Actividades de seguimiento'],
  ['8.17', 'TECNOLOGICO', 'Sincronización de relojes'],
  ['8.18', 'TECNOLOGICO', 'Uso de programas utilitarios privilegiados'],
  ['8.19', 'TECNOLOGICO', 'Instalación de software en sistemas operativos'],
  ['8.20', 'TECNOLOGICO', 'Seguridad de las redes'],
  ['8.21', 'TECNOLOGICO', 'Seguridad de los servicios de red'],
  ['8.22', 'TECNOLOGICO', 'Segregación de redes'],
  ['8.23', 'TECNOLOGICO', 'Filtrado web'],
  ['8.24', 'TECNOLOGICO', 'Uso de criptografía'],
  ['8.25', 'TECNOLOGICO', 'Ciclo de vida de desarrollo seguro'],
  ['8.26', 'TECNOLOGICO', 'Requisitos de seguridad de las aplicaciones'],
  ['8.27', 'TECNOLOGICO', 'Principios de ingeniería y arquitectura de sistemas seguros'],
  ['8.28', 'TECNOLOGICO', 'Codificación segura'],
  ['8.29', 'TECNOLOGICO', 'Pruebas de seguridad en desarrollo y aceptación'],
  ['8.30', 'TECNOLOGICO', 'Desarrollo contratado externamente'],
  ['8.31', 'TECNOLOGICO', 'Separación de los entornos de desarrollo, prueba y producción'],
  ['8.32', 'TECNOLOGICO', 'Gestión de cambios'],
  ['8.33', 'TECNOLOGICO', 'Información de prueba'],
  ['8.34', 'TECNOLOGICO', 'Protección de los sistemas de información durante las pruebas de auditoría'],
].map(([codigo, tema, titulo]) => ({ codigo, tema, titulo }));

/** SQL para sembrar el catálogo + la Declaración de Aplicabilidad completa. */
export function anexoASql() {
  const esc = (s) => s.replace(/'/g, "''");
  const controles = ANEXO_A.map(
    (c) => `  ('${c.codigo}', '${c.tema}'::"TemaAnexoA", '${esc(c.titulo)}')`,
  ).join(',\n');
  return `
INSERT INTO "control_anexo_a" ("codigo", "tema", "titulo") VALUES
${controles}
ON CONFLICT ("codigo") DO NOTHING;

-- Declaración de Aplicabilidad (SoA): una fila por control, aplicable y sin implementar.
INSERT INTO "declaracion_aplicabilidad" ("id", "control_id", "aplica", "estado", "actualizado")
SELECT (gen_random_uuid())::text, c."id", true, 'NO_IMPLEMENTADO'::"EstadoControl", CURRENT_TIMESTAMP
FROM "control_anexo_a" c
ON CONFLICT ("control_id") DO NOTHING;
`.trim();
}
