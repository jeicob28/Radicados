-- SGDEA · SGSI — Sistema de Gestión de Seguridad de la Información (ISO/IEC 27001:2022).
-- Activos de información, riesgos (probabilidad × impacto), catálogo del Anexo A,
-- Declaración de Aplicabilidad (SoA) y planes de tratamiento.

CREATE TYPE "ClaseActivo" AS ENUM (
  'INFORMACION', 'SOFTWARE', 'HARDWARE', 'SERVICIO', 'INFRAESTRUCTURA', 'PERSONAL', 'INSTALACION'
);
CREATE TYPE "EstadoRiesgo" AS ENUM (
  'IDENTIFICADO', 'EN_TRATAMIENTO', 'MITIGADO', 'ACEPTADO', 'CERRADO'
);
CREATE TYPE "OpcionTratamiento" AS ENUM ('MITIGAR', 'TRANSFERIR', 'EVITAR', 'ACEPTAR');
CREATE TYPE "EstadoControl" AS ENUM (
  'NO_APLICA', 'NO_IMPLEMENTADO', 'PLANIFICADO', 'EN_IMPLEMENTACION', 'IMPLEMENTADO'
);
CREATE TYPE "EstadoPlan" AS ENUM (
  'ABIERTO', 'EN_CURSO', 'IMPLEMENTADO', 'VERIFICADO', 'CERRADO'
);
CREATE TYPE "TemaAnexoA" AS ENUM ('ORGANIZACIONAL', 'PERSONAS', 'FISICO', 'TECNOLOGICO');

CREATE TABLE "activo_informacion" (
  "id"                TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "codigo"            TEXT NOT NULL,
  "nombre"            TEXT NOT NULL,
  "descripcion"       TEXT,
  "clase"             "ClaseActivo" NOT NULL,
  "propietario"       TEXT,
  "custodio"          TEXT,
  "dependencia_id"    TEXT,
  "ubicacion"         TEXT,
  "es_infraestructura" BOOLEAN NOT NULL DEFAULT false,
  "confidencialidad"  INTEGER NOT NULL DEFAULT 3,
  "integridad"        INTEGER NOT NULL DEFAULT 3,
  "disponibilidad"    INTEGER NOT NULL DEFAULT 3,
  "valoracion"        INTEGER NOT NULL DEFAULT 3,
  "activo"            BOOLEAN NOT NULL DEFAULT true,
  "creado"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activo_informacion_codigo_key" UNIQUE ("codigo"),
  CONSTRAINT "activo_informacion_dependencia_fk"
    FOREIGN KEY ("dependencia_id") REFERENCES "dependencia"("id") ON DELETE SET NULL
);
CREATE INDEX "activo_informacion_clase_idx" ON "activo_informacion" ("clase");

CREATE TABLE "control_anexo_a" (
  "id"          TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "codigo"      TEXT NOT NULL,
  "tema"        "TemaAnexoA" NOT NULL,
  "titulo"      TEXT NOT NULL,
  "descripcion" TEXT,
  CONSTRAINT "control_anexo_a_codigo_key" UNIQUE ("codigo")
);

CREATE TABLE "riesgo" (
  "id"                     TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "codigo"                 TEXT NOT NULL,
  "activo_id"              TEXT NOT NULL,
  "nombre"                 TEXT NOT NULL,
  "descripcion"            TEXT,
  "amenaza"                TEXT NOT NULL,
  "vulnerabilidad"         TEXT NOT NULL,
  "probabilidad"           INTEGER NOT NULL,
  "impacto"                INTEGER NOT NULL,
  "nivel_inherente"        INTEGER NOT NULL,
  "opcion_tratamiento"     "OpcionTratamiento" NOT NULL DEFAULT 'MITIGAR',
  "probabilidad_residual"  INTEGER,
  "impacto_residual"       INTEGER,
  "nivel_residual"         INTEGER,
  "estado"                 "EstadoRiesgo" NOT NULL DEFAULT 'IDENTIFICADO',
  "responsable_id"         TEXT,
  "fecha_revision"         TIMESTAMP(3),
  "creado"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "riesgo_codigo_key" UNIQUE ("codigo"),
  CONSTRAINT "riesgo_activo_fk" FOREIGN KEY ("activo_id") REFERENCES "activo_informacion"("id") ON DELETE CASCADE,
  CONSTRAINT "riesgo_responsable_fk" FOREIGN KEY ("responsable_id") REFERENCES "usuario"("id") ON DELETE SET NULL
);
CREATE INDEX "riesgo_estado_idx" ON "riesgo" ("estado");

CREATE TABLE "declaracion_aplicabilidad" (
  "id"                   TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "control_id"           TEXT NOT NULL,
  "aplica"               BOOLEAN NOT NULL DEFAULT true,
  "justificacion"        TEXT,
  "estado"               "EstadoControl" NOT NULL DEFAULT 'NO_IMPLEMENTADO',
  "responsable_id"       TEXT,
  "observaciones"        TEXT,
  "fecha_implementacion" TIMESTAMP(3),
  "actualizado"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "declaracion_aplicabilidad_control_id_key" UNIQUE ("control_id"),
  CONSTRAINT "declaracion_aplicabilidad_control_fk" FOREIGN KEY ("control_id") REFERENCES "control_anexo_a"("id") ON DELETE CASCADE,
  CONSTRAINT "declaracion_aplicabilidad_responsable_fk" FOREIGN KEY ("responsable_id") REFERENCES "usuario"("id") ON DELETE SET NULL
);

CREATE TABLE "plan_tratamiento" (
  "id"             TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "riesgo_id"      TEXT NOT NULL,
  "descripcion"    TEXT NOT NULL,
  "accion"         TEXT,
  "responsable_id" TEXT,
  "fecha_objetivo" TIMESTAMP(3),
  "estado"         "EstadoPlan" NOT NULL DEFAULT 'ABIERTO',
  "avance"         INTEGER NOT NULL DEFAULT 0,
  "fecha_cierre"   TIMESTAMP(3),
  "creado"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_tratamiento_riesgo_fk" FOREIGN KEY ("riesgo_id") REFERENCES "riesgo"("id") ON DELETE CASCADE,
  CONSTRAINT "plan_tratamiento_responsable_fk" FOREIGN KEY ("responsable_id") REFERENCES "usuario"("id") ON DELETE SET NULL
);
CREATE INDEX "plan_tratamiento_riesgo_id_idx" ON "plan_tratamiento" ("riesgo_id");

-- M2M implícita Prisma: relación "RiesgoControles" (ControlAnexoA < Riesgo → A=control, B=riesgo)
CREATE TABLE "_RiesgoControles" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_RiesgoControles_A_fkey" FOREIGN KEY ("A") REFERENCES "control_anexo_a"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "_RiesgoControles_B_fkey" FOREIGN KEY ("B") REFERENCES "riesgo"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "_RiesgoControles_AB_unique" ON "_RiesgoControles" ("A", "B");
CREATE INDEX "_RiesgoControles_B_index" ON "_RiesgoControles" ("B");

-- ============================================================================
-- Catálogo del Anexo A de ISO/IEC 27001:2022 (93 controles) + SoA completa
-- ============================================================================
INSERT INTO "control_anexo_a" ("codigo", "tema", "titulo") VALUES
  ('5.1', 'ORGANIZACIONAL'::"TemaAnexoA", 'Políticas de seguridad de la información'),
  ('5.2', 'ORGANIZACIONAL'::"TemaAnexoA", 'Roles y responsabilidades de seguridad de la información'),
  ('5.3', 'ORGANIZACIONAL'::"TemaAnexoA", 'Segregación de funciones'),
  ('5.4', 'ORGANIZACIONAL'::"TemaAnexoA", 'Responsabilidades de la dirección'),
  ('5.5', 'ORGANIZACIONAL'::"TemaAnexoA", 'Contacto con las autoridades'),
  ('5.6', 'ORGANIZACIONAL'::"TemaAnexoA", 'Contacto con grupos de interés especial'),
  ('5.7', 'ORGANIZACIONAL'::"TemaAnexoA", 'Inteligencia de amenazas'),
  ('5.8', 'ORGANIZACIONAL'::"TemaAnexoA", 'Seguridad de la información en la gestión de proyectos'),
  ('5.9', 'ORGANIZACIONAL'::"TemaAnexoA", 'Inventario de información y otros activos asociados'),
  ('5.10', 'ORGANIZACIONAL'::"TemaAnexoA", 'Uso aceptable de la información y otros activos asociados'),
  ('5.11', 'ORGANIZACIONAL'::"TemaAnexoA", 'Devolución de activos'),
  ('5.12', 'ORGANIZACIONAL'::"TemaAnexoA", 'Clasificación de la información'),
  ('5.13', 'ORGANIZACIONAL'::"TemaAnexoA", 'Etiquetado de la información'),
  ('5.14', 'ORGANIZACIONAL'::"TemaAnexoA", 'Transferencia de información'),
  ('5.15', 'ORGANIZACIONAL'::"TemaAnexoA", 'Control de acceso'),
  ('5.16', 'ORGANIZACIONAL'::"TemaAnexoA", 'Gestión de identidades'),
  ('5.17', 'ORGANIZACIONAL'::"TemaAnexoA", 'Información de autenticación'),
  ('5.18', 'ORGANIZACIONAL'::"TemaAnexoA", 'Derechos de acceso'),
  ('5.19', 'ORGANIZACIONAL'::"TemaAnexoA", 'Seguridad de la información en las relaciones con proveedores'),
  ('5.20', 'ORGANIZACIONAL'::"TemaAnexoA", 'Seguridad de la información en los acuerdos con proveedores'),
  ('5.21', 'ORGANIZACIONAL'::"TemaAnexoA", 'Gestión de la seguridad de la información en la cadena de suministro de TIC'),
  ('5.22', 'ORGANIZACIONAL'::"TemaAnexoA", 'Seguimiento, revisión y gestión de cambios de los servicios de proveedores'),
  ('5.23', 'ORGANIZACIONAL'::"TemaAnexoA", 'Seguridad de la información para el uso de servicios en la nube'),
  ('5.24', 'ORGANIZACIONAL'::"TemaAnexoA", 'Planificación y preparación de la gestión de incidentes de seguridad de la información'),
  ('5.25', 'ORGANIZACIONAL'::"TemaAnexoA", 'Evaluación y decisión sobre los eventos de seguridad de la información'),
  ('5.26', 'ORGANIZACIONAL'::"TemaAnexoA", 'Respuesta a incidentes de seguridad de la información'),
  ('5.27', 'ORGANIZACIONAL'::"TemaAnexoA", 'Aprendizaje de los incidentes de seguridad de la información'),
  ('5.28', 'ORGANIZACIONAL'::"TemaAnexoA", 'Recolección de evidencia'),
  ('5.29', 'ORGANIZACIONAL'::"TemaAnexoA", 'Seguridad de la información durante una disrupción'),
  ('5.30', 'ORGANIZACIONAL'::"TemaAnexoA", 'Preparación de las TIC para la continuidad del negocio'),
  ('5.31', 'ORGANIZACIONAL'::"TemaAnexoA", 'Requisitos legales, estatutarios, reglamentarios y contractuales'),
  ('5.32', 'ORGANIZACIONAL'::"TemaAnexoA", 'Derechos de propiedad intelectual'),
  ('5.33', 'ORGANIZACIONAL'::"TemaAnexoA", 'Protección de registros'),
  ('5.34', 'ORGANIZACIONAL'::"TemaAnexoA", 'Privacidad y protección de datos personales (PII)'),
  ('5.35', 'ORGANIZACIONAL'::"TemaAnexoA", 'Revisión independiente de la seguridad de la información'),
  ('5.36', 'ORGANIZACIONAL'::"TemaAnexoA", 'Cumplimiento de políticas, reglas y normas de seguridad de la información'),
  ('5.37', 'ORGANIZACIONAL'::"TemaAnexoA", 'Procedimientos operativos documentados'),
  ('6.1', 'PERSONAS'::"TemaAnexoA", 'Verificación de antecedentes'),
  ('6.2', 'PERSONAS'::"TemaAnexoA", 'Términos y condiciones del empleo'),
  ('6.3', 'PERSONAS'::"TemaAnexoA", 'Concienciación, educación y formación en seguridad de la información'),
  ('6.4', 'PERSONAS'::"TemaAnexoA", 'Proceso disciplinario'),
  ('6.5', 'PERSONAS'::"TemaAnexoA", 'Responsabilidades tras la terminación o el cambio de empleo'),
  ('6.6', 'PERSONAS'::"TemaAnexoA", 'Acuerdos de confidencialidad o no divulgación'),
  ('6.7', 'PERSONAS'::"TemaAnexoA", 'Trabajo remoto'),
  ('6.8', 'PERSONAS'::"TemaAnexoA", 'Reporte de eventos de seguridad de la información'),
  ('7.1', 'FISICO'::"TemaAnexoA", 'Perímetros de seguridad física'),
  ('7.2', 'FISICO'::"TemaAnexoA", 'Entrada física'),
  ('7.3', 'FISICO'::"TemaAnexoA", 'Seguridad de oficinas, salas e instalaciones'),
  ('7.4', 'FISICO'::"TemaAnexoA", 'Vigilancia de la seguridad física'),
  ('7.5', 'FISICO'::"TemaAnexoA", 'Protección contra amenazas físicas y ambientales'),
  ('7.6', 'FISICO'::"TemaAnexoA", 'Trabajo en áreas seguras'),
  ('7.7', 'FISICO'::"TemaAnexoA", 'Puesto de trabajo despejado y pantalla limpia'),
  ('7.8', 'FISICO'::"TemaAnexoA", 'Ubicación y protección de equipos'),
  ('7.9', 'FISICO'::"TemaAnexoA", 'Seguridad de activos fuera de las instalaciones'),
  ('7.10', 'FISICO'::"TemaAnexoA", 'Soportes de almacenamiento'),
  ('7.11', 'FISICO'::"TemaAnexoA", 'Servicios de suministro (energía, climatización)'),
  ('7.12', 'FISICO'::"TemaAnexoA", 'Seguridad del cableado'),
  ('7.13', 'FISICO'::"TemaAnexoA", 'Mantenimiento de equipos'),
  ('7.14', 'FISICO'::"TemaAnexoA", 'Eliminación segura o reutilización de equipos'),
  ('8.1', 'TECNOLOGICO'::"TemaAnexoA", 'Dispositivos de usuario final'),
  ('8.2', 'TECNOLOGICO'::"TemaAnexoA", 'Derechos de acceso privilegiado'),
  ('8.3', 'TECNOLOGICO'::"TemaAnexoA", 'Restricción de acceso a la información'),
  ('8.4', 'TECNOLOGICO'::"TemaAnexoA", 'Acceso al código fuente'),
  ('8.5', 'TECNOLOGICO'::"TemaAnexoA", 'Autenticación segura'),
  ('8.6', 'TECNOLOGICO'::"TemaAnexoA", 'Gestión de la capacidad'),
  ('8.7', 'TECNOLOGICO'::"TemaAnexoA", 'Protección contra código malicioso'),
  ('8.8', 'TECNOLOGICO'::"TemaAnexoA", 'Gestión de vulnerabilidades técnicas'),
  ('8.9', 'TECNOLOGICO'::"TemaAnexoA", 'Gestión de la configuración'),
  ('8.10', 'TECNOLOGICO'::"TemaAnexoA", 'Borrado de información'),
  ('8.11', 'TECNOLOGICO'::"TemaAnexoA", 'Enmascaramiento de datos'),
  ('8.12', 'TECNOLOGICO'::"TemaAnexoA", 'Prevención de fuga de datos'),
  ('8.13', 'TECNOLOGICO'::"TemaAnexoA", 'Copias de respaldo de la información'),
  ('8.14', 'TECNOLOGICO'::"TemaAnexoA", 'Redundancia de las instalaciones de procesamiento de información'),
  ('8.15', 'TECNOLOGICO'::"TemaAnexoA", 'Registro de eventos (logs)'),
  ('8.16', 'TECNOLOGICO'::"TemaAnexoA", 'Actividades de seguimiento'),
  ('8.17', 'TECNOLOGICO'::"TemaAnexoA", 'Sincronización de relojes'),
  ('8.18', 'TECNOLOGICO'::"TemaAnexoA", 'Uso de programas utilitarios privilegiados'),
  ('8.19', 'TECNOLOGICO'::"TemaAnexoA", 'Instalación de software en sistemas operativos'),
  ('8.20', 'TECNOLOGICO'::"TemaAnexoA", 'Seguridad de las redes'),
  ('8.21', 'TECNOLOGICO'::"TemaAnexoA", 'Seguridad de los servicios de red'),
  ('8.22', 'TECNOLOGICO'::"TemaAnexoA", 'Segregación de redes'),
  ('8.23', 'TECNOLOGICO'::"TemaAnexoA", 'Filtrado web'),
  ('8.24', 'TECNOLOGICO'::"TemaAnexoA", 'Uso de criptografía'),
  ('8.25', 'TECNOLOGICO'::"TemaAnexoA", 'Ciclo de vida de desarrollo seguro'),
  ('8.26', 'TECNOLOGICO'::"TemaAnexoA", 'Requisitos de seguridad de las aplicaciones'),
  ('8.27', 'TECNOLOGICO'::"TemaAnexoA", 'Principios de ingeniería y arquitectura de sistemas seguros'),
  ('8.28', 'TECNOLOGICO'::"TemaAnexoA", 'Codificación segura'),
  ('8.29', 'TECNOLOGICO'::"TemaAnexoA", 'Pruebas de seguridad en desarrollo y aceptación'),
  ('8.30', 'TECNOLOGICO'::"TemaAnexoA", 'Desarrollo contratado externamente'),
  ('8.31', 'TECNOLOGICO'::"TemaAnexoA", 'Separación de los entornos de desarrollo, prueba y producción'),
  ('8.32', 'TECNOLOGICO'::"TemaAnexoA", 'Gestión de cambios'),
  ('8.33', 'TECNOLOGICO'::"TemaAnexoA", 'Información de prueba'),
  ('8.34', 'TECNOLOGICO'::"TemaAnexoA", 'Protección de los sistemas de información durante las pruebas de auditoría')
ON CONFLICT ("codigo") DO NOTHING;

INSERT INTO "declaracion_aplicabilidad" ("id", "control_id", "aplica", "estado", "actualizado")
SELECT (gen_random_uuid())::text, c."id", true, 'NO_IMPLEMENTADO'::"EstadoControl", CURRENT_TIMESTAMP
FROM "control_anexo_a" c
ON CONFLICT ("control_id") DO NOTHING;
