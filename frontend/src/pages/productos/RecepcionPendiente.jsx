import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';
import { socket } from '../../services/socket';

const CLASIFICACION_LABELS = {
  MATERIA_PRIMA: { label: 'Materia Prima', color: 'bg-yellow-100 text-yellow-800' },
  PRODUCTO_TERMINADO: { label: 'Prod. Terminado', color: 'bg-green-100 text-green-800' },
  PRODUCTO_REVENTA: { label: 'Reventa', color: 'bg-blue-100 text-blue-800' },
};

function ClasificacionBadge({ value }) {
  const cfg = CLASIFICACION_LABELS[value] || { label: value || '—', color: 'bg-gray-100 text-gray-600' };
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

  // Modal recepción manual
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
        const res = await api.get('/companies');
        setCompanies(res.data || []);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setUserRole(user.RolId);
      } catch {}
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
      notify(`Recepción registrada para ${modalRow.NombreProducto}`, 'success');
      setModalRow(null);
      setForm({ cantidad: '', observaciones: '' });
      fetchPendientes();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al registrar recepción', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelarRecepcion = async () => {
    if (!modalRow) return;
    const motivo = String(form.observaciones || '').trim();
    if (!motivo) {
      notify('Escribe el motivo de cancelación por producto incompleto', 'warning');
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
    <div className="w-full">
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
          <div>
            <button
              onClick={() => navigate('/productos/inventario')}
              className="inline-flex items-center gap-1.5 text-sm text-[#092052] hover:text-[#15367a] font-medium mb-2"
            >
              <span>←</span>
              <span>Volver a Inventario</span>
            </button>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Recepciones Pendientes</h2>
            <p className="text-sm text-slate-600 mt-1.5 max-w-2xl">
              Órdenes de producción terminadas cuyo producto aún no ha sido recibido en almacén.
            </p>
          </div>
          <button
            onClick={fetchPendientes}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <span>↻</span>
            <span>Actualizar</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border ${
            totalPendientes > 0
              ? 'bg-amber-100 text-amber-800 border-amber-200'
              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
          }`}>
            <span>{totalPendientes > 0 ? '⚠' : '✓'}</span>
            <span>
              {totalPendientes > 0
                ? `${totalPendientes} ${totalPendientes === 1 ? 'OP pendiente' : 'OPs pendientes'} de recepción`
                : 'Sin pendientes — todo recibido'}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border border-slate-200 bg-white text-slate-700">
            <span>📦</span>
            <span>Recepciones por registrar</span>
          </div>
        </div>

        {/* Filtro empresa */}
        {isAdmin && (
          <div className="mb-5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Empresa
            </label>
            <select
              value={filtroCompany}
              onChange={(e) => setFiltroCompany(e.target.value)}
              className="w-full sm:w-auto min-w-[240px] px-3 py-2.5 rounded-lg border bg-white text-slate-900 border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#092052]/20"
            >
              <option value="all">Todas las empresas</option>
              {companies.map(c => (
                <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-5 grid grid-cols-1 gap-3 max-w-5xl">
          {[1, 2, 3].map((item) => (
            <div key={item} className="animate-pulse border border-slate-200 rounded-xl p-4 bg-white">
              <div className="h-4 bg-slate-200 rounded w-48 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-80 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-56" />
            </div>
          ))}
        </div>
      ) : pendientes.length === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center py-16 text-slate-400 border border-dashed border-slate-300 rounded-2xl bg-white">
          <span className="text-5xl mb-3">📦</span>
          <p className="text-lg font-semibold text-slate-700">No hay recepciones pendientes</p>
          <p className="text-sm mt-1 text-slate-500 text-center px-4">Todas las órdenes terminadas ya tienen entrada registrada en almacén.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 max-w-5xl">
          {pendientes.map((row) => (
            <div
              key={row.OP_Id}
              className="group border border-slate-200 bg-white rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md hover:border-[#092052]/20 transition-all"
            >
              {/* Info principal */}
              <div className="flex-1 min-w-0 space-y-2">
                {/* Fila 1: OP + SKU + Producto */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#092052] bg-[#f3f7ff] border border-[#092052]/20 px-2.5 py-1 rounded-md">
                    {row.NumeroOP}
                  </span>
                  <span className="font-mono text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                    {row.SKU}
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                    {row.NombreProducto}
                  </span>
                </div>

                {/* Fila 2: Empresa + Almacén + Clasificación */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  {row.NombreEmpresa && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 px-2 py-1">
                      <span className="text-slate-400">🏢</span>
                      {row.NombreEmpresa}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 px-2 py-1">
                    <span className="text-slate-400">📍</span>
                    {row.AlmacenSugerido
                      ? <span className="text-emerald-700 font-semibold">{row.AlmacenSugerido}</span>
                      : <span className="text-red-500 italic">Sin almacén configurado</span>
                    }
                  </span>
                  <ClasificacionBadge value={row.ClasificacionInventario} />
                </div>

                {/* Fila 3: Cant. producida + Fecha cierre */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span>
                    <span className="font-medium text-slate-700">Cant. producida: </span>
                    <span className="font-bold text-slate-900">
                      {Number(row.CantidadProducida || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                  {row.FechaCierre && (
                    <span>
                      <span className="font-medium text-slate-700">Cerrada: </span>
                      {new Date(row.FechaCierre).toLocaleString('es-MX', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', hour12: false,
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Botón acción */}
              <div className="shrink-0">
                <button
                  onClick={() => openModal(row)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#f59e0b] hover:bg-[#d98707] text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>📦</span>
                    <span>Recepcionar</span>
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal recepción manual ── */}
      {modalRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Registrar entrada a almacén</h3>
              <button onClick={() => setModalRow(null)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>

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
      )}
    </div>
  );
}
