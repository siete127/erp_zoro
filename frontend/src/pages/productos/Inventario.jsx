import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';
import { socket } from '../../services/socket';

const CLASIFICACION_LABELS = {
  MATERIA_PRIMA:      { label: 'Materia Prima',    color: 'bg-yellow-100 text-yellow-800 border border-yellow-300' },
  PRODUCTO_TERMINADO: { label: 'Prod. Terminado',  color: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  PRODUCTO_REVENTA:   { label: 'Reventa',          color: 'bg-blue-100 text-blue-800 border border-blue-300' },
};

function ClasificacionBadge({ value }) {
  const cfg = CLASIFICACION_LABELS[value] || { label: value || '—', color: 'bg-gray-100 text-gray-500 border border-gray-200' };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function Num({ value, warn }) {
  const n = Number(value) || 0;
  return (
    <span className={n > 0 && warn ? 'text-amber-600 font-bold' : ''}>
      {n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
    </span>
  );
}

function SkeletonRow({ cols }) {
  return (
    <tr className="border-t border-gray-100 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-3 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

function StatCard({ label, value, icon, color, alert, loading }) {
  const palette = {
    blue:   'from-blue-50 to-blue-100 border-blue-200 text-blue-700',
    green:  'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700',
    indigo: 'from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700',
    red:    'from-red-50 to-red-100 border-red-200 text-red-700',
  };
  const cls = palette[color] || palette.blue;
  return (
    <div className={`bg-gradient-to-br ${cls} border rounded-2xl px-4 py-3.5 flex items-center gap-3`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs font-medium opacity-70 leading-tight">{label}</p>
        {loading
          ? <div className="h-6 w-12 bg-current opacity-20 rounded mt-1 animate-pulse" />
          : <p className={`text-xl font-bold leading-tight mt-0.5 ${alert ? 'text-red-600' : ''}`}>{value}</p>
        }
      </div>
    </div>
  );
}

const TABS = [
  { id: 'stock',       label: 'Stock por Almacén',  icon: '🏭' },
  { id: 'consolidado', label: 'Estado Consolidado', icon: '📊' },
  { id: 'mp',          label: 'Materia Prima',      icon: '🧱' },
];

export default function Inventario() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('stock');

  // ── Stock simple ──────────────────────────────────────────────────────────
  const [items, setItems] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [filtros, setFiltros] = useState({ sku: '', nombre: '', company_id: 'all' });

  // ── Consolidado ───────────────────────────────────────────────────────────
  const [consolidado, setConsolidado] = useState([]);
  const [loadingCons, setLoadingCons] = useState(false);
  const [filtrosCons, setFiltrosCons] = useState({ search: '', company_id: 'all', clasificacion: 'all' });
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── Shared ────────────────────────────────────────────────────────────────
  // ── Materia Prima ─────────────────────────────────────────────────────────
  const [stockMP, setStockMP] = useState([]);
  const [loadingMP, setLoadingMP] = useState(false);
  const [filtrosMP, setFiltrosMP] = useState({ search: '', company_id: 'all' });
  const [editMP, setEditMP] = useState(null);
  const [savingMP, setSavingMP] = useState(false);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [companies, setCompanies] = useState([]);
  const [userRole, setUserRole] = useState(null);

  // ── Fetch stock simple ────────────────────────────────────────────────────
  const fetchStock = useCallback(async () => {
    setLoadingStock(true);
    try {
      const params = new URLSearchParams();
      if (filtros.sku) params.append('sku', filtros.sku);
      if (filtros.nombre) params.append('nombre', filtros.nombre);
      if (filtros.company_id !== 'all') params.append('company_id', filtros.company_id);
      const res = await api.get(`/inventario?${params}`);
      setItems(res.data || []);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error cargando inventario', 'error');
    } finally {
      setLoadingStock(false);
    }
  }, [filtros]);

  // ── Fetch consolidado ─────────────────────────────────────────────────────
  const fetchConsolidado = useCallback(async () => {
    setLoadingCons(true);
    try {
      const params = new URLSearchParams();
      if (filtrosCons.search) params.append('search', filtrosCons.search);
      if (filtrosCons.company_id !== 'all') params.append('company_id', filtrosCons.company_id);
      if (filtrosCons.clasificacion !== 'all') params.append('clasificacion', filtrosCons.clasificacion);
      const res = await api.get(`/inventario/consolidado?${params}`);
      setConsolidado(res.data?.data || res.data || []);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error cargando consolidado', 'error');
    } finally {
      setLoadingCons(false);
    }
  }, [filtrosCons]);

  // ── Fetch materia prima ───────────────────────────────────────────────────
  const fetchStockMP = useCallback(async () => {
    setLoadingMP(true);
    try {
      const params = new URLSearchParams();
      if (filtrosMP.search) params.append('search', filtrosMP.search);
      if (filtrosMP.company_id !== 'all') params.append('company_id', filtrosMP.company_id);
      const res = await api.get(`/inventario/mp?${params}`);
      setStockMP(res.data?.data || []);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error cargando inventario de MP', 'error');
    } finally {
      setLoadingMP(false);
    }
  }, [filtrosMP]);

  useEffect(() => {
    if (tab === 'stock') fetchStock();
    if (tab === 'consolidado') fetchConsolidado();
    if (tab === 'mp') fetchStockMP();
  }, [tab]);

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
    const handler = () => {
      if (tab === 'stock') fetchStock();
      if (tab === 'consolidado') fetchConsolidado();
    };
    socket.on('inventario:changed', handler);
    socket.on('inventario:recepcion-produccion', handler);
    return () => {
      socket.off('inventario:changed', handler);
      socket.off('inventario:recepcion-produccion', handler);
    };
  }, [tab, fetchStock, fetchConsolidado]);

  // ── Guardar cantidades operacionales ─────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      await api.put('/inventario/consolidado', {
        Producto_Id:                 editRow.Producto_Id,
        Company_Id:                  editRow.Company_Id,
        Almacen_Id:                  editRow.Almacen_Id,
        CantidadEnMaquina:           Number(editRow.CantidadEnMaquina)           || 0,
        CantidadEntregadaProduccion: Number(editRow.CantidadEntregadaProduccion) || 0,
        CantidadEnProceso:           Number(editRow.CantidadEnProceso)           || 0,
      });
      notify('Estado actualizado', 'success');
      setEditRow(null);
      fetchConsolidado();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = userRole === 1 || userRole === 2;
  const handleSaveEditMP = async () => {
    if (!editMP) return;
    setSavingMP(true);
    try {
      await api.put('/inventario/mp', {
        MateriaPrima_Id: editMP.MateriaPrima_Id,
        Almacen_Id:      editMP.Almacen_Id,
        StockMinimo:     Number(editMP.StockMinimo) || 0,
      });
      notify('Stock mínimo actualizado', 'success');
      setEditMP(null);
      fetchStockMP();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al guardar', 'error');
    } finally {
      setSavingMP(false);
    }
  };


  // ── Stats para tab stock ──────────────────────────────────────────────────
  const totalSKUs     = new Set(items.map(i => i.SKU)).size;
  const totalUnidades = items.reduce((a, i) => a + (Number(i.Cantidad) || 0), 0);
  const bajoStock     = items.filter(i => Number(i.Cantidad) < Number(i.Stock_Minimo)).length;
  const totalAlmacenes = new Set(items.map(i => i.Almacen_Id).filter(Boolean)).size;

  return (
    <div className="w-full space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#092052]">Inventario</h2>
          <p className="text-sm text-gray-500 mt-0.5">Stock por almacén y estado operacional de productos</p>
        </div>
        <button
          onClick={() => navigate('/productos/recepcion-pendiente')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700
                     text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
        >
          📦 Recepciones pendientes
        </button>
      </div>

      {/* ── Stat Cards (solo en tab stock) ── */}
      {tab === 'stock' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="SKUs totales"      value={totalSKUs}                              color="blue"   icon="🏷️" loading={loadingStock} />
          <StatCard label="Unidades en stock" value={totalUnidades.toLocaleString('es-MX')} color="green"  icon="📦" loading={loadingStock} />
          <StatCard label="Almacenes activos" value={totalAlmacenes}                        color="indigo" icon="🏭" loading={loadingStock} />
          <StatCard label="Bajo stock mínimo" value={bajoStock} alert={bajoStock > 0}       color="red"    icon="⚠️" loading={loadingStock} />
        </div>
      )}

      {/* ── Panel principal ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${tab === t.id
                  ? 'border-[#092052] text-[#092052]'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">

          {/* ══════════ TAB: Stock simple ══════════ */}
          {tab === 'stock' && (
            <>
              {/* Filtros */}
              <form
                onSubmit={(e) => { e.preventDefault(); fetchStock(); }}
                className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-gray-50 rounded-xl border border-gray-200"
              >
                {isAdmin && (
                  <select
                    value={filtros.company_id}
                    onChange={(e) => setFiltros({ ...filtros, company_id: e.target.value })}
                    className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#092052]/30 focus:border-[#092052]"
                  >
                    <option value="all">🏢 Todas las empresas</option>
                    {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                  </select>
                )}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold pointer-events-none">SKU</span>
                  <input
                    value={filtros.sku}
                    onChange={(e) => setFiltros({ ...filtros, sku: e.target.value })}
                    placeholder="ABC-001"
                    className="h-9 pl-10 pr-3 w-36 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#092052]/30 focus:border-[#092052]"
                  />
                </div>
                <div className="relative flex-1 min-w-[160px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                  </svg>
                  <input
                    value={filtros.nombre}
                    onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })}
                    placeholder="Nombre del producto..."
                    className="h-9 pl-9 pr-3 w-full rounded-lg border border-gray-300 bg-white text-gray-900 text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#092052]/30 focus:border-[#092052]"
                  />
                </div>
                <button
                  type="submit"
                  className="h-9 px-4 bg-[#092052] hover:bg-[#0d3a7a] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Buscar
                </button>
                {(filtros.sku || filtros.nombre || filtros.company_id !== 'all') && (
                  <button
                    type="button"
                    onClick={() => setFiltros({ sku: '', nombre: '', company_id: 'all' })}
                    className="h-9 px-3 text-xs text-gray-500 hover:text-gray-800 bg-white border border-gray-300 hover:border-gray-400 rounded-lg transition-colors"
                  >
                    ✕ Limpiar
                  </button>
                )}
              </form>

              {/* Tabla */}
              <div className="overflow-auto rounded-xl border border-gray-200">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="py-3 pl-4 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">SKU</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-44">Almacén</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Clasificación</th>
                      <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28 text-right">Cantidad</th>
                      <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24 text-right">Mínimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingStock
                      ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                      : items.length === 0
                        ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center">
                              <div className="flex flex-col items-center gap-2 text-gray-400">
                                <span className="text-4xl">📭</span>
                                <p className="text-sm font-medium">No se encontraron registros de inventario.</p>
                                <p className="text-xs">Recibe una orden de producción para generar el primer movimiento.</p>
                              </div>
                            </td>
                          </tr>
                        )
                        : items.map((i, idx) => {
                          const bajo = Number(i.Cantidad) < Number(i.Stock_Minimo);
                          return (
                            <tr
                              key={`${i.Producto_Id}-${i.Almacen_Id}-${idx}`}
                              className={`border-t border-gray-100 transition-colors
                                ${bajo ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-blue-50/40'}`}
                            >
                              <td className="py-3 pl-4 pr-3 font-mono text-xs text-gray-700 whitespace-nowrap">{i.SKU}</td>
                              <td className="py-3 pr-3 text-gray-900 font-medium">{i.Nombre}</td>
                              <td className="py-3 pr-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                                  🏭 {i.AlmacenNombre || '—'}
                                </span>
                              </td>
                              <td className="py-3 pr-3">
                                <ClasificacionBadge value={i.ClasificacionInventario} />
                              </td>
                              <td className="py-3 pr-4 text-right whitespace-nowrap">
                                <span className={`font-bold text-base ${bajo ? 'text-red-600' : 'text-gray-900'}`}>
                                  {Number(i.Cantidad).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </span>
                                {bajo && (
                                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700 font-medium">
                                    ⚠ Bajo
                                  </span>
                                )}
                              </td>
                              <td className="py-3 pr-4 text-right text-gray-500 text-sm">{i.Stock_Minimo ?? '—'}</td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </div>

              {/* Footer count */}
              {!loadingStock && items.length > 0 && (
                <p className="mt-2 text-xs text-gray-400 text-right">
                  {items.length} {items.length === 1 ? 'registro' : 'registros'} encontrados
                </p>
              )}
            </>
          )}

          {/* ══════════ TAB: Estado consolidado ══════════ */}
          {tab === 'consolidado' && (
            <>
              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                {isAdmin && (
                  <select
                    value={filtrosCons.company_id}
                    onChange={(e) => setFiltrosCons({ ...filtrosCons, company_id: e.target.value })}
                    className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#092052]/30 focus:border-[#092052]"
                  >
                    <option value="all">🏢 Todas las empresas</option>
                    {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                  </select>
                )}
                <select
                  value={filtrosCons.clasificacion}
                  onChange={(e) => setFiltrosCons({ ...filtrosCons, clasificacion: e.target.value })}
                  className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#092052]/30 focus:border-[#092052]"
                >
                  <option value="all">🗂 Todas las clasificaciones</option>
                  <option value="MATERIA_PRIMA">Materia Prima</option>
                  <option value="PRODUCTO_TERMINADO">Producto Terminado</option>
                  <option value="PRODUCTO_REVENTA">Producto de Reventa</option>
                </select>
                <div className="relative flex-1 min-w-[160px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                  </svg>
                  <input
                    value={filtrosCons.search}
                    onChange={(e) => setFiltrosCons({ ...filtrosCons, search: e.target.value })}
                    placeholder="Buscar producto..."
                    className="h-9 pl-9 pr-3 w-full rounded-lg border border-gray-300 bg-white text-gray-900 text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#092052]/30 focus:border-[#092052]"
                  />
                </div>
                <button
                  onClick={fetchConsolidado}
                  className="h-9 px-4 bg-[#092052] hover:bg-[#0d3a7a] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Buscar
                </button>
              </div>

              {/* Leyenda de columnas */}
              <div className="flex flex-wrap gap-3 mb-4">
                {[
                  { color: 'bg-gray-100 border-gray-300',     icon: '📦', label: 'En Almacén (stock físico)' },
                  { color: 'bg-blue-100 border-blue-300',     icon: '⚙️', label: 'En Máquina' },
                  { color: 'bg-purple-100 border-purple-300', icon: '🔧', label: 'Entregada a Producción' },
                  { color: 'bg-orange-100 border-orange-300', icon: '🔄', label: 'En Proceso' },
                ].map(l => (
                  <span key={l.label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${l.color}`}>
                    {l.icon} {l.label}
                  </span>
                ))}
              </div>

              {/* Tabla */}
              <div className="overflow-auto rounded-xl border border-gray-200">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="py-3 pl-4 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">SKU</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Producto</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Almacén</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Clasificación</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28 text-right bg-gray-100/80">En Almacén</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-blue-600 uppercase tracking-wide w-28 text-right bg-blue-50">En Máquina</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-purple-600 uppercase tracking-wide w-32 text-right bg-purple-50">Entregada Prod.</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-orange-600 uppercase tracking-wide w-28 text-right bg-orange-50">En Proceso</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-16 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingCons
                      ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
                      : consolidado.length === 0
                        ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center">
                              <div className="flex flex-col items-center gap-2 text-gray-400">
                                <span className="text-4xl">📊</span>
                                <p className="text-sm font-medium">Sin datos de estado consolidado.</p>
                                <p className="text-xs">Cierra una orden de producción para generar el primer registro.</p>
                              </div>
                            </td>
                          </tr>
                        )
                        : consolidado.map((row, idx) => (
                          <tr
                            key={`${row.Producto_Id}-${row.Company_Id}-${idx}`}
                            className="border-t border-gray-100 hover:bg-blue-50/30 transition-colors"
                          >
                            <td className="py-3 pl-4 pr-3 font-mono text-xs text-gray-700 whitespace-nowrap">{row.SKU}</td>
                            <td className="py-3 pr-3 text-gray-900 font-medium">{row.NombreProducto}</td>
                            <td className="py-3 pr-3 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 text-xs">
                                🏭 {row.NombreAlmacen || '—'}
                              </span>
                            </td>
                            <td className="py-3 pr-3"><ClasificacionBadge value={row.ClasificacionInventario} /></td>
                            <td className="py-3 pr-3 text-right bg-gray-50 whitespace-nowrap">
                              <span className="font-bold text-gray-900"><Num value={row.CantidadAlmacen} /></span>
                            </td>
                            <td className="py-3 pr-3 text-right bg-blue-50 whitespace-nowrap text-blue-800">
                              <Num value={row.CantidadEnMaquina} warn />
                            </td>
                            <td className="py-3 pr-3 text-right bg-purple-50 whitespace-nowrap text-purple-800">
                              <Num value={row.CantidadEntregadaProduccion} warn />
                            </td>
                            <td className="py-3 pr-3 text-right bg-orange-50 whitespace-nowrap text-orange-800">
                              <Num value={row.CantidadEnProceso} warn />
                            </td>
                            <td className="py-3 pr-3 text-center">
                              <button
                                onClick={() => setEditRow({ ...row })}
                                className="px-2.5 py-1 text-xs bg-[#092052] hover:bg-[#0d3a7a] text-white rounded-lg font-medium transition-colors"
                              >
                                ✏️ Editar
                              </button>
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>

              {/* Footer count */}
              {!loadingCons && consolidado.length > 0 && (
                <p className="mt-2 text-xs text-gray-400 text-right">
                  {consolidado.length} {consolidado.length === 1 ? 'producto' : 'productos'}
                </p>
              )}
            </>
          )}

          {/* ══════════ TAB: Materia Prima ══════════ */}
          {tab === 'mp' && (
            <>
              {/* Filtros */}
              <form
                onSubmit={(e) => { e.preventDefault(); fetchStockMP(); }}
                className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-gray-50 rounded-xl border border-gray-200"
              >
                {isAdmin && (
                  <select
                    value={filtrosMP.company_id}
                    onChange={(e) => setFiltrosMP({ ...filtrosMP, company_id: e.target.value })}
                    className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#092052]/30"
                  >
                    <option value="all">🏢 Todas las empresas</option>
                    {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                  </select>
                )}
                <div className="relative flex-1 min-w-[160px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                  </svg>
                  <input
                    value={filtrosMP.search}
                    onChange={(e) => setFiltrosMP({ ...filtrosMP, search: e.target.value })}
                    placeholder="Buscar por código o nombre..."
                    className="h-9 pl-9 pr-3 w-full rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#092052]/30"
                  />
                </div>
                <button
                  onClick={fetchStockMP}
                  className="h-9 px-4 bg-[#092052] hover:bg-[#0d3a7a] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Buscar
                </button>
              </form>

              {/* Tabla */}
              <div className="overflow-auto rounded-xl border border-gray-200">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="py-3 pl-4 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Código</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Material</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Tipo</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Almacén</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Empresa</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Unidad</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide w-28 text-right bg-emerald-50">Stock Actual</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-amber-600 uppercase tracking-wide w-28 text-right bg-amber-50">Stock Mín.</th>
                      <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20 text-right">Costo U.</th>
                      {isAdmin && <th className="py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-16 text-center">Acción</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {loadingMP
                      ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={isAdmin ? 10 : 9} />)
                      : stockMP.length === 0
                        ? (
                          <tr>
                            <td colSpan={isAdmin ? 10 : 9} className="py-12 text-center">
                              <div className="flex flex-col items-center gap-2 text-gray-400">
                                <span className="text-4xl">🧱</span>
                                <p className="text-sm font-medium">Sin registros de materia prima en inventario.</p>
                                <p className="text-xs">Las materias primas aparecen aquí al recibir una orden de compra.</p>
                              </div>
                            </td>
                          </tr>
                        )
                        : stockMP.map((row, idx) => {
                          const bajo = Number(row.CantidadAlmacen) < Number(row.StockMinimo) && Number(row.StockMinimo) > 0;
                          return (
                            <tr key={`${row.MateriaPrima_Id}-${row.Almacen_Id}-${idx}`}
                              className={`border-t border-gray-100 transition-colors ${bajo ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-amber-50/30'}`}>
                              <td className="py-3 pl-4 pr-3 font-mono text-xs text-gray-700 whitespace-nowrap">{row.SKU}</td>
                              <td className="py-3 pr-3 text-gray-900 font-medium">
                                {row.NombreProducto}
                                {bajo && <span className="ml-2 text-xs text-red-600 font-semibold">⚠ Bajo mínimo</span>}
                              </td>
                              <td className="py-3 pr-3">
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 border border-orange-200">{row.Tipo || '—'}</span>
                              </td>
                              <td className="py-3 pr-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 text-xs">
                                  🏭 {row.NombreAlmacen || '—'}
                                </span>
                              </td>
                              <td className="py-3 pr-3 text-xs text-gray-500">{row.NameCompany || '—'}</td>
                              <td className="py-3 pr-3 text-xs text-gray-500">{row.UnidadCompra || '—'}</td>
                              <td className="py-3 pr-3 text-right bg-emerald-50 whitespace-nowrap">
                                <span className={`font-bold ${bajo ? 'text-red-600' : 'text-emerald-800'}`}>
                                  <Num value={row.CantidadAlmacen} />
                                </span>
                              </td>
                              <td className="py-3 pr-3 text-right bg-amber-50 whitespace-nowrap text-amber-800">
                                <Num value={row.StockMinimo} />
                              </td>
                              <td className="py-3 pr-3 text-right text-xs text-gray-500 whitespace-nowrap">
                                {row.CostoUnitario
                                  ? `$${Number(row.CostoUnitario).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                                  : '—'}
                              </td>
                              {isAdmin && (
                                <td className="py-3 pr-3 text-center">
                                  <button
                                    onClick={() => setEditMP({ ...row })}
                                    className="px-2.5 py-1 text-xs bg-[#092052] hover:bg-[#0d3a7a] text-white rounded-lg font-medium transition-colors"
                                  >
                                    ✏️ Editar
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </div>
              {!loadingMP && stockMP.length > 0 && (
                <p className="mt-2 text-xs text-gray-400 text-right">
                  {stockMP.length} {stockMP.length === 1 ? 'registro' : 'registros'}
                </p>
              )}
            </>
          )}

        </div>
      </div>

      {/* ── Modal editar stock mínimo MP ── */}
      {editMP && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#092052]">
              <div>
                <h3 className="text-base font-bold text-white">Editar Stock Mínimo</h3>
                <p className="text-xs text-blue-200 mt-0.5">Materia Prima</p>
              </div>
              <button onClick={() => setEditMP(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-lg transition-colors">
                ×
              </button>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-900">{editMP.NombreProducto}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                🏭 {editMP.NombreAlmacen || 'Sin almacén'}
                {editMP.SKU && <span className="ml-2 font-mono">· {editMP.SKU}</span>}
              </p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl p-3 bg-emerald-50">
                <label className="block text-xs font-semibold mb-1.5 text-emerald-700">📦 Stock Actual</label>
                <p className="text-2xl font-bold text-emerald-800">
                  {Number(editMP.CantidadAlmacen).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                  <span className="text-sm font-normal text-emerald-600 ml-1">{editMP.UnidadCompra}</span>
                </p>
              </div>
              <div className="rounded-xl p-3 bg-amber-50">
                <label className="block text-xs font-semibold mb-1.5 text-amber-700">⚠️ Stock Mínimo</label>
                <input
                  type="number" min="0" step="0.0001"
                  value={editMP.StockMinimo ?? 0}
                  onChange={(e) => setEditMP({ ...editMP, StockMinimo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-gray-100 justify-end bg-gray-50">
              <button onClick={() => setEditMP(null)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveEditMP} disabled={savingMP}
                className="px-5 py-2 bg-[#092052] text-white rounded-lg hover:bg-[#0d3a7a] text-sm font-semibold disabled:opacity-60 transition-colors">
                {savingMP ? '⏳ Guardando...' : '✔ Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal editar estado operacional ── */}
      {editRow && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#092052]">
              <div>
                <h3 className="text-base font-bold text-white">Estado Operacional</h3>
                <p className="text-xs text-blue-200 mt-0.5">Actualiza las cantidades en operación</p>
              </div>
              <button
                onClick={() => setEditRow(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-lg transition-colors"
              >
                ×
              </button>
            </div>

            {/* Product info */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-900">{editRow.NombreProducto}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                🏭 {editRow.NombreAlmacen || 'Sin almacén asignado'}
                {editRow.SKU && <span className="ml-2 font-mono">· {editRow.SKU}</span>}
              </p>
            </div>

            {/* Fields */}
            <div className="px-6 py-5 space-y-4">
              {[
                { field: 'CantidadEnMaquina',           label: 'En Máquina',             icon: '⚙️', ring: 'focus:ring-blue-400',   labelColor: 'text-blue-700',   bg: 'bg-blue-50' },
                { field: 'CantidadEntregadaProduccion', label: 'Entregada a Producción', icon: '🔧', ring: 'focus:ring-purple-400', labelColor: 'text-purple-700', bg: 'bg-purple-50' },
                { field: 'CantidadEnProceso',           label: 'En Proceso',             icon: '🔄', ring: 'focus:ring-orange-400', labelColor: 'text-orange-700', bg: 'bg-orange-50' },
              ].map(({ field, label, icon, ring, labelColor, bg }) => (
                <div key={field} className={`rounded-xl p-3 ${bg}`}>
                  <label className={`block text-xs font-semibold mb-1.5 ${labelColor}`}>
                    {icon} {label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editRow[field] ?? 0}
                    onChange={(e) => setEditRow({ ...editRow, [field]: e.target.value })}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm
                                focus:outline-none focus:ring-2 ${ring} text-gray-900`}
                  />
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 border-t border-gray-100 justify-end bg-gray-50">
              <button
                onClick={() => setEditRow(null)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-5 py-2 bg-[#092052] text-white rounded-lg hover:bg-[#0d3a7a] text-sm font-semibold
                           disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '⏳ Guardando...' : '✔ Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
