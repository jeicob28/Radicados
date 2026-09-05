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

> **Ventanilla única centralizada (desde 2026-09-05):** la radicación —
> tanto de entrada como de salida— es una función exclusiva del rol
> `VENTANILLA` (además de `ADMIN`, que la tiene por ser superrol). Ningún
> otro rol radica directamente, ni siquiera para responder los casos que
> tramita. Detalle completo y motivación en el capítulo 21.

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

> **Quién puede radicar (desde 2026-09-05):** solo `VENTANILLA`/`ADMIN` —
> ver la nota del Módulo 1 y el capítulo 21.

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

Cuando la comunicación se recibe de forma **física** (canal presencial o
por mensajería/físico), el sistema ofrece un campo para capturar la firma
de quien hace entrega del documento, como constancia de la recepción:

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

  Solo cuando aplica                  El campo solo se ofrece en
                                       radicados de entrada cuyo canal de
                                       recepción es presencial o físico

  Conservación                        La firma queda conservada como
                                       evidencia asociada al radicado, con
                                       el mismo control de integridad que
                                       los demás anexos, y se muestra en
                                       el detalle del radicado
  -----------------------------------------------------------------------

## 20.3 Fecha de llegada y quién entrega el documento

Junto con la firma, y para el mismo caso (radicado de entrada, canal
presencial o físico), el formulario de radicación captura dos datos
adicionales de la recepción, propios de la ventanilla física:

  -----------------------------------------------------------------------
  Campo                                Requerimiento
  ------------------------------------ ----------------------------------
  Fecha y hora de llegada               Editable, con la fecha/hora actual
                                         como valor por defecto; existe
                                         para el caso en que el documento
                                         llegó antes de que alguien
                                         alcanzara a radicarlo (rezago de
                                         digitación) y la fecha real de
                                         llegada deba quedar registrada
                                         aparte de la fecha de radicación

  Entregado por                         Nombre de quien trae físicamente
                                         el documento a la ventanilla; no
                                         siempre coincide con el
                                         remitente/tercero (p. ej. un
                                         mensajero que entrega en nombre
                                         de otra persona o entidad)
  -----------------------------------------------------------------------

Ambos campos son opcionales y quedan fijados al momento de radicar —igual
que el resto del radicado, no se pueden modificar después (regla
append-only, capítulo 4)—, y se muestran en el detalle del radicado junto
con la firma.

# 21. Historial de cambios de alcance

> A partir de esta fecha, los cambios de alcance pedidos después de la
> entrega inicial (fases F0–F6) se registran aquí como una bitácora
> histórica: cada entrada queda fija una vez escrita, y un cambio
> posterior se agrega como entrada nueva, nunca reemplazando ni borrando
> una anterior. El resto del documento (capítulos 1 a 20) se sigue
> actualizando para reflejar el comportamiento vigente del sistema —con
> una nota corta que remite aquí cuando un cambio de esta bitácora lo
> modifica—, pero el porqué y el cómo de cada decisión queda registrado
> en este capítulo, igual que la bitácora de radicados del propio sistema
> (capítulo 4) conserva el rastro de lo que pasó y por qué.

## 21.1 2026-09-05 — Ventanilla única centralizada

**Solicitado por:** el área (petición trasladada al desarrollador).

**Petición original (resumen):**
1. Los usuarios que no sean ADMIN o VENTANILLA (ventanilla única) no
   deben poder radicar.
2. Los demás roles solo deben ver la documentación que se les asigne,
   nada más.
3. El método de trabajo a implementar es ventanilla única para toda la
   empresa: centralizar la radicación en un solo punto, que luego hace
   llegar la documentación a los demás.

**Validado antes de implementar** (con el solicitante, punto por punto):

| Punto a definir | Decisión |
|---|---|
| Alcance de "lo asignado" | Por dependencia: FUNCIONARIO y JEFE ven todos los radicados asignados a **su dependencia**, no solo lo asignado a su usuario individual — así el jefe puede repartir el trabajo entre su equipo y cada funcionario ve el contexto de su área. |
| ARCHIVISTA y AUDITOR | Exentos de la restricción de visibilidad — necesitan ver todas las dependencias para poder clasificar lo sin asignar (ARCHIVISTA) y auditar (AUDITOR). |
| RADICADOR | También exento de la restricción de visibilidad, por ser función transversal (anula radicados y coordina el consecutivo de cualquier dependencia) — pero sí pierde la capacidad de radicar directamente, igual que FUNCIONARIO y JEFE. |
| Radicados de salida (respuestas) | También se centralizan en Ventanilla — un funcionario ya no genera él mismo el radicado de salida al responder un caso; le hace llegar el documento de respuesta a Ventanilla para que lo radique y despache. Es el modelo de ventanilla única completo, no solo para la entrada. |
| Alcance del detalle | La restricción aplica también al abrir el detalle de un radicado directamente (no solo al listado) — de lo contrario, alguien podría ver el contenido de un radicado ajeno con solo conocer o adivinar el número. |

**Implementado:**
- Backend (`apps/api/src/radicacion/`): `POST /radicados` y
  `POST /radicados/adjuntos` exigen ahora rol `VENTANILLA` (antes:
  VENTANILLA, FUNCIONARIO, RADICADOR, JEFE); `ADMIN` conserva acceso por
  ser superrol. `GET /radicados`, `GET /radicados/:numero`,
  `GET /radicados/:numero/trazabilidad` y la descarga de anexos filtran
  automáticamente por la dependencia del usuario autenticado cuando su
  rol no tiene visibilidad total (ignoran cualquier `dependenciaId` que
  el cliente intente forzar por query); si el usuario no tiene
  dependencia asignada, no ve ningún radicado.
- Frontend (`apps/web/src`): el enlace "Radicar" del menú y la ruta
  `/radicar` quedan restringidos a VENTANILLA/ADMIN (redirige si alguien
  más intenta entrar por URL directa). La página de Consulta muestra un
  aviso ("solo se muestran los radicados de tu dependencia") a quien no
  tiene visibilidad total.
- Verificado con usuarios de prueba en dos dependencias distintas:
  radicar como FUNCIONARIO/JEFE/RADICADOR devuelve 403; un funcionario de
  la dependencia A no ve, ni puede abrir por URL directa, el detalle de
  un radicado de la dependencia B (403 aunque conozca el número exacto);
  VENTANILLA/ARCHIVISTA/AUDITOR/RADICADOR siguen viendo todo.

**Complemento (2026-09-05, tras prueba del área):** el filtro por
dependencia se extendió a las demás vistas que también muestran radicados
—el **Panel** (`/seguimiento/indicadores` y `/seguimiento/vencimientos`) y
los **Expedientes** (`/expedientes`, su detalle y su índice)—, con la
misma regla: quien no tiene visibilidad total solo ve lo de su dependencia
y, sin dependencia asignada, no ve nada. La lógica quedó centralizada en
`apps/api/src/common/visibilidad-radicados.ts`. Nota operativa: como el rol
y la dependencia viajan en el token de acceso (vigencia ~15 min), al
cambiarle la dependencia o el rol a un usuario conviene que cierre y vuelva
a iniciar sesión para que el cambio surta efecto de inmediato.

**Fuera del alcance de esta petición, sin definir todavía:**
- El mecanismo exacto para que un funcionario "entregue" su respuesta a
  Ventanilla no cambió: Ventanilla usa el mismo formulario de Radicar con
  tipo Salida, y el funcionario le hace llegar el documento por fuera del
  sistema, igual que hoy le llega un documento físico a la ventanilla. Si
  el área quiere un flujo formal dentro del sistema (p. ej. que el
  funcionario "envíe a radicar" un borrador desde la aplicación), es un
  requerimiento nuevo a definir y validar aparte.
- El permiso de RADICADOR para anular radicados de cualquier dependencia
  no se tocó — sigue igual que antes de este cambio.
