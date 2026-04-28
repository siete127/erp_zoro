import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';
import { socket } from '../../services/socket';
import {
  operationContainerClass,
  operationPageClass,
  operationSecondaryButtonClass,
  OperationHeader,
  OperationStat,
} from '../../components/operation/OperationUI';

const CLASIFICACION_LABELS = {
  MATERIA_PRIMA: { label: 'Materia Prima', color: 'bg-yellow-100 text-yellow-800' },
  PRODUCTO_TERMINADO: { label: 'Prod. Terminado', color: 'bg-green-100 text-green-800' },
  PRODUCTO_REVENTA: { label: 'Reventa', color: 'bg-blue-100 text-blue-800' },
};

function ClasificacionBadge({ value }) {
  const cfg = CLASIFICACION_LABELS[value] || { label: value || '-', color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export default function RecepcionPendiente() {
  const navigate = useNavigate();
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [filtroCompany, setFiltroCompany] = useState('all');

  // Modal recepcion manual
  const [modalRow, setModalRow] = useState(null);
  const [form, setForm] = useState({ cantidad: '', observaciones: '' });
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const fetchPendientes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroCompany !== 'all') params.append('company_id', filtroCompany);
      const res = await api.get(`/inventario/recepcion/pendientes?${params}`);
      setPendientes(res.data?.data || res.data || []);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error cargando pendientes', 'error');
    } finally {
      setLoading(false);
    }
  }, [filtroCompany]);

  useEffect(() => { fetchPendientes(); }, [fetchPendientes]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await api.get('/companies/');
        setCompanies(res.data || []);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setUserRole(user.RolId);
      } catch {
        setCompanies([]);
      }
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    const handler = () => fetchPendientes();
    socket.on('inventario:recepcion-produccion', handler);
    return () => socket.off('inventario:recepcion-produccion', handler);
  }, [fetchPendientes]);

  const openModal = (row) => {
    setModalRow(row);
    setForm({ cantidad: row.CantidadProducida ?? row.CantidadPlanificada ?? '', observaciones: '' });
  };

  const handleRecepcionar = async (e) => {
    e.preventDefault();
    if (!modalRow) return;
    setSubmitting(true);
    try {
      await api.post('/inventario/recepcion/registrar', {
        OP_Id: modalRow.OP_Id,
        Cantidad: Number(form.cantidad),
        Almacen_Id: modalRow.AlmacenSugerido_Id || undefined,
        Observaciones: form.observaciones || undefined,
      });
      notify(`Recepcion registrada para ${modalRow.NombreProducto}`, 'success');
      setModalRow(null);
      setForm({ cantidad: '', observaciones: '' });
      fetchPendientes();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al registrar recepcion', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelarRecepcion = async () => {
    if (!modalRow) return;
    const motivo = String(form.observaciones || '').trim();
    if (!motivo) {
      notify('Escribe el motivo de cancelacion por producto incompleto', 'warning');
      return;
    }

    setCanceling(true);
    try {
      await api.post('/inventario/recepcion/cancelar', {
        OP_Id: modalRow.OP_Id,
        MotivoCancelacion: motivo,
      });
      notify(`Entrada cancelada para ${modalRow.NombreProducto}`, 'success');
      setModalRow(null);
      setForm({ cantidad: '', observaciones: '' });
      fetchPendientes();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al cancelar la entrada', 'error');
    } finally {
      setCanceling(false);
    }
  };

  const isAdmin = userRole === 1 || userRole === 2;
  const totalPendientes = pendientes.length;

  return (
    <div className={operationPageClass}>
      <div className={operationContainerClass}>
      <OperationHeader
        eyebrow="Operacion"
        title="Recepciones Pendientes"
        description="Ordenes terminadas que aun no han sido recibidas en almacen, con registro rapido de entrada."
        actions={<button onClick={fetchPendientes} className={operationSecondaryButtonClass}>Actualizar</button>}
        stats={
          <>
            <OperationStat label="Pendientes" value={totalPendientes} tone={totalPendientes > 0 ? 'amber' : 'emerald'} />
            <OperationStat label="Empresa filtro" value={filtroCompany === 'all' ? 'Todas' : String(filtroCompany)} tone="slate" />
          </>
        }
      />
      <section className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(245,248,255,0.93)_100%)] p-5 sm:p-6 lg:p-8 shadow-[0_8px_30px_rgba(15,45,93,0.09)] overflow-hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              onClick={() => navigate('/productos/inventario')}
              className="inline-flex items-center gap-1.5 text-sm text-[#092052] hover:text-[#15367a] font-medium mb-2"
            >
              <span>{"\u2190"}</span>
              <span>Volver a Inventario</span>
            </button>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Recepciones Pendientes</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Ordenes de produccion terminadas cuyo producto aun no ha sido recibido en almacen.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className={`rounded-2xl border px-4 py-4 shadow-sm ${
            totalPendientes > 0
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">Pendientes</div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-extrabold leading-none">{totalPendientes}</span>
                <span className="pb-1 text-sm font-medium">
                  {totalPendientes === 1 ? 'orden por recibir' : 'órdenes por recibir'}
                </span>
              </div>
              <div className="mt-2 text-sm">
                {totalPendientes > 0 ? 'Requieren entrada de almacén.' : 'No hay recepciones por registrar.'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estado</div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
                <span>{totalPendientes > 0 ? '⚠' : '✓'}</span>
                <span>{totalPendientes > 0 ? 'Recepciones pendientes' : 'Flujo al día'}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">Consulta y registra entradas cerradas de producción desde una sola vista.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:col-span-2 xl:col-span-1">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumen</div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                <span>📦</span>
                <span>Recepciones por registrar</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">La lista se actualiza manualmente y también reacciona a eventos del sistema.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Empresa
            </label>
            {isAdmin ? (
              <select
                value={filtroCompany}
                onChange={(e) => setFiltroCompany(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#092052]/20"
              >
                <option value="all">Todas las empresas</option>
                {companies.map(c => (
                  <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>
                ))}
              </select>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                El filtro por empresa está disponible para usuarios administradores.
              </div>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Usa este filtro para revisar pendientes por razón social sin perder contexto del listado.
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 h-5 w-48 rounded bg-slate-200" />
              <div className="mb-3 h-4 w-full rounded bg-slate-100" />
              <div className="mb-3 h-4 w-4/5 rounded bg-slate-100" />
              <div className="h-10 w-36 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      ) : pendientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white py-16 text-slate-400 shadow-sm">
          <span className="text-5xl mb-3">📦</span>
          <p className="text-lg font-semibold text-slate-700">No hay recepciones pendientes</p>
          <p className="mt-1 px-4 text-center text-sm text-slate-500">Todas las órdenes terminadas ya tienen entrada registrada en almacén.</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {pendientes.map((row) => (
            <div
              key={row.OP_Id}
              className="group flex h-full flex-col gap-5 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-[#092052]/20 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="rounded-lg border border-[#092052]/20 bg-[#f3f7ff] px-2.5 py-1 font-mono text-sm font-bold text-[#092052]">
                    {row.NumeroOP}
                  </span>
                  <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-500">
                    {row.SKU}
                  </span>
                </div>
                <ClasificacionBadge value={row.ClasificacionInventario} />
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-bold leading-6 text-slate-900 sm:text-lg break-words">
                  {row.NombreProducto}
                </h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  {row.NombreEmpresa && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Empresa</div>
                      <div className="mt-1 flex items-center gap-2 font-medium text-slate-800">
                        <span>🏢</span>
                        <span className="break-words">{row.NombreEmpresa}</span>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Almacén destino</div>
                    <div className="mt-1 flex items-center gap-2 font-medium">
                      <span>📍</span>
                      {row.AlmacenSugerido ? (
                        <span className="break-words text-emerald-700">{row.AlmacenSugerido}</span>
                      ) : (
                        <span className="italic text-red-500">Sin almacén configurado</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cantidad producida</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">
                      {Number(row.CantidadProducida || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha de cierre</div>
                    <div className="mt-1 text-sm font-medium text-slate-700">
                      {row.FechaCierre
                        ? new Date(row.FechaCierre).toLocaleString('es-MX', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', hour12: false,
                          })
                        : 'Sin fecha registrada'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-500">
                  Revisa la información de la OP y registra la entrada cuando el producto esté listo.
                </div>
                <button
                  onClick={() => openModal(row)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#f59e0b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#d98707] sm:w-auto"
                >
                  <span>📦</span>
                  <span>Recepcionar</span>
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Modal recepción manual ── */}
      {modalRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[26px] shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4">
              <h3 className="text-base font-bold text-white">Registrar entrada a almacén</h3>
              <button onClick={() => setModalRow(null)} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="bg-white p-6">

            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm space-y-1 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">OP</span>
                <span className="font-mono font-semibold text-slate-900">{modalRow.NumeroOP}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Producto</span>
                <span className="font-semibold text-slate-900 text-right">{modalRow.NombreProducto}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Almacén destino</span>
                <span className="text-slate-900 text-right">{modalRow.AlmacenSugerido || modalRow.AlmacenSugeridoNombre || 'Automático'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Clasificación</span>
                <ClasificacionBadge value={modalRow.ClasificacionInventario} />
              </div>
            </div>

            <form onSubmit={handleRecepcionar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad a recepcionar *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.cantidad}
                  onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Producidas: {Number(modalRow.CantidadProducida || 0).toLocaleString('es-MX')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones / motivo de cancelación
                </label>
                <textarea
                  rows={2}
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  placeholder="Opcional para recibir, obligatorio para cancelar por producto incompleto..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm resize-none"
                />
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                Si el producto está incompleto y no debe entrar a almacén, captura el motivo y usa <strong>Cancelar por incompleto</strong>.
              </div>
              <div className="flex gap-2 pt-2 justify-end flex-wrap">
                <button
                  type="button"
                  onClick={() => setModalRow(null)}
                  className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCancelarRecepcion}
                  disabled={submitting || canceling}
                  className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  {canceling ? 'Cancelando...' : '⛔ Cancelar por incompleto'}
                </button>
                <button
                  type="submit"
                  disabled={submitting || canceling}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  {submitting ? 'Guardando...' : '📦 Confirmar entrada'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
