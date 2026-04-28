import React, { useEffect, useState } from 'react';
import { FaTags } from 'react-icons/fa';
import api from '../../services/api';
import { notify } from '../../services/notify';

const premiumFieldClass =
  'w-full rounded-[14px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20';

const disabledFieldClass =
  'w-full rounded-[14px] border border-[#eaf0fa] bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 cursor-not-allowed';

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</label>
    {children}
  </div>
);

export default function CatalogoPrecios() {
  const [productos, setProductos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalSolicitud, setModalSolicitud] = useState(false);
  const [modalAprobacion, setModalAprobacion] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [precioNuevo, setPrecioNuevo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [solicitudAprobacion, setSolicitudAprobacion] = useState(null);
  const [codigoAprobacion, setCodigoAprobacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/productos?limit=1000');
      setProductos(res.data?.data || []);
    } catch {
      notify('Error cargando productos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSolicitudes = async () => {
    try {
      const res = await api.get('/precios/solicitudes');
      setSolicitudes(res.data || []);
    } catch {
      notify('Error cargando solicitudes', 'error');
    }
  };

  useEffect(() => {
    fetchProductos();
    fetchSolicitudes();
  }, []);

  const abrirSolicitud = (producto) => {
    setProductoSeleccionado(producto);
    setPrecioNuevo(producto.Precio);
    setMotivo('');
    setModalSolicitud(true);
  };

  const enviarSolicitud = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post('/precios/solicitar', {
        Producto_Id: productoSeleccionado.Producto_Id,
        PrecioNuevo: parseFloat(precioNuevo),
        Motivo: motivo
      });
      notify('Solicitud enviada. Revise su correo para el código de aprobación.', 'success');
      setModalSolicitud(false);
      fetchSolicitudes();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al enviar solicitud', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const abrirAprobacion = (solicitud) => {
    setSolicitudAprobacion(solicitud);
    setCodigoAprobacion('');
    setModalAprobacion(true);
  };

  const aprobarCambio = async (e) => {
    e.preventDefault();
    try {
      await api.post('/precios/aprobar', {
        Solicitud_Id: solicitudAprobacion.Solicitud_Id,
        CodigoAprobacion: codigoAprobacion
      });
      notify('Cambio de precio aprobado', 'success');
      setModalAprobacion(false);
      fetchSolicitudes();
      fetchProductos();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al aprobar cambio', 'error');
    }
  };

  const eliminarSolicitud = async (solicitudId) => {
    try {
      await api.delete(`/precios/solicitudes/${solicitudId}`);
      notify('Solicitud eliminada', 'success');
      fetchSolicitudes();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al eliminar solicitud', 'error');
    }
  };

  const pendientes = solicitudes.filter(s => s.Estado === 'PENDIENTE');

  const productosFiltrados = productos.filter(p => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (p.SKU || '').toLowerCase().includes(q) || (p.Nombre || '').toLowerCase().includes(q);
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
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#1b3d86] to-[#2a5fc4] shadow-[0_4px_14px_rgba(27,61,134,0.35)]">
            <FaTags className="text-white text-lg" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Productos</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Catálogo de Precios</h1>
            <p className="text-sm text-slate-500">Gestión de precios con aprobación</p>
          </div>
        </div>

        {/* ── Pending requests ── */}
        {pendientes.length > 0 && (
          <div className="rounded-[28px] border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.97)_0%,rgba(254,243,199,0.7)_100%)] shadow-[0_4px_20px_rgba(245,158,11,0.10)] overflow-hidden">
            <div className="border-b border-amber-200/60 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {pendientes.length}
                </span>
                <h2 className="text-sm font-bold text-amber-900">Solicitudes Pendientes de Aprobación</h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-amber-200/50">
                    {['Producto', 'Precio Actual', 'Precio Nuevo', 'Estado', 'Acciones'].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700 first:pl-6 last:pr-6">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map(s => (
                    <tr key={s.Solicitud_Id} className="border-t border-amber-100 transition hover:bg-amber-50/40">
                      <td className="py-3 pl-6 pr-4 text-sm font-medium text-slate-800">{s.Nombre}</td>
                      <td className="py-3 pr-4 text-sm text-slate-600">${Number(s.PrecioActual).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 pr-4 text-sm font-semibold text-emerald-700">${Number(s.PrecioNuevo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          {s.Estado}
                        </span>
                      </td>
                      <td className="py-3 pr-6">
                        <div className="flex gap-2">
                          <button
                            onClick={() => abrirAprobacion(s)}
                            className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => eliminarSolicitud(s.Solicitud_Id)}
                            className="rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Filter bar ── */}
        <div className="flex items-center gap-3 rounded-[26px] border border-white/70 bg-white/80 px-5 py-3.5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por SKU o nombre…"
            className="w-full max-w-xs rounded-[12px] border border-[#dce4f0] bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Limpiar
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400">{productosFiltrados.length} productos</span>
        </div>

        {/* ── Products table ── */}
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
                    {['SKU', 'Nombre', 'Precio Actual', 'Acción'].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 last:text-center">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400">
                        No se encontraron productos.
                      </td>
                    </tr>
                  )}
                  {productosFiltrados.map(p => (
                    <tr key={p.Producto_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="py-3 pl-6 pr-4 font-mono text-sm font-semibold text-[#1b3d86]">{p.SKU}</td>
                      <td className="py-3 pr-4 text-sm text-slate-800">{p.Nombre}</td>
                      <td className="py-3 pr-4 text-sm font-semibold text-slate-800">
                        ${Number(p.Precio ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 pr-6 text-center">
                        <button
                          onClick={() => abrirSolicitud(p)}
                          className="rounded-[10px] border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                        >
                          Solicitar cambio
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

      {/* ── Modal solicitar cambio ── */}
      {modalSolicitud && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-[26px] shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4">
              <h3 className="text-base font-bold text-white">Solicitar Cambio de Precio</h3>
              <button onClick={() => setModalSolicitud(false)} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="bg-white p-6">
              <form onSubmit={enviarSolicitud} className="space-y-4">
                <Field label="Producto">
                  <input type="text" value={productoSeleccionado?.Nombre} disabled className={disabledFieldClass} />
                </Field>
                <Field label="Precio Actual">
                  <input type="text" value={`$${productoSeleccionado?.Precio}`} disabled className={disabledFieldClass} />
                </Field>
                <Field label="Precio Nuevo *">
                  <input
                    type="number"
                    step="0.01"
                    value={precioNuevo}
                    onChange={(e) => setPrecioNuevo(e.target.value)}
                    required
                    className={premiumFieldClass}
                  />
                </Field>
                <Field label="Motivo">
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    className={premiumFieldClass + ' resize-none'}
                  />
                </Field>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setModalSolicitud(false)}
                    disabled={enviando}
                    className="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enviando}
                    className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {enviando ? 'Enviando…' : 'Enviar Solicitud'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal aprobar cambio ── */}
      {modalAprobacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-[26px] shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-4">
              <h3 className="text-base font-bold text-white">Aprobar Cambio de Precio</h3>
              <button onClick={() => setModalAprobacion(false)} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="bg-white p-6">
              <form onSubmit={aprobarCambio} className="space-y-4">
                <Field label="Producto">
                  <input type="text" value={solicitudAprobacion?.Nombre} disabled className={disabledFieldClass} />
                </Field>
                <div className="flex gap-3">
                  <Field label="Precio Actual">
                    <input type="text" value={`$${solicitudAprobacion?.PrecioActual}`} disabled className={disabledFieldClass} />
                  </Field>
                  <Field label="Precio Nuevo">
                    <input type="text" value={`$${solicitudAprobacion?.PrecioNuevo}`} disabled className={disabledFieldClass} />
                  </Field>
                </div>
                <Field label="Código de Aprobación *">
                  <input
                    type="text"
                    value={codigoAprobacion}
                    onChange={(e) => setCodigoAprobacion(e.target.value.toUpperCase())}
                    required
                    placeholder="Código recibido por correo"
                    className={premiumFieldClass}
                  />
                </Field>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setModalAprobacion(false)}
                    className="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-[14px] bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(5,150,105,0.30)]"
                  >
                    Aprobar Cambio
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
