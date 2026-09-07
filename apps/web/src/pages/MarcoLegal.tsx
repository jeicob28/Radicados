import { Card } from '../ui';

interface Norma {
  norma: string;
  regula: string;
  sgdea: string;
}
interface Grupo {
  titulo: string;
  intro?: string;
  normas: Norma[];
}

const PRINCIPAL: Norma = {
  norma: 'Acuerdo 001 de 2024 del Archivo General de la Nación (AGN)',
  regula:
    'Acuerdo Único de la Función Archivística y de Gestión Documental. Compila y actualiza la reglamentación archivística del país (reemplaza, entre otros, al Acuerdo 060 de 2001 sobre comunicaciones oficiales). Define la radicación con número consecutivo único y controlado, el registro y control de las comunicaciones oficiales de entrada y salida, las Tablas de Retención Documental, el expediente electrónico, la trazabilidad y la preservación a largo plazo.',
  sgdea:
    'Es la norma base sobre la que se construyó el sistema: consecutivo por transacción serializable que nunca se reutiliza, radicados y bitácora inalterables, ventanilla única, TRD y series, expedientes electrónicos con foliado, semáforo de términos y auditoría encadenada.',
};

const GRUPOS: Grupo[] = [
  {
    titulo: 'Función archivística y gestión documental',
    normas: [
      {
        norma: 'Ley 594 de 2000 — Ley General de Archivos',
        regula:
          'Marco general de la función archivística. Obligación de organizar los archivos, elaborar y aplicar Tablas de Retención, y conservar la memoria documental.',
        sgdea: 'Series/subseries y TRD, expedientes, transferencias primarias y disposición final con doble aprobación.',
      },
      {
        norma: 'Decreto 1080 de 2015 — Decreto Único del Sector Cultura',
        regula:
          'Compila la reglamentación archivística: Sistema Nacional de Archivos, gestión documental, TRD/TVD, documentos electrónicos y los procesos de la gestión documental.',
        sgdea:
          'Los ocho procesos (planeación, producción, gestión y trámite, organización, transferencia, disposición, preservación y valoración) se reflejan en el ciclo de vida del radicado y del expediente.',
      },
      {
        norma: 'Decreto 2609 de 2012 (compilado en el 1080 de 2015)',
        regula: 'Gestión documental para las entidades del Estado; procesos y el Programa de Gestión Documental (PGD).',
        sgdea: 'Trazabilidad completa de cada documento desde la recepción hasta su disposición final.',
      },
      {
        norma: 'Circular Externa 003 de 2015 del AGN',
        regula: 'Directrices para la gestión de documentos electrónicos de archivo.',
        sgdea: 'Metadatos mínimos, checksum de cada anexo, e integridad verificable de la bitácora.',
      },
      {
        norma: 'Circular 005 de 2012 del AGN',
        regula: 'Prohíbe eliminar documentos de archivo sin TRD o TVD convalidadas.',
        sgdea: 'La disposición final exige TRD aplicada, doble aprobación y queda registrada en la bitácora; los radicados no se pueden borrar.',
      },
    ],
  },
  {
    titulo: 'Documento y firma electrónica',
    normas: [
      {
        norma: 'Ley 527 de 1999 — Comercio electrónico',
        regula:
          'Valor probatorio de los mensajes de datos, principio de equivalencia funcional y reconocimiento de la firma electrónica y digital.',
        sgdea:
          'Los documentos nativos digitales y digitalizados se conservan con su fecha, su origen y su checksum; la firma de quien entrega en ventanilla se captura y archiva con el radicado.',
      },
      {
        norma: 'Decreto 2364 de 2012 (compilado en el 1074 de 2015)',
        regula: 'Reglamenta la firma electrónica: métodos y confiabilidad.',
        sgdea: 'Lienzo de firma en la recepción presencial/física, almacenada como evidencia asociada al radicado.',
      },
    ],
  },
  {
    titulo: 'Transparencia y acceso a la información',
    normas: [
      {
        norma: 'Ley 1712 de 2014 — Transparencia y Acceso a la Información Pública',
        regula:
          'Derecho de acceso a la información, registro de activos de información, índice de información clasificada y reservada, y conservación de lo que se produce.',
        sgdea:
          'Consulta y reportes trazables; la información sensible queda acotada por dependencia y por rol.',
      },
      {
        norma: 'Decreto 103 de 2015 (compilado en el 1081 de 2015)',
        regula: 'Reglamenta la Ley 1712: gestión de solicitudes de información y su seguimiento.',
        sgdea: 'Toda solicitud entra como radicado con su término y su semáforo de cumplimiento.',
      },
    ],
  },
  {
    titulo: 'Derecho de petición y términos de respuesta',
    normas: [
      {
        norma: 'Ley 1437 de 2011 (CPACA)',
        regula: 'Procedimiento administrativo: radicación, términos, constancia de recepción y silencio administrativo.',
        sgdea: 'Constancia de radicación con número y fecha; cálculo de vencimiento en días hábiles.',
      },
      {
        norma: 'Ley 1755 de 2015 — Derecho fundamental de petición',
        regula:
          'Términos para resolver: 15 días hábiles como regla general, 10 para peticiones de información y documentos, 30 para consultas; reglas de traslado y de prórroga.',
        sgdea:
          'Los plazos por tipo de comunicación son parámetros de negocio; el sistema cuenta días hábiles con el calendario de festivos y alerta antes del vencimiento.',
      },
    ],
  },
  {
    titulo: 'Protección de datos personales',
    normas: [
      {
        norma: 'Ley 1581 de 2012 y Decreto 1377 de 2013 (compilado en el 1074 de 2015)',
        regula:
          'Tratamiento de datos personales: finalidad, autorización, seguridad y confidencialidad, y derechos del titular.',
        sgdea:
          'Acceso por rol y por dependencia, contraseñas con política y caducidad, doble factor opcional, y bitácora de quién consultó qué.',
      },
    ],
  },
  {
    titulo: 'Modelo de gestión y seguridad de la información',
    normas: [
      {
        norma: 'Decreto 1499 de 2017 — Modelo Integrado de Planeación y Gestión (MIPG)',
        regula: 'La Gestión Documental es una de las políticas de gestión y desempeño institucional.',
        sgdea: 'El sistema es el soporte operativo de esa política.',
      },
      {
        norma: 'ISO/IEC 27001 — Sistema de Gestión de Seguridad de la Información',
        regula: 'Referencia técnica para controlar confidencialidad, integridad y disponibilidad.',
        sgdea: 'Cifrado en tránsito, copias de seguridad con verificación, y registro inalterable de eventos.',
      },
    ],
  },
  {
    titulo: 'Normas técnicas de referencia',
    normas: [
      {
        norma: 'ISO 15489 — Información y documentación. Gestión de documentos',
        regula: 'Principios y requisitos para que un documento sea auténtico, fiable, íntegro y utilizable.',
        sgdea: 'Metadatos de origen, cadena de custodia y no repudio.',
      },
      {
        norma: 'ISO 30300 / 30301 — Sistemas de gestión para los documentos',
        regula: 'Requisitos de un sistema de gestión documental.',
        sgdea: 'Estructura de series, expedientes y disposición.',
      },
      {
        norma: 'MoReq2010 — Requisitos para la gestión de documentos electrónicos',
        regula: 'Referencia internacional de requisitos funcionales para un SGDEA.',
        sgdea: 'Inalterabilidad, trazabilidad y control de acceso.',
      },
      {
        norma: 'NTC 5029 — Medición de archivos',
        regula: 'Método para medir y cuantificar la documentación.',
        sgdea: 'Inventarios y reportes por serie y por dependencia.',
      },
    ],
  },
  {
    titulo: 'Marco propio de Cootracir (entidad del sector solidario)',
    intro:
      'Cootracir es una cooperativa, no una entidad pública. Buena parte de la normativa archivística del Estado se adopta aquí como buena práctica y no por obligación legal directa; su aplicabilidad concreta debe confirmarla el área jurídica.',
    normas: [
      {
        norma: 'Ley 79 de 1988 y Ley 454 de 1998 — Legislación cooperativa y de economía solidaria',
        regula:
          'Régimen de las cooperativas y vigilancia de la Superintendencia de la Economía Solidaria; obligación de conservar actas de asamblea y de consejo, registros de asociados y de aportes.',
        sgdea: 'Esos documentos pueden radicarse y expedientarse con la misma trazabilidad que el resto.',
      },
      {
        norma: 'Ley 336 de 1996 — Estatuto General del Transporte',
        regula: 'Marco de la actividad transportadora; documentación de habilitación, vehículos y conductores.',
        sgdea: 'Historia documental de asociados y vehículos organizada en expedientes.',
      },
    ],
  },
];

function TablaNormas({ normas }: { normas: Norma[] }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: '30%' }}>Norma</th>
            <th style={{ width: '40%' }}>Qué regula</th>
            <th>Cómo se refleja en el SGDEA</th>
          </tr>
        </thead>
        <tbody>
          {normas.map((n) => (
            <tr key={n.norma}>
              <td><strong>{n.norma}</strong></td>
              <td>{n.regula}</td>
              <td>{n.sgdea}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarcoLegal() {
  return (
    <div className="page">
      <h1>Marco legal y normativa</h1>
      <p className="vacio" style={{ textAlign: 'left', padding: 0, marginTop: -8, maxWidth: 760 }}>
        El SGDEA se diseñó para dar soporte a la función archivística y a la gestión de las
        comunicaciones oficiales de Cootracir conforme a la normativa colombiana. Este es el
        marco de referencia sobre el que se construyó y en el que se apoya legalmente.
      </p>

      <Card title="Norma principal">
        <div className="tablewrap">
          <table>
            <tbody>
              <tr>
                <td style={{ width: '30%' }}><strong>{PRINCIPAL.norma}</strong></td>
                <td>{PRINCIPAL.regula}</td>
              </tr>
              <tr>
                <td><strong>En el SGDEA</strong></td>
                <td>{PRINCIPAL.sgdea}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {GRUPOS.map((g) => (
        <Card key={g.titulo} title={g.titulo}>
          {g.intro && (
            <p className="vacio" style={{ textAlign: 'left', padding: 0, marginBottom: 10 }}>{g.intro}</p>
          )}
          <TablaNormas normas={g.normas} />
        </Card>
      ))}

      <Card title="Nota sobre la aplicabilidad">
        <p>
          La obligatoriedad de cada norma depende de la naturaleza jurídica de la entidad. Cootracir,
          como cooperativa del sector solidario, no es un sujeto obligado del Estado; adopta este
          marco como estándar de buena práctica en gestión documental y como respaldo de la
          integridad y el valor probatorio de sus documentos.
        </p>
        <p>
          Se recomienda mantener una <strong>matriz de requisitos normativos</strong> revisada con el
          área jurídica y con el asesor en gestión documental, y actualizarla cuando cambie la
          reglamentación del AGN.
        </p>
      </Card>
    </div>
  );
}
