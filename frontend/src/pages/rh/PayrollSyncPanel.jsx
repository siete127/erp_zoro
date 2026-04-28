import React, { useEffect, useState, useCallback } from 'react';
import { FaBolt, FaSync, FaHistory, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import api from '../../services/api';
import { notify } from '../../services/notify';

const SYNC_BADGE = {
  pendiente:    'border-amber-200 bg-amber-50 text-amber-700',
  sincronizado: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelado:    'border-slate-200 bg-slate-50 text-slate-500',
  error:        'border-rose-300 bg-rose-100 text-rose-800',
};

function toCurrency(value) {
  return Number(value || 0).toLocaleString('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
  });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PayrollSyncPanel() {
  const [tab, setTab] = useState('pendientes'); // 'pendientes' | 'historial'
  const [pendientes, setPendientes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [autoSyncResult, setAutoSyncResult] = useState(null);
  const [modalSync, setModalSync] = useState(null);
  const [nominaLineaId, setNominaLineaId] = useState('');
  const [nominaLineas, setNominaLineas] = useState([]);
  const [loadingLineas, setLoadingLineas] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendRes, statsRes] = await Promise.all([
        api.get('/rh/payroll/pending-mappings?limit=100'),
        api.get('/rh/payroll/stats/pending'),
      ]);
      setPendientes(pendRes.data || []);
      setStats(statsRes.data || null);
    } catch {
      notify.error('Error cargando mapeos pendientes');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistorial = useCallback(async () => {
    try {
      const res = await api.get('/rh/payroll/all-mappings?limit=200');
      setHistorial(res.data || []);
    } catch {
      notify.error('Error cargando historial');
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (tab === 'historial') loadHistorial();
  }, [tab, loadHistorial]);

  const openSyncModal = async (item) => {
    setModalSync({ mappingId: item.mapping_id, vacacionesId: item.vacaciones_id });
    setNominaLineaId('');
    setLoadingLineas(true);
    try {
      const res = await api.get('/nomina/nominas?estado=borrador&limit=20');
      const nominas = res.data?.items || res.data || [];
      setNominaLineas(nominas.map(n => ({
        id: n.Nomina_Id,
        label: `Nómina #${n.Nomina_Id} — ${n.Descripcion || n.Periodo || 'Sin descripción'}`,
      })).filter(n => n.id));
    } catch {
      setNominaLineas([]);
    } finally {
      setLoadingLineas(false);
    }
  };

  const handleSync = async () => {
    if (!modalSync || !nominaLineaId) {
      notify.error('Selecciona una nómina de destino');
      return;
    }
    setSyncing(modalSync.mappingId);
    try {
      await api.post('/rh/payroll/sync-to-payroll', {
        mapping_id: modalSync.mappingId,
        nomina_linea_id: Number(nominaLineaId),
      });
      notify.success('Sincronizado correctamente');
      setModalSync(null);
      setNominaLineaId('');
      await loadData();
    } catch (err) {
      notify.error(err?.response?.data?.detail || 'Error al sincronizar');
    } finally {
      setSyncing(null);
    }
  };

  const handleAutoSync = async () => {
    if (!window.confirm(`¿Sincronizar automáticamente ${pendientes.length} mapeo(s) pendiente(s) a la nómina abierta más reciente?`)) return;
    setAutoSyncing(true);
    setAutoSyncResult(null);
    try {
      const res = await api.post('/rh/payroll/auto-sync');
      setAutoSyncResult(res.data);
      const { synced, errors, mensaje } = res.data;
      if (mensaje) {
        notify.error(mensaje);
      } else if (errors > 0) {
        notify.error(`Auto-sync: ${synced} sincronizados, ${errors} errores`);
      } else {
        notify.success(`Auto-sync completo: ${synced} vacaciones aplicadas a nómina`);
      }
      await loadData();
    } catch (err) {
      notify.error(err?.response?.data?.detail || 'Error en auto-sincronización');
    } finally {
      setAutoSyncing(false);
    }
  };

  const totalPendiente = pendientes.reduce((s, i) => s + Number(i.importe || 0), 0);
  const countSync = stats?.por_estado?.Sincronizado?.cantidad || stats?.por_estado?.sincronizado?.cantidad || 0;
  const countPending = stats?.por_estado?.Pendiente?.cantidad || stats?.por_estado?.pendiente?.cantidad || pendientes.length;
  const countError = stats?.por_estado?.Error?.cantidad || stats?.por_estado?.error?.cantidad || 0;

  return (
    <div className="space-y-5">

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-5 shadow-[0_4px_20px_rgba(15,45,93,0.06)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Pendientes</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{countPending}</p>
          <p className="mt-0.5 text-xs text-amber-600">sin sincronizar</p>
        </div>
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-5 shadow-[0_4px_20px_rgba(15,45,93,0.06)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Sincronizados</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{countSync}</p>
          <p className="mt-0.5 text-xs text-emerald-600">en nómina</p>
        </div>
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 shadow-[0_4px_20px_rgba(15,45,93,0.06)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Errores</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">{countError}</p>
          <p className="mt-0.5 text-xs text-rose-500">requieren revisión</p>
        </div>
        <div className="rounded-[20px] border border-[#dce4f0] bg-[#f8faff] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.06)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Importe pendiente</p>
          <p className="mt-2 text-xl font-bold text-[#1b3d86]">{toCurrency(totalPendiente)}</p>
          <p className="mt-0.5 text-xs text-slate-400">por aplicar</p>
        </div>
      </div>

      {/* Auto-sync result banner */}
      {autoSyncResult && !autoSyncResult.mensaje && (
        <div className={`rounded-[16px] border px-5 py-4 flex items-start gap-3 ${autoSyncResult.errors > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          {autoSyncResult.errors > 0
            ? <FaExclamationTriangle className="mt-0.5 shrink-0 text-amber-500" />
            : <FaCheckCircle className="mt-0.5 shrink-0 text-emerald-500" />
          }
          <div>
            <p className={`text-sm font-semibold ${autoSyncResult.errors > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
              Auto-sync completado — Nómina #{autoSyncResult.nomina_id}: {autoSyncResult.nomina_descripcion || ''}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {autoSyncResult.synced} sincronizados · {autoSyncResult.skipped} omitidos · {autoSyncResult.errors} errores
              {autoSyncResult.periodo_inicio ? ` · Periodo: ${fmtDate(autoSyncResult.periodo_inicio)} – ${fmtDate(autoSyncResult.periodo_fin)}` : ''}
            </p>
          </div>
          <button onClick={() => setAutoSyncResult(null)} className="ml-auto text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">

        {/* Header con tabs y acciones */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#eaf0fa]">
          <div className="flex items-center gap-1 rounded-[14px] bg-[#f0f4ff] p-1">
            {[['pendientes', 'Pendientes'], ['historial', 'Historial']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-[10px] px-4 py-1.5 text-xs font-semibold transition ${
                  tab === key
                    ? 'bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {tab === 'pendientes' && pendientes.length > 0 && (
              <button
                onClick={handleAutoSync}
                disabled={autoSyncing}
                className="flex items-center gap-1.5 rounded-[12px] bg-gradient-to-r from-[#059669] to-[#10b981] px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(5,150,105,0.30)] hover:shadow-[0_6px_18px_rgba(5,150,105,0.38)] disabled:opacity-60 transition"
              >
                <FaBolt className="text-[10px]" />
                {autoSyncing ? 'Sincronizando...' : `Auto-sync (${pendientes.length})`}
              </button>
            )}
            <button
              onClick={() => { loadData(); if (tab === 'historial') loadHistorial(); }}
              className="flex items-center gap-1.5 rounded-[12px] border border-[#dce4f0] bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              <FaSync className="text-[10px]" /> Actualizar
            </button>
          </div>
        </div>

        {tab === 'pendientes' && (
          loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : pendientes.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <FaCheckCircle className="mx-auto mb-3 text-3xl text-emerald-300" />
              <p className="text-sm text-slate-400">No hay mapeos pendientes</p>
              <p className="text-xs text-slate-300 mt-1">Todas las vacaciones aprobadas han sido procesadas en nómina</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {['Vacación #', 'Empleado', 'Fechas', 'Días', 'Importe', 'Estado', 'Acción'].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((item) => {
                    const estado = (item.estado || 'pendiente').toLowerCase();
                    return (
                      <tr key={item.mapping_id} className="border-t border-[#eaf0fa] hover:bg-[#f4f7ff]/60 transition">
                        <td className="px-4 py-3 pl-6 text-sm text-slate-400">#{item.vacaciones_id}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                          {item.empleado_nombre || `Usuario ${item.user_id}`}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {fmtDate(item.fecha_inicio)}<br />{fmtDate(item.fecha_fin)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.dias || '—'}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-800">{toCurrency(item.importe)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${SYNC_BADGE[estado] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                            {estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 pr-6">
                          {estado === 'pendiente' && (
                            <button
                              onClick={() => openSyncModal(item)}
                              disabled={syncing === item.mapping_id}
                              className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] disabled:opacity-60 transition"
                            >
                              Manual
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'historial' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#eaf0fa]">
                  {['Vacación #', 'Empleado', 'Días', 'Importe', 'Estado', 'Sincronizado', 'Nómina'].map(col => (
                    <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">Sin registros</td></tr>
                ) : historial.map((item) => {
                  const estado = (item.estado || '').toLowerCase();
                  return (
                    <tr key={item.mapping_id} className="border-t border-[#eaf0fa] hover:bg-[#f4f7ff]/60 transition">
                      <td className="px-4 py-3 pl-6 text-sm text-slate-400">#{item.vacaciones_id}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                        {item.empleado_nombre || `Usuario ${item.user_id}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.dias || '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{toCurrency(item.importe)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${SYNC_BADGE[estado] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                          {estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(item.fecha_sincronizacion)}</td>
                      <td className="px-4 py-3 pr-6 text-xs text-slate-500">
                        {item.nomina_linea_id ? `Línea #${item.nomina_linea_id}` : '—'}
                        {item.mensaje_error && (
                          <span className="ml-2 text-rose-500" title={item.mensaje_error}>&#9888;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal sincronización manual */}
      {modalSync && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Sincronizar manualmente</h3>
              <button onClick={() => setModalSync(null)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Selecciona la nómina en borrador donde se aplicará el pago de vacaciones.
              </p>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">
                  Nómina de destino *
                </label>
                {loadingLineas ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="h-4 w-4 rounded-full border-2 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
                    <span className="text-sm text-slate-400">Cargando nóminas...</span>
                  </div>
                ) : (
                  <select
                    value={nominaLineaId}
                    onChange={e => setNominaLineaId(e.target.value)}
                    className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
                  >
                    <option value="">Seleccionar nómina...</option>
                    {nominaLineas.map(n => (
                      <option key={n.id} value={n.id}>{n.label}</option>
                    ))}
                    {nominaLineas.length === 0 && <option disabled>No hay nóminas en borrador</option>}
                  </select>
                )}
              </div>
              {nominaLineas.length === 0 && !loadingLineas && (
                <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  No hay nóminas en estado borrador. Crea o abre una nómina primero.
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSync}
                  disabled={!nominaLineaId || !!syncing}
                  className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition"
                >
                  {syncing ? 'Sincronizando...' : 'Confirmar'}
                </button>
                <button
                  onClick={() => setModalSync(null)}
                  className="flex-1 rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
