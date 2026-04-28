import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../../components/Modal';
import {
  OperationEmptyState,
  OperationSectionTitle,
  OperationStat,
  operationPrimaryButtonClass,
  operationSecondaryButtonClass,
  operationTableShellClass,
} from '../../components/operation/OperationUI';
import api from '../../services/api';
import { notify } from '../../services/notify';
import ModalCerrarOrden from './ModalCerrarOrden';

const currency = (value) => `$${Number(value || 0).toFixed(2)}`;

const estadoClasses = {
  EN_ESPERA: 'border-amber-200 bg-amber-50 text-amber-700',
  APROBADO_PTC: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  RECHAZADO_PTC: 'border-rose-200 bg-rose-50 text-rose-700',
  EN_PROCESO: 'border-sky-200 bg-sky-50 text-sky-700',
  TERMINADA: 'border-violet-200 bg-violet-50 text-violet-700',
  CERRADA: 'border-slate-200 bg-slate-50 text-slate-700',
  CANCELADA: 'border-rose-200 bg-rose-50 text-rose-700',
};

export default function DetalleOrdenProduccion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orden, setOrden] = useState(null);
  const [bom, setBom] = useState(null);
  const [materiales, setMateriales] = useState([]);
  const [operaciones, setOperaciones] = useState([]);
  const [consumos, setConsumos] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [modalCerrarOpen, setModalCerrarOpen] = useState(false);
  const [previewCierre, setPreviewCierre] = useState(null);

  const fetchDetalle = async () => {
    setLoading(true);
    try {
      const [res, previewRes] = await Promise.all([
        api.get(`/produccion/ordenes/${id}`),
        api.get(`/produccion/ordenes/${id}/preview-cierre`).catch(() => ({ data: { data: null } })),
      ]);

      const data = res.data?.data || {};

      setOrden(data.orden || data);
      setBom(data.bom || null);
      setMateriales(data.materiales || []);
      setOperaciones(data.operaciones || []);
      setConsumos(data.consumos || []);
      setResultado(data.resultado || null);
      setPreviewCierre(previewRes?.data?.data || null);
    } catch (err) {
      console.error('Error cargando detalle', err);
      notify('Error al cargar detalle de la orden', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetalle();
  }, [id]);

  const eficiencia = useMemo(() => {
    if (!resultado || !orden?.CantidadPlanificada) return 0;
    return Math.round((resultado.PiezasBuenas / orden.CantidadPlanificada) * 100);
  }, [resultado, orden]);

  const tasaMerma = useMemo(() => {
    if (!resultado) return 0;
    const total = Number(resultado.PiezasBuenas || 0) + Number(resultado.PiezasMerma || 0);
    return total > 0 ? Math.round((Number(resultado.PiezasMerma || 0) / total) * 100) : 0;
  }, [resultado]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/45">
        <div className="flex min-h-full items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-white/25 border-t-white animate-spin" />
        </div>
      </div>
    );
  }

  if (!orden) {
    return (
      <div className="fixed inset-0 z-50 bg-black/45">
        <div className="flex min-h-full items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-[28px] border border-white/50 bg-white p-8 shadow-[0_24px_70px_rgba(15,45,93,0.25)]">
            <OperationEmptyState title="Orden no encontrada" description="No fue posible recuperar el detalle de esta orden de producción." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] overflow-auto">
      <div className="min-h-screen p-0 sm:p-4">
        <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col overflow-hidden rounded-none sm:min-h-0 sm:rounded-[30px] border border-white/40 bg-[linear-gradient(180deg,#f9fbff_0%,#f2f6fc_100%)] shadow-[0_30px_80px_rgba(15,45,93,0.28)]">
          <div className="bg-[linear-gradient(135deg,#0f2556,#1d417f_55%,#2e68b4)] px-5 py-5 text-white sm:px-6 sm:py-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-100/75">Producción</p>
                <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">Detalle OP: {orden.NumeroOP}</h2>
                <p className="mt-2 text-sm text-blue-100/80">
                  Información completa de la orden, consumo teórico y real, costos y resultado final de producción.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => navigate('/produccion/ordenes')} className={operationSecondaryButtonClass}>
                  Cerrar
                </button>
                {orden.Estado === 'TERMINADA' && !resultado ? (
                  <button onClick={() => setModalCerrarOpen(true)} className={operationPrimaryButtonClass}>
                    Registrar consumos y cerrar OP
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <OperationStat key="estado" label="Estado" value={orden.Estado} tone="amber" />
              <OperationStat key="planificada" label="Cantidad planificada" value={orden.CantidadPlanificada} tone="blue" />
              <OperationStat key="producida" label="Cantidad producida" value={orden.CantidadProducida || 0} tone="emerald" />
              <OperationStat key="merma" label="Merma" value={orden.MermaUnidades || 0} tone="rose" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
                <OperationSectionTitle eyebrow="Perfil" title="Información general" description="Resumen ejecutivo de la OP, empresa productora y datos de control." />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Estado</p>
                    <div className="mt-1">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${estadoClasses[orden.Estado] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                        {orden.Estado}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Producto</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{orden.ProductoNombre || `Producto #${orden.Producto_Id}`}</p>
                    {orden.SKU ? <p className="text-xs text-slate-400">SKU: {orden.SKU}</p> : null}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Prioridad</p>
                    <p className="mt-1 text-sm text-slate-700">{orden.Prioridad}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Empresa productora</p>
                    <p className="mt-1 text-sm text-slate-700">{orden.EmpresaProductora || `Empresa #${orden.Company_Id}`}</p>
                  </div>
                  {orden.CompanySolicitante_Id && orden.CompanySolicitante_Id !== orden.Company_Id ? (
                    <div className="md:col-span-2 rounded-[18px] border border-sky-200 bg-sky-50 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">Empresa solicitante</p>
                      <p className="mt-1 text-sm font-semibold text-sky-900">{orden.EmpresaSolicitante || `Empresa #${orden.CompanySolicitante_Id}`}</p>
                      <p className="mt-1 text-xs text-sky-700">La transferencia se ejecuta al cierre si la producción queda liberada.</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Fecha creación</p>
                    <p className="mt-1 text-sm text-slate-700">{orden.FechaCreacion ? new Date(orden.FechaCreacion).toLocaleString('es-MX') : '-'}</p>
                  </div>
                  {orden.FechaFin ? (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Fecha fin</p>
                      <p className="mt-1 text-sm text-slate-700">{new Date(orden.FechaFin).toLocaleString('es-MX')}</p>
                    </div>
                  ) : null}
                  {orden.Notas ? (
                    <div className="md:col-span-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Notas</p>
                      <p className="mt-1 rounded-[18px] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{orden.Notas}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {previewCierre?.resumen ? (
                <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
                  <OperationSectionTitle eyebrow="Cierre" title="Resumen teórico de producción" description="Costeo esperado antes del cierre final y comparación rápida de margen estimado." />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Costo material teórico</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">{currency(previewCierre.resumen.costoMaterialTeorico)}</p>
                    </div>
                    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Costo operación teórico</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">{currency(previewCierre.resumen.costoOperacionTeorico)}</p>
                    </div>
                    <div className="rounded-[18px] border border-violet-200 bg-violet-50 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Costo total teórico</p>
                      <p className="mt-2 text-xl font-semibold text-violet-800">{currency(previewCierre.resumen.costoTotalTeorico)}</p>
                    </div>
                    <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Margen teórico</p>
                      <p className={`mt-2 text-xl font-semibold ${Number(previewCierre.resumen.margenTeorico || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {currency(previewCierre.resumen.margenTeorico)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {bom ? (
              <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
                <OperationSectionTitle eyebrow="BOM" title="Receta vinculada" description="Versión activa y merma base utilizada para esta orden de producción." />
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Código BOM</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{bom.CodigoBOM || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Versión</p>
                    <p className="mt-1 text-sm text-slate-700">{bom.Version}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Merma %</p>
                    <p className="mt-1 text-sm text-slate-700">{bom.MermaPct || 0}%</p>
                  </div>
                  {bom.Descripcion ? (
                    <div className="md:col-span-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Descripción</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{bom.Descripcion}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {materiales.length > 0 ? (
              <div className={operationTableShellClass}>
                <div className="border-b border-[#e7edf6] px-6 py-4">
                  <OperationSectionTitle eyebrow="BOM" title={`Materiales requeridos (${materiales.length})`} description="Consumo teórico base que alimenta el cierre y la comparación contra consumo real." />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#e7edf6]">
                        {['Materia prima', 'Cantidad teórica', 'Tipo componente', 'Merma %', 'Notas'].map((header) => (
                          <th key={header} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {materiales.map((mat, idx) => (
                        <tr key={`${mat.MateriaPrima_Id}-${idx}`} className="border-t border-[#eef2f8] transition hover:bg-[#f7faff]">
                          <td className="px-4 py-4 pl-6 text-sm font-semibold text-slate-900">{mat.MateriaNombre || `MP #${mat.MateriaPrima_Id}`}</td>
                          <td className="px-4 py-4 text-sm text-slate-600">{mat.CantidadTeorica}</td>
                          <td className="px-4 py-4 text-sm text-slate-600">{mat.TipoComponente || '-'}</td>
                          <td className="px-4 py-4 text-sm text-slate-600">{mat.MermaPct || 0}%</td>
                          <td className="px-4 py-4 pr-6 text-sm text-slate-500">{mat.Notas || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {operaciones.length > 0 ? (
              <div className={operationTableShellClass}>
                <div className="border-b border-[#e7edf6] px-6 py-4">
                  <OperationSectionTitle eyebrow="Proceso" title={`Operaciones de producción (${operaciones.length})`} description="Tiempo, costo unitario y referencia económica por operación asociada a esta OP." />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#e7edf6]">
                        {['Tipo costo', 'Costo por unidad', 'Minutos por unidad', 'Costo hora ref.', 'Notas'].map((header) => (
                          <th key={header} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {operaciones.map((op, idx) => (
                        <tr key={`${op.BOM_Operacion_Id || idx}`} className="border-t border-[#eef2f8] transition hover:bg-[#f7faff]">
                          <td className="px-4 py-4 pl-6 text-sm font-semibold text-slate-900">{op.TipoCosto}</td>
                          <td className="px-4 py-4 text-sm text-slate-600">{currency(op.CostoPorUnidad)}</td>
                          <td className="px-4 py-4 text-sm text-slate-600">{op.MinutosPorUnidad || 0} min</td>
                          <td className="px-4 py-4 text-sm text-slate-600">{currency(op.CostoHoraReferencia)}</td>
                          <td className="px-4 py-4 pr-6 text-sm text-slate-500">{op.Notas || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {consumos.length > 0 ? (
              <div className={operationTableShellClass}>
                <div className="border-b border-[#e7edf6] px-6 py-4">
                  <OperationSectionTitle eyebrow="Real" title={`Consumos reales (${consumos.length})`} description="Material efectivamente usado, merma registrada y usuario que capturó el consumo." />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#e7edf6]">
                        {['Materia prima', 'Cant. teórica', 'Cant. real', 'Unidad', 'Merma', 'Fecha registro', 'Registrado por'].map((header) => (
                          <th key={header} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {consumos.map((cons, idx) => (
                        <tr key={`${cons.MateriaPrima_Id}-${idx}`} className="border-t border-[#eef2f8] transition hover:bg-[#f7faff]">
                          <td className="px-4 py-4 pl-6 text-sm font-semibold text-slate-900">{cons.MateriaCodigo || `MP #${cons.MateriaPrima_Id}`}</td>
                          <td className="px-4 py-4 text-sm text-slate-600">{cons.CantidadTeorica}</td>
                          <td className="px-4 py-4 text-sm font-semibold text-slate-800">{cons.CantidadReal}</td>
                          <td className="px-4 py-4 text-sm text-slate-600">{cons.UnidadConsumo}</td>
                          <td className="px-4 py-4 text-sm text-rose-700">{cons.MermaCantidad || 0}</td>
                          <td className="px-4 py-4 text-sm text-slate-600">{cons.FechaRegistro ? new Date(cons.FechaRegistro).toLocaleString('es-MX') : '-'}</td>
                          <td className="px-4 py-4 pr-6 text-sm text-slate-500">{cons.RegistradoPor || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {resultado ? (
              <div className="rounded-[28px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(220,252,231,0.94))] p-5 shadow-[0_18px_40px_rgba(22,101,52,0.08)]">
                <OperationSectionTitle eyebrow="Cierre" title="Resultado de producción" description="Salida final, eficiencia, merma e información de transferencia y cierre operativo." />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[18px] border border-emerald-200 bg-white/80 px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Piezas buenas</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-800">{resultado.PiezasBuenas}</p>
                  </div>
                  <div className="rounded-[18px] border border-rose-200 bg-white/80 px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-700">Piezas merma</p>
                    <p className="mt-2 text-2xl font-semibold text-rose-800">{resultado.PiezasMerma || 0}</p>
                  </div>
                  <div className="rounded-[18px] border border-sky-200 bg-white/80 px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">Eficiencia</p>
                    <p className="mt-2 text-2xl font-semibold text-sky-800">{eficiencia}%</p>
                  </div>
                  <div className="rounded-[18px] border border-amber-200 bg-white/80 px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">Tasa de merma</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-800">{tasaMerma}%</p>
                  </div>
                </div>

                {orden.Estado === 'CERRADA' && orden.CompanySolicitante_Id && orden.CompanySolicitante_Id !== orden.Company_Id ? (
                  <div className="mt-4 rounded-[20px] border border-sky-200 bg-sky-50 px-4 py-4">
                    <p className="text-sm font-semibold text-sky-900">Transferencia automática al solicitante</p>
                    <p className="mt-1 text-sm text-sky-800">
                      <strong>{Math.min(resultado.PiezasBuenas, orden.CantidadPlanificada)}</strong> de {orden.CantidadPlanificada} unidades solicitadas se transfirieron al almacén de{' '}
                      <strong>{orden.EmpresaSolicitante || `Empresa #${orden.CompanySolicitante_Id}`}</strong>.
                    </p>
                    {resultado.PiezasBuenas > orden.CantidadPlanificada ? (
                      <p className="mt-1 text-xs text-sky-700">
                        {resultado.PiezasBuenas - orden.CantidadPlanificada} unidades excedentes permanecen en almacén de producción.
                      </p>
                    ) : null}
                    {resultado.PiezasBuenas < orden.CantidadPlanificada ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Se solicitaron {orden.CantidadPlanificada} pero solo se produjeron {resultado.PiezasBuenas}.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {resultado.Comentarios ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Comentarios</p>
                    <p className="mt-1 rounded-[18px] bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700">{resultado.Comentarios}</p>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Operador de cierre</p>
                    <p className="mt-1 text-sm text-slate-700">{resultado.OperadorCierre || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Fecha de cierre</p>
                    <p className="mt-1 text-sm text-slate-700">{resultado.FechaCierre ? new Date(resultado.FechaCierre).toLocaleString('es-MX') : '-'}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {orden.Estado === 'TERMINADA' && !resultado ? (
              <div className="rounded-[28px] border border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(254,243,199,0.94))] p-5 shadow-[0_18px_40px_rgba(180,120,0,0.08)]">
                <OperationSectionTitle eyebrow="Pendiente" title="Acción requerida" description="La OP ya terminó su ejecución y necesita cerrar consumos y resultado final para impactar inventario." />
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setModalCerrarOpen(true)} className={operationPrimaryButtonClass}>
                    Registrar consumos y cerrar OP
                  </button>
                  <button onClick={() => navigate('/produccion/ordenes')} className={operationSecondaryButtonClass}>
                    Volver al listado
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Modal isOpen={modalCerrarOpen} onClose={() => setModalCerrarOpen(false)} title="Cerrar Orden de Producción" size="xl">
        <ModalCerrarOrden
          orden={orden}
          materiales={materiales}
          previewCierre={previewCierre}
          onClose={() => setModalCerrarOpen(false)}
          onSuccess={() => {
            setModalCerrarOpen(false);
            fetchDetalle();
          }}
        />
      </Modal>
    </div>
  );
}
