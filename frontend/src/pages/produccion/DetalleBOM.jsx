import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaCheckCircle, FaCopy, FaEdit, FaTimesCircle, FaTrash } from 'react-icons/fa';
import {
  OperationEmptyState,
  OperationHeader,
  OperationSectionTitle,
  OperationStat,
  operationContainerClass,
  operationDangerButtonClass,
  operationPageClass,
  operationSecondaryButtonClass,
  operationTableShellClass,
} from '../../components/operation/OperationUI';
import * as bomService from '../../services/bomService';
import { notify } from '../../services/notify';

const currency = (value, digits = 2) => `$${Number(value || 0).toFixed(digits)}`;

const DetalleBOM = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [variacionCostos, setVariacionCostos] = useState(null);

  useEffect(() => {
    cargarDetalle();
  }, [id]);

  const cargarDetalle = async () => {
    try {
      setLoading(true);
      const [detalleRes, variacionRes] = await Promise.all([
        bomService.getBOMDetalle(id),
        bomService.getVariacionCostosBOM(id).catch(() => ({ data: null })),
      ]);
      setData(detalleRes.data);
      setVariacionCostos(variacionRes?.data || null);
    } catch (error) {
      console.error('Error al cargar detalle:', error);
      notify('Error al cargar detalle del BOM', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClonar = async () => {
    const nuevaVersion = window.prompt('Ingrese el número de la nueva versión:');
    if (!nuevaVersion) return;

    try {
      const response = await bomService.clonarBOM(id, Number.parseInt(nuevaVersion, 10));
      notify('BOM clonado correctamente', 'success');
      navigate(`/produccion/bom/${response.data.BOM_Id}`);
    } catch (error) {
      console.error('Error al clonar BOM:', error);
      notify('Error al clonar BOM', 'error');
    }
  };

  const handleEliminarOperacion = async (operacionId) => {
    const ok = window.confirm('¿Quitar esta operación de la receta?');
    if (!ok) return;
    try {
      await bomService.deleteOperacionBOM(operacionId);
      notify('Operación eliminada correctamente', 'success');
      cargarDetalle();
    } catch (error) {
      console.error('Error eliminando operación:', error);
      notify(error.response?.data?.message || 'No se pudo eliminar la operación', 'error');
    }
  };

  if (loading) {
    return (
      <div className={operationPageClass}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={operationPageClass}>
        <div className={`${operationContainerClass} flex min-h-screen items-center justify-center`}>
          <OperationEmptyState title="BOM no encontrado" description="No fue posible recuperar el detalle de esta receta." />
        </div>
      </div>
    );
  }

  const { bom, materiales, operaciones } = data;
  const costoActual = Number(variacionCostos?.resumen?.costoTotalActual || 0);
  const costoPrevio = Number(variacionCostos?.resumen?.costoTotalPrevio || 0);
  const variacionAbs = Number(variacionCostos?.resumen?.variacionAbs || 0);
  const variacionPct = variacionCostos?.resumen?.variacionPct;

  return (
    <div className={operationPageClass}>
      <div className={operationContainerClass}>
        <OperationHeader
          eyebrow="Producción"
          title={bom.CodigoBOM}
          description={`Versión ${bom.Version} · ${bom.ProductoNombre} · ${bom.Vigente ? 'vigente' : 'obsoleta'}`}
          actions={
            <>
              <button onClick={() => navigate('/produccion/bom')} className={operationSecondaryButtonClass}>
                <FaArrowLeft className="text-xs" /> Volver
              </button>
              <button onClick={() => navigate(`/produccion/bom/${id}/editar`)} className={operationSecondaryButtonClass}>
                <FaEdit className="text-xs" /> Editar
              </button>
              <button
                onClick={handleClonar}
                className="inline-flex items-center justify-center rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <FaCopy className="text-xs" /> Clonar
              </button>
            </>
          }
          stats={[
            <OperationStat key="producto" label="Producto" value={bom.SKU || '-'} tone="blue" />,
            <OperationStat key="materiales" label="Materiales" value={materiales.length} tone="amber" />,
            <OperationStat key="operaciones" label="Operaciones" value={operaciones.length} tone="slate" />,
            <OperationStat key="merma" label="Merma esperada" value={`${bom.MermaPct || 0}%`} tone="emerald" />,
          ]}
        />

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
            <OperationSectionTitle
              eyebrow="Perfil"
              title="Información general"
              description="Producto objetivo, vigencia, control de mermas y metadatos base de la receta."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Producto</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{bom.ProductoNombre}</p>
                <p className="text-xs text-slate-400">{bom.SKU}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Estado</p>
                <div className="mt-1">
                  {bom.Vigente ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      <FaCheckCircle className="text-[10px]" /> Vigente
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                      <FaTimesCircle className="text-[10px]" /> Obsoleto
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Merma esperada</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{bom.MermaPct}%</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Fecha creación</p>
                <p className="mt-1 text-sm text-slate-700">
                  {bom.FechaCreacion ? new Date(bom.FechaCreacion).toLocaleDateString('es-MX') : '-'}
                </p>
              </div>
              {bom.Descripcion ? (
                <div className="md:col-span-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Descripción</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{bom.Descripcion}</p>
                </div>
              ) : null}
            </div>
          </div>

          {variacionCostos?.variaciones ? (
            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
              <OperationSectionTitle
                eyebrow="Costo"
                title="Variación contra versión previa"
                description={
                  variacionCostos?.bomPrevio
                    ? `Comparado contra la versión ${variacionCostos.bomPrevio.Version}`
                    : 'Sin versión previa para comparación'
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Costo actual</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{currency(costoActual)}</p>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Costo previo</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{currency(costoPrevio)}</p>
                </div>
                <div className="rounded-[18px] border border-violet-200 bg-violet-50 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Variación absoluta</p>
                  <p className={`mt-2 text-xl font-semibold ${variacionAbs >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {currency(variacionAbs)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-sky-200 bg-sky-50 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Variación %</p>
                  <p className={`mt-2 text-xl font-semibold ${Number(variacionPct || 0) >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {variacionPct == null ? 'N/A' : `${Number(variacionPct).toFixed(2)}%`}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className={operationTableShellClass}>
          <div className="border-b border-[#e7edf6] px-6 py-4">
            <OperationSectionTitle eyebrow="BOM" title={`Materiales (${materiales.length})`} description="Composición teórica por materia prima, unidad, tipo de componente y merma." />
          </div>
          {materiales.length === 0 ? (
            <div className="p-6">
              <OperationEmptyState title="Sin materiales registrados" description="Agrega componentes en la receta para construir el consumo teórico del producto." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#e7edf6]">
                    {['Código', 'Materia prima', 'Cantidad', 'Unidad', 'Tipo', 'Merma %'].map((header) => (
                      <th key={header} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materiales.map((mat, index) => (
                    <tr key={`${mat.MateriaPrima_Id}-${index}`} className="border-t border-[#eef2f8] transition hover:bg-[#f7faff]">
                      <td className="px-4 py-4 pl-6 text-sm text-slate-600">{mat.MateriaCodigo}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">{mat.MateriaNombre}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{mat.CantidadTeorica}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{mat.UnidadMedida || '-'}</td>
                      <td className="px-4 py-4 text-sm">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          mat.TipoComponente === 'Principal' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}>
                          {mat.TipoComponente}
                        </span>
                      </td>
                      <td className="px-4 py-4 pr-6 text-sm text-slate-600">{mat.MermaPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {variacionCostos?.variaciones ? (
          <div className={operationTableShellClass}>
            <div className="border-b border-[#e7edf6] px-6 py-4">
              <OperationSectionTitle eyebrow="Comparativo" title="Variación por materia prima" description="Impacto de costo actual contra la versión inmediata anterior de la receta." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#e7edf6]">
                    {['Materia', 'Costo unitario', 'Costo actual', 'Costo previo', 'Variación'].map((header) => (
                      <th key={header} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variacionCostos.variaciones.map((row) => (
                    <tr key={row.MateriaPrima_Id} className="border-t border-[#eef2f8] transition hover:bg-[#f7faff]">
                      <td className="px-4 py-4 pl-6">
                        <div className="text-sm font-semibold text-slate-900">{row.MateriaNombre || `MP #${row.MateriaPrima_Id}`}</div>
                        <div className="text-xs text-slate-400">{row.MateriaCodigo || '-'}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{currency(row.CostoUnitarioActual, 4)}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{currency(row.CostoActual)}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{currency(row.CostoPrevio)}</td>
                      <td className={`px-4 py-4 pr-6 text-sm font-semibold ${Number(row.VariacionAbs || 0) >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {currency(row.VariacionAbs)}
                        <span className="ml-2 text-xs font-medium">
                          ({row.VariacionPct == null ? 'N/A' : `${Number(row.VariacionPct).toFixed(2)}%`})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className={operationTableShellClass}>
          <div className="border-b border-[#e7edf6] px-6 py-4">
            <OperationSectionTitle eyebrow="Proceso" title={`Operaciones y costos (${operaciones.length})`} description="Secuencia operativa, tiempo por unidad y referencia económica de cada etapa." />
          </div>
          {operaciones.length === 0 ? (
            <div className="p-6">
              <OperationEmptyState title="Sin operaciones registradas" description="Agrega operaciones para estimar tiempos y costos del proceso productivo." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#e7edf6]">
                    {['Secuencia', 'Operación', 'Tipo costo', 'Min/Unidad', 'Costo/Unidad', 'Costo Hora', 'Acciones'].map((header) => (
                      <th key={header} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {operaciones.map((op, index) => (
                    <tr key={`${op.BOM_Operacion_Id || index}`} className="border-t border-[#eef2f8] transition hover:bg-[#f7faff]">
                      <td className="px-4 py-4 pl-6 text-sm text-slate-600">{index + 1}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">{op.Notas || '-'}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{op.TipoCosto}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{op.MinutosPorUnidad}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{currency(op.CostoPorUnidad)}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{currency(op.CostoHoraReferencia)}</td>
                      <td className="px-4 py-4 pr-6">
                        <button onClick={() => handleEliminarOperacion(op.BOM_Operacion_Id)} className={operationDangerButtonClass} title="Quitar operación">
                          <FaTrash className="text-xs" /> Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetalleBOM;
