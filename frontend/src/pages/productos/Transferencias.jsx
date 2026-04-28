import React, { useEffect, useState } from 'react';
import { FaExchangeAlt } from 'react-icons/fa';
import api from '../../services/api';
import { notify } from '../../services/notify';

const premiumFieldClass =
  'w-full rounded-[14px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20';

const premiumSectionClass =
  'rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]';

const smallFieldClass =
  'w-full rounded-[10px] border border-[#dce4f0] bg-white px-2.5 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20';

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</label>
    {children}
  </div>
);

const InfoRow = ({ label, value }) => (
  <div>
    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6b7a96]">{label}</p>
    <p className="mt-0.5 text-sm text-slate-800">{value || '—'}</p>
  </div>
);

export default function Transferencias() {
  const [almacenes, setAlmacenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState({
    Almacen_Origen_Id: '',
    Almacen_Destino_Id: '',
    Referencia: '',
  });
  const [detalles, setDetalles] = useState([{ Producto_Id: '', Cantidad: '', stockDisponible: 0 }]);
  const [loading, setLoading] = useState(false);
  const [viewDetail, setViewDetail] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, pRes] = await Promise.all([
          api.get('/almacenes'),
          api.get('/productos?limit=1000&page=1'),
        ]);
        setAlmacenes(aRes.data || []);
        const arr = pRes.data?.data || pRes.data || [];
        setProductos(arr);
      } catch (err) {
        notify(err.response?.data?.msg || 'Error cargando datos para transferencias', 'error');
      }
    };
    load();
  }, []);

  const updateDetalle = async (idx, patch) => {
    setDetalles((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
    if (patch.Producto_Id && form.Almacen_Origen_Id) {
      try {
        const res = await api.get(`/inventario?productoId=${patch.Producto_Id}&almacenId=${form.Almacen_Origen_Id}`);
        const stock = res.data[0]?.Cantidad || 0;
        setDetalles((prev) => prev.map((d, i) => (i === idx ? { ...d, stockDisponible: stock } : d)));
      } catch {
        // stock stays 0
      }
    }
  };

  const addDetalle = () => {
    setDetalles((prev) => [...prev, { Producto_Id: '', Cantidad: '', stockDisponible: 0 }]);
  };

  const removeDetalle = (idx) => {
    setDetalles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Almacen_Origen_Id || !form.Almacen_Destino_Id) {
      notify('Selecciona almacén origen y destino', 'error');
      return;
    }
    const payload = {
      Almacen_Origen_Id: Number(form.Almacen_Origen_Id),
      Almacen_Destino_Id: Number(form.Almacen_Destino_Id),
      Referencia: form.Referencia || null,
      Detalles: detalles
        .filter((d) => d.Producto_Id && d.Cantidad)
        .map((d) => ({
          Producto_Id: Number(d.Producto_Id),
          Cantidad: Number(d.Cantidad),
        })),
    };
    if (!payload.Detalles.length) {
      notify('Agrega al menos un producto a transferir', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.post('/inventario/transferencias', payload);
      notify('Transferencia realizada', 'success');
      setForm({ Almacen_Origen_Id: '', Almacen_Destino_Id: '', Referencia: '' });
      setDetalles([{ Producto_Id: '', Cantidad: '', stockDisponible: 0 }]);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error realizando transferencia', 'error');
    } finally {
      setLoading(false);
    }
  };

  const viewProductDetail = async (productoId) => {
    try {
      const res = await api.get(`/productos/${productoId}`);
      setViewDetail(res.data);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error cargando producto', 'error');
    }
  };

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6"
      style={{
        background:
          'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb',
      }}
    >
      <div className="mx-auto max-w-5xl space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#1b3d86] to-[#2a5fc4] shadow-[0_4px_14px_rgba(27,61,134,0.35)]">
            <FaExchangeAlt className="text-white text-lg" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Inventario</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Transferencias entre almacenes</h1>
            <p className="text-sm text-slate-500">Movimiento de stock de un almacén a otro</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── General data ── */}
          <div className={premiumSectionClass}>
            <h2 className="mb-4 text-sm font-bold text-[#0d1f3c]">Datos de la Transferencia</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Almacén Origen *">
                <select
                  value={form.Almacen_Origen_Id}
                  onChange={(e) => setForm({ ...form, Almacen_Origen_Id: e.target.value })}
                  className={premiumFieldClass}
                >
                  <option value="">Selecciona origen</option>
                  {almacenes.map((a) => (
                    <option key={a.Almacen_Id} value={a.Almacen_Id}>
                      {a.Nombre} ({a.Codigo})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Almacén Destino *">
                <select
                  value={form.Almacen_Destino_Id}
                  onChange={(e) => setForm({ ...form, Almacen_Destino_Id: e.target.value })}
                  className={premiumFieldClass}
                >
                  <option value="">Selecciona destino</option>
                  {almacenes.map((a) => (
                    <option key={a.Almacen_Id} value={a.Almacen_Id}>
                      {a.Nombre} ({a.Codigo})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Referencia">
                <input
                  type="text"
                  value={form.Referencia}
                  onChange={(e) => setForm({ ...form, Referencia: e.target.value })}
                  placeholder="Ej: Ajuste mensual"
                  className={premiumFieldClass}
                />
              </Field>
            </div>
          </div>

          {/* ── Products to transfer ── */}
          <div className={premiumSectionClass}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0d1f3c]">Productos a transferir</h2>
              <button
                type="button"
                onClick={addDetalle}
                className="rounded-[10px] border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                + Agregar producto
              </button>
            </div>

            {/* Table header */}
            <div className="mb-2 grid grid-cols-12 gap-2 px-1">
              <p className="col-span-6 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Producto</p>
              <p className="col-span-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Cantidad</p>
              <p className="col-span-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Acciones</p>
            </div>

            <div className="space-y-2">
              {detalles.map((d, idx) => (
                <div key={idx} className="grid grid-cols-12 items-start gap-2 rounded-[14px] border border-[#eaf0fa] bg-white px-3 py-3">
                  <div className="col-span-6">
                    <select
                      value={d.Producto_Id}
                      onChange={(e) => updateDetalle(idx, { Producto_Id: e.target.value })}
                      className={smallFieldClass}
                    >
                      <option value="">Selecciona producto</option>
                      {productos.map((p) => (
                        <option key={p.Producto_Id} value={p.Producto_Id}>
                          {p.SKU} — {p.Nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="0"
                      max={d.stockDisponible || undefined}
                      step="0.01"
                      value={d.Cantidad}
                      onChange={(e) => updateDetalle(idx, { Cantidad: e.target.value })}
                      placeholder="Cantidad"
                      className={smallFieldClass}
                    />
                    {d.Producto_Id && d.stockDisponible > 0 && (
                      <p className="mt-0.5 text-[11px] text-emerald-600">Disponible: {d.stockDisponible}</p>
                    )}
                    {d.Producto_Id && d.stockDisponible === 0 && (
                      <p className="mt-0.5 text-[11px] text-rose-500">Sin stock</p>
                    )}
                  </div>
                  <div className="col-span-3 flex gap-1.5">
                    {d.Producto_Id && (
                      <button
                        type="button"
                        onClick={() => viewProductDetail(d.Producto_Id)}
                        className="rounded-[8px] border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Ver
                      </button>
                    )}
                    {detalles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDetalle(idx)}
                        className="rounded-[8px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end border-t border-[#eaf0fa] pt-4">
              <button
                type="submit"
                disabled={loading}
                className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition hover:shadow-[0_6px_20px_rgba(27,61,134,0.40)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Procesando…' : 'Confirmar transferencia'}
              </button>
            </div>
          </div>
        </form>

      </div>

      {/* ── Product detail modal ── */}
      {viewDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-[26px] shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4">
              <h3 className="text-base font-bold text-white">Detalle del Producto</h3>
              <button onClick={() => setViewDetail(null)} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="bg-white p-6">
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="SKU" value={viewDetail.SKU} />
                <InfoRow label="Nombre" value={viewDetail.Nombre} />
                <InfoRow label="Precio" value={typeof viewDetail.Precio === 'number' ? `$${viewDetail.Precio.toFixed(2)}` : viewDetail.Precio} />
                <InfoRow label="Moneda" value={viewDetail.TipoMoneda} />
                <InfoRow label="Clave SAT" value={viewDetail.ClaveProdServSAT} />
                <InfoRow label="Clave Unidad SAT" value={viewDetail.ClaveUnidadSAT} />
                <InfoRow label="Objeto Impuesto" value={viewDetail.ObjetoImpuesto} />
                <InfoRow label="Activo" value={viewDetail.Activo ? 'Sí' : 'No'} />
              </div>
              {viewDetail.Descripcion && (
                <div className="mt-4">
                  <InfoRow label="Descripción" value={viewDetail.Descripcion} />
                </div>
              )}
              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setViewDetail(null)}
                  className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
