import React, { useEffect, useState } from 'react';
import { FaExchangeAlt } from 'react-icons/fa';
import api from '../../services/api';
import { notify } from '../../services/notify';

const premiumFieldClass =
  'w-full rounded-[14px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20';

const premiumSectionClass =
  'rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]';

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</label>
    {children}
  </div>
);

const TIPO_BADGE = {
  ENTRADA:  'border border-emerald-200 bg-emerald-50 text-emerald-700',
  SALIDA:   'border border-rose-200 bg-rose-50 text-rose-700',
  'AJUSTE+':'border border-sky-200 bg-sky-50 text-sky-700',
  'AJUSTE-':'border border-amber-200 bg-amber-50 text-amber-700',
};

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filtros, setFiltros] = useState({ sku: '', productoId: '', almacenId: '' });
  const [showForm, setShowForm] = useState(false);
  const [productos, setProductos] = useState([]);
  const [productFilter, setProductFilter] = useState('');
  const [almacenes, setAlmacenes] = useState([]);
  const [form, setForm] = useState({
    Producto_Id: '',
    Almacen_Id: '',
    TipoMovimiento: 'ENTRADA',
    Cantidad: '',
    Referencia: ''
  });

  const fetchMovimientos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.productoId) params.append('productoId', filtros.productoId);
      if (filtros.almacenId) params.append('almacenId', filtros.almacenId);
      const res = await api.get(`/inventario/kardex?${params.toString()}`);
      let data = res.data || [];
      if (filtros.sku) {
        const value = filtros.sku.toLowerCase();
        data = data.filter(m => (m.SKU || '').toLowerCase().includes(value));
      }
      setMovimientos(data);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error cargando movimientos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovimientos();
    const loadData = async () => {
      try {
        const [pRes, aRes] = await Promise.all([
          api.get('/productos'),
          api.get('/almacenes')
        ]);
        setProductos(pRes.data?.data || pRes.data || []);
        setAlmacenes(aRes.data || []);
      } catch (err) {
        console.error('Error cargando datos', err);
      }
    };
    loadData();
  }, []);

  const handleBuscar = async (e) => {
    e.preventDefault();
    await fetchMovimientos();
  };

  const handleSubmitMovimiento = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.Producto_Id || !form.Almacen_Id || !form.Cantidad) {
      notify('Completa todos los campos requeridos', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/inventario/movimientos', {
        Producto_Id: Number(form.Producto_Id),
        Almacen_Id: Number(form.Almacen_Id),
        TipoMovimiento: form.TipoMovimiento,
        Cantidad: Number(form.Cantidad),
        Referencia: form.Referencia || null
      });
      notify('Movimiento registrado exitosamente', 'success');
      setForm({ Producto_Id: '', Almacen_Id: '', TipoMovimiento: 'ENTRADA', Cantidad: '', Referencia: '' });
      setProductFilter('');
      setShowForm(false);
      await fetchMovimientos();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error registrando movimiento', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProductos = productos.filter(p => {
    if (!productFilter) return true;
    const q = productFilter.toLowerCase();
    return (p.Nombre || '').toLowerCase().includes(q) || (p.SKU || '').toLowerCase().includes(q);
  });

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6"
      style={{
        background:
          'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb',
      }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#1b3d86] to-[#2a5fc4] shadow-[0_4px_14px_rgba(27,61,134,0.35)]">
              <FaExchangeAlt className="text-white text-lg" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Inventario</p>
              <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Movimientos (Kardex)</h1>
              <p className="text-sm text-slate-500">Historial de entradas, salidas y ajustes</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-2 rounded-[14px] px-5 py-2.5 text-sm font-semibold transition ${
              showForm
                ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                : 'bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.40)]'
            }`}
          >
            {showForm ? 'Cancelar' : '+ Nuevo movimiento'}
          </button>
        </div>

        {/* ── New movement form ── */}
        {showForm && (
          <div className={premiumSectionClass}>
            <h3 className="mb-4 text-sm font-bold text-[#0d1f3c]">Registrar movimiento de inventario</h3>
            <form onSubmit={handleSubmitMovimiento} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Producto *">
                  <input
                    type="text"
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    placeholder="Buscar por nombre o SKU…"
                    className={premiumFieldClass}
                  />
                  <select
                    value={form.Producto_Id}
                    onChange={(e) => setForm({ ...form, Producto_Id: e.target.value })}
                    className={premiumFieldClass}
                    required
                  >
                    <option value="">Selecciona producto</option>
                    {filteredProductos.map(p => (
                      <option key={p.Producto_Id} value={p.Producto_Id}>
                        {p.SKU} — {p.Nombre}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Almacén *">
                  <select
                    value={form.Almacen_Id}
                    onChange={(e) => setForm({ ...form, Almacen_Id: e.target.value })}
                    className={premiumFieldClass}
                    required
                  >
                    <option value="">Selecciona almacén</option>
                    {almacenes.map(a => (
                      <option key={a.Almacen_Id} value={a.Almacen_Id}>
                        {a.Nombre} ({a.Codigo})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Tipo de movimiento *">
                  <select
                    value={form.TipoMovimiento}
                    onChange={(e) => setForm({ ...form, TipoMovimiento: e.target.value })}
                    className={premiumFieldClass}
                    required
                  >
                    <option value="ENTRADA">ENTRADA</option>
                    <option value="SALIDA">SALIDA</option>
                    <option value="AJUSTE+">AJUSTE+</option>
                    <option value="AJUSTE-">AJUSTE-</option>
                  </select>
                </Field>

                <Field label="Cantidad *">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.Cantidad}
                    onChange={(e) => setForm({ ...form, Cantidad: e.target.value })}
                    className={premiumFieldClass}
                    required
                  />
                </Field>
              </div>

              <Field label="Referencia">
                <input
                  type="text"
                  value={form.Referencia}
                  onChange={(e) => setForm({ ...form, Referencia: e.target.value })}
                  placeholder="Ej: Compra #001, Venta #123"
                  className={premiumFieldClass}
                />
              </Field>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-[14px] bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(5,150,105,0.30)] transition hover:shadow-[0_6px_20px_rgba(5,150,105,0.40)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Registrando…' : 'Registrar movimiento'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Filter bar ── */}
        <form
          onSubmit={handleBuscar}
          className="flex flex-wrap items-center gap-3 rounded-[26px] border border-white/70 bg-white/80 px-5 py-3.5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]"
        >
          <input
            value={filtros.sku}
            onChange={(e) => setFiltros({ ...filtros, sku: e.target.value })}
            placeholder="Filtrar por SKU"
            className="w-44 rounded-[12px] border border-[#dce4f0] bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
          />
          <input
            value={filtros.productoId}
            onChange={(e) => setFiltros({ ...filtros, productoId: e.target.value })}
            placeholder="ID Producto"
            className="w-32 rounded-[12px] border border-[#dce4f0] bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
          />
          <input
            value={filtros.almacenId}
            onChange={(e) => setFiltros({ ...filtros, almacenId: e.target.value })}
            placeholder="ID Almacén"
            className="w-32 rounded-[12px] border border-[#dce4f0] bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
          />
          <button
            type="submit"
            className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] transition hover:shadow-[0_4px_14px_rgba(27,61,134,0.35)]"
          >
            Buscar
          </button>
        </form>

        {/* ── Movement table ── */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {['Fecha', 'SKU', 'Producto', 'Almacén', 'Tipo', 'Cantidad', 'Anterior', 'Actual', 'Referencia', 'Usuario'].map(col => (
                      <th
                        key={col}
                        className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-10 text-center text-sm text-slate-400">
                        No hay movimientos registrados.
                      </td>
                    </tr>
                  )}
                  {movimientos.map((m) => (
                    <tr key={m.Kardex_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="py-3 pl-6 pr-4 text-sm text-slate-700 whitespace-nowrap">
                        {m.FechaMovimiento
                          ? new Date(m.FechaMovimiento).toLocaleString('es-MX', {
                              year: 'numeric', month: '2-digit', day: '2-digit',
                              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
                            })
                          : '—'}
                      </td>
                      <td className="py-3 pr-4 text-sm font-mono font-semibold text-[#1b3d86]">{m.SKU}</td>
                      <td className="py-3 pr-4 text-sm text-slate-800">{m.Nombre}</td>
                      <td className="py-3 pr-4 text-sm text-slate-700">{m.AlmacenNombre}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIPO_BADGE[m.TipoMovimiento] || 'border border-slate-200 bg-slate-50 text-slate-600'}`}>
                          {m.TipoMovimiento}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right text-sm font-semibold text-slate-800">{m.Cantidad}</td>
                      <td className="py-3 pr-4 text-right text-sm text-slate-500">{m.Stock_Anterior}</td>
                      <td className="py-3 pr-4 text-right text-sm text-slate-800">{m.Stock_Actual}</td>
                      <td className="py-3 pr-4 text-sm text-slate-600">{m.Referencia || '—'}</td>
                      <td className="py-3 pr-6 text-sm text-slate-600">{m.Usuario}</td>
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
}
