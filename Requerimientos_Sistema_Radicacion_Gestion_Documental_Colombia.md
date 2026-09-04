# Sistema de Radicación y Gestión Documental

## Requerimientos según la normativa archivística colombiana

## 1. Introducción

Para implementar un **sistema de radicación y gestión de documentos para
una empresa en Colombia**, es necesario diferenciar entre un sistema
básico de radicación y un **Sistema de Gestión de Documentos
Electrónicos de Archivo (SGDEA)**.

La referencia normativa principal para la función archivística es el
**Acuerdo 001 de 2024 del Archivo General de la Nación (AGN)**,
denominado *Acuerdo Único de la Función Archivística*. Este consolidó y
actualizó disposiciones archivísticas y dejó sin vigencia, entre otras,
disposiciones anteriores como el Acuerdo 060 de 2001.

El sistema debe garantizar, como mínimo, la adecuada recepción,
radicación, distribución, seguimiento, respuesta, organización y
trazabilidad de las comunicaciones oficiales.

------------------------------------------------------------------------

# 2. Funcionalidades mínimas del sistema de radicados

  -----------------------------------------------------------------------
  Funcionalidad                       Requerimiento
  ----------------------------------- -----------------------------------
  Radicado único                      Generar un consecutivo único para
                                      cada comunicación

  Consecutivo anual                   Permitir control del consecutivo
                                      por vigencia

  Fecha y hora                        Registrar automáticamente fecha y
                                      hora de recepción o envío

  Remitente                           Registrar persona o empresa que
                                      envía el documento

  Destinatario                        Registrar persona o dependencia
                                      receptora

  Dependencia responsable             Identificar el área encargada del
                                      trámite

  Funcionario responsable             Identificar el usuario responsable

  Asunto                              Registrar descripción o asunto del
                                      documento

  Anexos                              Registrar cantidad y archivos
                                      anexos

  Tiempos de respuesta                Controlar fecha límite y
                                      vencimiento 

  Estado                              Recibido, asignado, en trámite,
                                      respondido, cerrado, etc.

  Trazabilidad                        Registrar quién recibió, trasladó,
                                      modificó o respondió

  Consulta                            Buscar por radicado, fecha,
                                      remitente, asunto, dependencia,
                                      etc.

  Reportes                            Generar informes de entradas,
                                      salidas, pendientes y vencidos

  Expediente                          Asociar documentos al expediente
                                      correspondiente

  Archivo electrónico                 Conservar documentos y metadatos
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 3. Control de los números de radicación

El sistema debe implementar controles que impidan:

-   Reservar números de radicación.
-   Repetir números.
-   Reutilizar números.
-   Alterar números ya asignados.
-   Eliminar la evidencia de una radicación.
-   Utilizar nuevamente un número anulado.

Cuando sea necesario anular un número de radicación, debe conservarse el
registro de la anulación y su justificación.

### Ejemplo

``` text
2026-000001
2026-000002
2026-000003
2026-000004
```

Si el número `2026-000003` se anula:

``` text
RADICADO: 2026-000003
ESTADO: ANULADO
FECHA:
USUARIO:
MOTIVO: Error de radicación
JUSTIFICACIÓN:
```

El número `2026-000003` no debe volver a utilizarse.

------------------------------------------------------------------------

# 4. Radicados de entrada y salida

El sistema puede manejar consecutivos diferenciados para facilitar la
administración:

### Entrada

``` text
2026-ENT-000001
2026-ENT-000002
2026-ENT-000003
```

### Salida

``` text
2026-SAL-000001
2026-SAL-000002
2026-SAL-000003
```

También puede utilizarse un único consecutivo institucional:

``` text
2026-000001
2026-000002
2026-000003
```

Lo fundamental es garantizar:

-   Unicidad.
-   Consecutividad.
-   Control.
-   Trazabilidad.
-   Fecha y hora.
-   Integridad del registro.

------------------------------------------------------------------------

# 5. Ventanilla Única de Correspondencia

El sistema debe contemplar una **Ventanilla Única de Correspondencia**,
física o electrónica, que permita centralizar la recepción y radicación
de comunicaciones.

Los canales pueden incluir:

-   Recepción presencial.
-   Correo electrónico.
-   Página web.
-   Formularios electrónicos.
-   Sede electrónica.
-   Sistemas de información.
-   Documentos físicos.
-   Documentos electrónicos.

### Flujo general

``` text
                  VENTANILLA ÚNICA
                         |
        +----------------+----------------+
        |                |                |
      Físico           Correo            Web
        |                |                |
        +----------------+----------------+
                         |
                     RADICACIÓN
                         |
                    CLASIFICACIÓN
                         |
                     ASIGNACIÓN
                         |
                       TRÁMITE
                         |
                     RESPUESTA
                         |
                     EXPEDIENTE
                         |
                       ARCHIVO
```

El sistema debe conservar la fecha, hora y número de radicado
correspondiente.

------------------------------------------------------------------------

# 6. Seguimiento del trámite

El sistema no debe limitarse a generar el número de radicado.

Debe permitir conocer en todo momento:

``` text
RADICADO: 2026-ENT-000458

Fecha recepción: 03/09/2026 08:32
Remitente: Proveedor XYZ
Asunto: Solicitud de información

Dependencia: Administración
Responsable: Juan Pérez

Estado:
✓ Recibido
✓ Radicado
✓ Asignado
→ En trámite
○ Respondido
○ Cerrado
```

### Historial de trazabilidad

``` text
03/09/2026 08:32 → Radicado
03/09/2026 09:10 → Asignado a Administración
03/09/2026 10:25 → Recibido por Juan Pérez
04/09/2026 14:30 → En trámite
06/09/2026 11:20 → Respuesta generada
06/09/2026 11:25 → Cerrado
```

La trazabilidad debe ser permanente y no permitir modificaciones
silenciosas del historial.

------------------------------------------------------------------------

# 7. Derechos de petición y solicitudes

Cuando sean aplicables las normas sobre derecho de petición y atención
de solicitudes, el sistema debe permitir identificar el tipo de
comunicación.

### Tipos sugeridos

``` text
[ ] Comunicación general
[ ] Derecho de petición
[ ] Queja
[ ] Reclamo
[ ] Solicitud
[ ] Felicitación
[ ] Sugerencia
[ ] Otro
```

Para comunicaciones sujetas a términos legales se recomienda registrar:

``` text
Fecha de recepción
Fecha de vencimiento
Días restantes
Responsable
Estado
Nivel de alerta
Fecha de respuesta
```

El sistema debe permitir generar alertas antes del vencimiento.

------------------------------------------------------------------------

# 8. Gestión de documentos electrónicos

Un sistema de radicación no necesariamente constituye un SGDEA.

Un **SGDEA** tiene un alcance superior, pues debe permitir gestionar los
documentos durante su ciclo de vida y relacionarlos con la estructura
archivística de la organización.

### Sistema de radicación

``` text
Recepción
    ↓
Radicación
    ↓
Distribución
    ↓
Seguimiento
    ↓
Respuesta
```

### Gestión documental / SGDEA

``` text
Recepción
    ↓
Radicación
    ↓
Clasificación archivística
    ↓
Serie documental
    ↓
Subserie
    ↓
Expediente
    ↓
TRD
    ↓
Retención
    ↓
Transferencia
    ↓
Disposición final
```

------------------------------------------------------------------------

# 9. Integración con la Tabla de Retención Documental (TRD)

El documento no debe almacenarse únicamente como un archivo aislado.

Debe poder asociarse a la estructura documental de la organización:

``` text
DEPENDENCIA
     ↓
SERIE DOCUMENTAL
     ↓
SUBSERIE
     ↓
EXPEDIENTE
     ↓
DOCUMENTO
     ↓
RADICADO
```

El sistema debería permitir gestionar o consultar, según su alcance:

-   Dependencia productora.
-   Serie documental.
-   Subserie.
-   Tipo documental.
-   Expediente.
-   Código de TRD.
-   Tiempo de retención.
-   Disposición final.
-   Transferencias documentales.

Las comunicaciones oficiales y peticiones deben incorporarse al
expediente correspondiente de acuerdo con la estructura archivística y
la TRD aplicable.

------------------------------------------------------------------------

# 10. Seguridad y auditoría

Cada acción relevante debe quedar registrada en una bitácora.

### Información recomendada

``` text
Usuario
Fecha
Hora
IP
Acción
Documento
Radicado
Estado anterior
Estado nuevo
Observación
```

### Ejemplo

``` text
USUARIO: administrador
FECHA: 03/09/2026
HORA: 10:25

RADICADO: 2026-ENT-000458
ACCIÓN: Cambio de responsable

ANTES: María López
AHORA: Juan Pérez

MOTIVO: Reasignación por competencia
```

Esto permite demostrar la trazabilidad y controlar modificaciones.

------------------------------------------------------------------------

# 11. Integración con correo electrónico

Los correos institucionales deben contemplarse dentro del flujo
documental cuando correspondan a comunicaciones oficiales.

### Flujo recomendado

``` text
proveedor@empresa.com
          ↓
correo institucional
          ↓
Sistema de Radicación
          ↓
2026-ENT-000458
          ↓
Administración
```

El sistema debería poder conservar:

-   Dirección del remitente.
-   Destinatarios.
-   Fecha y hora.
-   Asunto.
-   Cuerpo del mensaje.
-   Archivos adjuntos.
-   Mensaje original.
-   Número de radicado.

------------------------------------------------------------------------

# 12. Plan de contingencia

El sistema debe contemplar mecanismos de continuidad ante fallas
tecnológicas.

### Flujo

``` text
SISTEMA PRINCIPAL
       ↓
     FALLA
       ↓
PLAN DE CONTINGENCIA
       ↓
RADICACIÓN MANUAL/TEMPORAL
       ↓
RECUPERACIÓN DEL SISTEMA
       ↓
INCORPORACIÓN CONTROLADA
```

El procedimiento de contingencia debe documentar cómo se asignan los
números, cómo se conservan las evidencias y cómo se incorporan
posteriormente los registros al sistema.

------------------------------------------------------------------------

# 13. Requerimientos funcionales recomendados

## Módulo 1 --- Ventanilla Única

-   Recepción física.
-   Recepción electrónica.
-   Recepción por correo electrónico.
-   Formularios web.
-   Registro de remitentes.
-   Digitalización.
-   Cargue de anexos.
-   Clasificación inicial.

## Módulo 2 --- Radicación

-   Consecutivo automático.
-   Control anual.
-   Radicación de entrada.
-   Radicación de salida.
-   Fecha y hora automática.
-   Control de duplicados.
-   Control de números anulados.
-   Registro de justificación de anulaciones.
-   Generación de código de barras o QR, opcional.

## Módulo 3 --- Distribución

-   Asignación a dependencia.
-   Asignación a funcionario.
-   Traslado.
-   Reasignación.
-   Aceptación.
-   Devolución.
-   Historial.

## Módulo 4 --- Seguimiento

-   Estados.
-   Tiempos de respuesta.
-   Alertas.
-   Vencimientos.
-   Semáforo de cumplimiento.
-   Indicadores.

## Módulo 5 --- Gestión documental

-   Series documentales.
-   Subseries.
-   Expedientes.
-   TRD.
-   Tipos documentales.
-   Metadatos.
-   Transferencias.

## Módulo 6 --- Archivo electrónico

-   PDF.
-   Documentos electrónicos.
-   Anexos.
-   Versiones.
-   Metadatos.
-   Control de integridad.
-   Consulta.

## Módulo 7 --- Auditoría

-   Bitácora.
-   Usuario.
-   Fecha y hora.
-   Acción realizada.
-   Dirección IP.
-   Historial de cambios.
-   Anulación de radicados.

## Módulo 8 --- Reportes

``` text
Radicados recibidos
Radicados enviados
Radicados pendientes
Radicados vencidos
Radicados por dependencia
Radicados por funcionario
Tiempo promedio de respuesta
Derechos de petición
Documentos por serie
Radicados anulados
```

------------------------------------------------------------------------

# 14. Recomendación para contratación o desarrollo

Si el objetivo es **comprar o desarrollar un sistema para una empresa**,
se recomienda dividir los requisitos en:

1.  Requerimientos funcionales.
2.  Requerimientos técnicos.
3.  Requerimientos archivísticos.
4.  Matriz de cumplimiento normativo.
5.  Seguridad de la información.
6.  Roles y permisos.
7.  Flujos de entrada y salida.
8.  Gestión de expedientes.
9.  TRD.
10. Auditoría y trazabilidad.
11. Integración con correo.
12. API e integraciones.
13. Copias de seguridad.
14. Plan de contingencia.
15. Criterios de aceptación.
16. Casos de prueba.

------------------------------------------------------------------------

# 15. Normativa de referencia

La referencia normativa principal para la función archivística es:

-   **Archivo General de la Nación --- Acuerdo 001 de 2024, Acuerdo
    Único de la Función Archivística.**
-   Normativa relacionada con gestión documental y archivo que resulte
    aplicable según la naturaleza jurídica, sector y obligaciones de la
    organización.
-   Normativa aplicable a protección de datos personales, seguridad de
    la información, firma electrónica/digital y documentos electrónicos,
    cuando corresponda.
-   Normativa específica sobre derecho de petición y atención de
    solicitudes cuando sea aplicable.

> **Nota:** Para un proyecto institucional es recomendable realizar una
> matriz de requisitos normativos actualizada y verificar la
> aplicabilidad de cada norma según la naturaleza jurídica de la
> empresa.

------------------------------------------------------------------------

# 16. Consideración importante sobre el Acuerdo 060 de 2001

Para un proyecto nuevo no se recomienda establecer como requisito
principal:

> "El sistema debe cumplir con el Acuerdo 060 de 2001."

La referencia debe actualizarse al marco vigente, principalmente al
**Acuerdo 001 de 2024 del Archivo General de la Nación**, sin perjuicio
de las demás normas que sean aplicables.

------------------------------------------------------------------------

# 17. Arquitectura funcional recomendada

``` text
                         USUARIOS
                            |
                            v
                 +--------------------+
                 | VENTANILLA ÚNICA   |
                 +--------------------+
                            |
                            v
                 +--------------------+
                 |     RADICACIÓN     |
                 +--------------------+
                            |
                            v
                 +--------------------+
                 |   CLASIFICACIÓN    |
                 +--------------------+
                            |
                            v
                 +--------------------+
                 |     ASIGNACIÓN     |
                 +--------------------+
                            |
                            v
                 +--------------------+
                 |      TRÁMITE       |
                 +--------------------+
                            |
                            v
                 +--------------------+
                 |     RESPUESTA      |
                 +--------------------+
                            |
                            v
                 +--------------------+
                 |    EXPEDIENTE      |
                 +--------------------+
                            |
                            v
                 +--------------------+
                 |      ARCHIVO       |
                 +--------------------+

          +--------------------------------+
          | AUDITORÍA Y TRAZABILIDAD       |
          +--------------------------------+

          +--------------------------------+
          | REPORTES E INDICADORES         |
          +--------------------------------+

          +--------------------------------+
          | BACKUP Y CONTINGENCIA          |
          +--------------------------------+
```

------------------------------------------------------------------------

## 18. Conclusión

Un sistema de radicación empresarial debe ir más allá de generar un
consecutivo.

Para una solución robusta debe garantizar:

**Radicación + distribución + seguimiento + respuesta + trazabilidad +
expediente + gestión documental + seguridad + conservación +
contingencia.**

Si el proyecto busca cumplir integralmente con gestión documental
electrónica, se debe evaluar además si la solución ofrecida realmente
corresponde a un **SGDEA** y si sus funcionalidades permiten implementar
la estructura archivística y los instrumentos de gestión documental de
la organización.

------------------------------------------------------------------------

# 19. Adenda — Módulo de usuarios y módulo de dependencias

> Requerimiento adicional solicitado el 2026-09-04, una vez implementado
> el núcleo de radicación. Se documenta aquí con el mismo criterio que el
> resto de este archivo, como referencia normativa del sistema.

## 19.1 Módulo de usuarios

El sistema debe permitir administrar de forma centralizada quiénes
pueden operarlo y con qué permisos, sin intervención directa sobre la
base de datos.

  -----------------------------------------------------------------------
  Funcionalidad                       Requerimiento
  ----------------------------------- -----------------------------------
  Alta de usuarios                    Registrar documento, nombre,
                                       correo, dependencia y uno o varios
                                       roles

  Gestión de roles                    Crear, listar y editar roles del
                                       sistema y sus permisos; los roles
                                       base del sistema no permiten editar
                                       sus permisos

  Activar / inactivar                 Suspender el acceso de un usuario
                                       sin eliminar su historial ni su
                                       autoría en radicados y bitácora

  Contraseña temporal                 Al crear un usuario o restablecer
                                       su acceso, generar una contraseña
                                       temporal de un solo uso

  Contraseña específica               El administrador puede fijar
                                       directamente una contraseña para
                                       el usuario, con o sin exigir que la
                                       cambie en el siguiente ingreso

  Cambio obligatorio en primer         Un usuario con contraseña temporal
  ingreso                              o vencida no puede usar el sistema
                                       hasta cambiarla

  Política de contraseñas             Longitud mínima, mayúsculas,
                                       minúsculas, números y caducidad en
                                       días, configurables como parámetro
                                       del sistema

  Cierre de sesiones                  El administrador puede revocar de
                                       inmediato todas las sesiones
                                       activas de un usuario (retiro,
                                       sospecha de compromiso)

  Segundo factor (MFA)                Cada usuario puede activar
                                       verificación en dos pasos (TOTP)
                                       para su propia cuenta

  Trazabilidad                        Toda alta, cambio de rol,
                                       activación/inactivación y gestión
                                       de contraseña queda en la bitácora
                                       de auditoría
  -----------------------------------------------------------------------

No se permite el autorregistro de usuarios internos: toda cuenta la crea
un administrador. La eliminación física de usuarios no está permitida
por la misma regla de trazabilidad que aplica a los radicados
(sección 3): un usuario se **inactiva**, nunca se borra.

## 19.2 Módulo de dependencias

El organigrama de la organización debe reflejarse en el sistema para que
la radicación, la distribución y la clasificación archivística puedan
apoyarse en él.

  -----------------------------------------------------------------------
  Funcionalidad                       Requerimiento
  ----------------------------------- -----------------------------------
  Alta de dependencias                Registrar código, nombre y
                                       dependencia superior (organigrama
                                       jerárquico, sin límite de niveles)

  Edición                             Cambiar nombre, superior jerárquico
                                       o estado (activa/inactiva)

  Personal de la dependencia          Ver, en la ficha de cada
                                       dependencia, las personas que la
                                       integran; asignar o quitar personal
                                       desde el módulo de usuarios o desde
                                       la propia dependencia

  Un usuario, una dependencia         Cada persona pertenece a una única
                                       dependencia a la vez; moverla de
                                       dependencia la retira
                                       automáticamente de la anterior

  Uso en la radicación                Al recibir o distribuir un
                                       documento, se elige primero la
                                       dependencia y luego, entre su
                                       personal, la persona responsable
                                       (quien recibe o a quien se asigna)

  Indicadores por dependencia         Cantidad de radicados y expedientes
                                       asociados a cada dependencia
  -----------------------------------------------------------------------

No se incorpora, por decisión del solicitante, un "responsable" o jefe
por defecto al que se asignen automáticamente los documentos de la
dependencia: la asignación a una persona concreta siempre es una
decisión explícita de quien distribuye.

------------------------------------------------------------------------

# 20. Adenda — Captura de documentos por cámara y firma en la recepción

> Requerimiento adicional solicitado el 2026-09-04, para reforzar la
> digitalización en la Ventanilla Única (capítulo 5, módulo 1 del
> capítulo 13) con evidencia capturada en el momento de la recepción.

## 20.1 Captura fotográfica

Al radicar, o al incorporar un documento a un expediente, el usuario debe
poder anexar la evidencia sin pasar primero por un escáner:

  -----------------------------------------------------------------------
  Funcionalidad                       Requerimiento
  ----------------------------------- -----------------------------------
  Foto desde el móvil                 Si se opera desde un teléfono o
                                       tableta, un botón "Tomar foto" abre
                                       la cámara nativa del equipo

  Cámara en el computador             Si se opera desde un PC con cámara
                                       (integrada o USB), el mismo botón
                                       muestra una vista previa en vivo,
                                       permite elegir el dispositivo si
                                       hay más de uno, y capturar

  Varias fotos por radicado           Se pueden tomar y adjuntar varias
                                       fotos, revisarlas en miniatura y
                                       quitar las que no sirvan antes de
                                       radicar

  Mismo tratamiento que un archivo    La foto capturada recibe el mismo
                                       control de integridad (checksum),
                                       almacenamiento y verificación que
                                       cualquier otro anexo (capítulo 9)
  -----------------------------------------------------------------------

La vista previa en vivo de la cámara requiere que el sitio se sirva por
**HTTPS** (exigencia de seguridad de los navegadores, no del sistema); si
el sitio está en HTTP, la aplicación recurre automáticamente al selector
de cámara nativo del sistema operativo, que sí funciona sin HTTPS —esto
cubre el caso del móvil sin condiciones adicionales.

## 20.2 Firma en la recepción

Cuando la comunicación se recibe de forma **presencial**, el sistema
ofrece un campo para capturar la firma de quien hace entrega del
documento, como constancia de la recepción:

  -----------------------------------------------------------------------
  Funcionalidad                       Requerimiento
  ----------------------------------- -----------------------------------
  Firma manuscrita en pantalla        Firmar con el mouse, con el dedo
                                       (pantalla táctil) o con lápiz
                                       óptico/tableta, indistintamente

  Opcional                            No es obligatoria; no bloquea la
                                       radicación si quien entrega no
                                       puede o no desea firmar en el
                                       equipo

  Solo cuando aplica                  El campo solo se ofrece cuando el
                                       canal de recepción es presencial

  Conservación                        La firma queda conservada como
                                       evidencia asociada al radicado, con
                                       el mismo control de integridad que
                                       los demás anexos
  -----------------------------------------------------------------------
