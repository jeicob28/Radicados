// Selector guiado de clasificación archivística: dependencia productora → serie
// → subserie, según el cuadro de clasificación documental (TRD). Reúne en un
// solo sitio las reglas de la norma (Acuerdo 001 de 2024 del AGN):
//  - todo expediente se abre bajo una serie;
//  - si la serie tiene subseries, la subserie es OBLIGATORIA;
//  - la oficina productora del expediente es la de la serie.
import { api } from '../api';
import { Field, useAsync } from '../ui';

interface TrdRegla {
  archivoGestion: number;
  archivoCentral: number;
  disposicionFinal: string;
}
export interface SubserieTRD {
  id: string;
  codigo: string;
  nombre: string;
  trd: TrdRegla;
}
export interface SerieTRD {
  id: string;
  codigo: string;
  nombre: string;
  dependenciaId: string;
  dependencia: { codigo: string; nombre: string };
  trd: TrdRegla;
  subseries: SubserieTRD[];
}

export function useCuadroClasificacion() {
  return useAsync<SerieTRD[]>(() => api('/trd'), []);
}

export function subserieObligatoria(serie?: SerieTRD | null): boolean {
  return !!serie && serie.subseries.length > 0;
}

export function codigoClasificacion(serie?: SerieTRD | null, subserie?: SubserieTRD | null): string {
  if (!serie) return '';
  return subserie ? `${serie.codigo}.${subserie.codigo}` : serie.codigo;
}

const DISPOSICION: Record<string, string> = {
  CONSERVACION_TOTAL: 'Conservación total',
  ELIMINACION: 'Eliminación',
  SELECCION: 'Selección',
  MICROFILMACION_DIGITALIZACION: 'Microfilmación / digitalización',
};

/**
 * Valida la selección contra la norma. Devuelve el mensaje de error o `null`.
 */
export function validarClasificacion(serie?: SerieTRD | null, subserie?: SubserieTRD | null): string | null {
  if (!serie) return 'Seleccione la serie documental.';
  if (subserieObligatoria(serie) && !subserie) {
    return 'Esta serie tiene subseries: seleccione la subserie que corresponde (lo exige la TRD).';
  }
  return null;
}

export function SelectorSerieSubserie({
  cuadro,
  serieId,
  subserieId,
  onSerie,
  onSubserie,
  dependenciaFiltroId,
  cargando,
}: {
  cuadro: SerieTRD[] | null | undefined;
  serieId: string;
  subserieId: string;
  onSerie: (id: string) => void;
  onSubserie: (id: string) => void;
  /** Si se indica, las series de esa dependencia se listan primero. */
  dependenciaFiltroId?: string;
  cargando?: boolean;
}) {
  const series = [...(cuadro ?? [])].sort((a, b) => {
    if (dependenciaFiltroId) {
      const am = a.dependenciaId === dependenciaFiltroId ? 0 : 1;
      const bm = b.dependenciaId === dependenciaFiltroId ? 0 : 1;
      if (am !== bm) return am - bm;
    }
    return `${a.dependencia.codigo}${a.codigo}`.localeCompare(`${b.dependencia.codigo}${b.codigo}`);
  });
  const serie = series.find((s) => s.id === serieId) ?? null;
  const subserie = serie?.subseries.find((ss) => ss.id === subserieId) ?? null;
  const regla = subserie?.trd ?? serie?.trd;
  const obligatoria = subserieObligatoria(serie);

  return (
    <>
      <Field
        label="Serie documental"
        hint={cargando ? 'Cargando cuadro de clasificación…' : 'Cuadro de clasificación documental (TRD) de la entidad'}
      >
        <select
          value={serieId}
          onChange={(e) => {
            onSerie(e.target.value);
            onSubserie('');
          }}
        >
          <option value="">— seleccione la serie —</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.dependencia.codigo} · {s.codigo} · {s.nombre}
            </option>
          ))}
        </select>
      </Field>

      {serie && (
        <Field
          label={obligatoria ? 'Subserie documental (obligatoria)' : 'Subserie documental'}
          hint={
            obligatoria
              ? 'La serie tiene subseries; la norma exige clasificar en la subserie.'
              : 'Esta serie no tiene subseries: el expediente queda a nivel de serie.'
          }
        >
          <select value={subserieId} onChange={(e) => onSubserie(e.target.value)} disabled={!serie.subseries.length}>
            <option value="">
              {serie.subseries.length ? '— seleccione la subserie —' : 'sin subseries'}
            </option>
            {serie.subseries.map((ss) => (
              <option key={ss.id} value={ss.id}>
                {ss.codigo} · {ss.nombre}
              </option>
            ))}
          </select>
        </Field>
      )}

      {serie && regla && (
        <div className="trd-resumen">
          <div>
            <span className="trd-k">Oficina productora</span>
            <span>{serie.dependencia.codigo} · {serie.dependencia.nombre}</span>
          </div>
          <div>
            <span className="trd-k">Código de clasificación</span>
            <span className="mono">{codigoClasificacion(serie, subserie)}</span>
          </div>
          <div>
            <span className="trd-k">Retención</span>
            <span>
              {regla.archivoGestion} año(s) en archivo de gestión · {regla.archivoCentral} año(s) en archivo central
            </span>
          </div>
          <div>
            <span className="trd-k">Disposición final</span>
            <span>{DISPOSICION[regla.disposicionFinal] ?? regla.disposicionFinal}</span>
          </div>
        </div>
      )}
    </>
  );
}
