import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';

function api(path) {
  return axios.get(`${BASE}${path}`);
}
function apiPost(path, data) {
  return axios.post(`${BASE}${path}`, data);
}

function toCurrency(value) {
  return Number(value || 0).toLocaleString('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
  });
}
function toDate(value) {
  return value ? new Date(String(value).slice(0, 10)).toLocaleDateString('es-MX') : '—';
}

const STATUS_STYLE = {
  BORRADOR: 'bg-slate-100 text-slate-700',
  ENVIADA: 'bg-sky-100 text-sky-700',
  APROBADA: 'bg-emerald-100 text-emerald-700',
  PENDIENTE_APROBACION: 'bg-amber-100 text-amber-700',
  VENCIDA: 'bg-rose-100 text-rose-700',
  CANCELADA: 'bg-rose-100 text-rose-700',
  CONVERTIDA: 'bg-violet-100 text-violet-700',
};

export default function PortalCliente() {
  const { token } = useParams();
  const [cliente, setCliente] = useState(null);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [tab, setTab] = useState('cotizaciones');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Detalle de cotización
  const [selectedCot, setSelectedCot] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [aprobadoMsg, setAprobadoMsg] = useState('');

  useEffect(() => {
    loadPortal();
  }, [token]);

  async function loadPortal() {
    setLoading(true);
    setError('');
    try {
      const [infoRes, cotRes, facRes] = await Promise.all([
        api(`/portal/${token}`),
        api(`/portal/${token}/cotizaciones`),
        api(`/portal/${token}/facturas`),
      ]);
      setCliente(infoRes.data);
      setCotizaciones(Array.isArray(cotRes.data) ? cotRes.data : []);
      setFacturas(Array.isArray(facRes.data) ? facRes.data : []);
    } catch (e) {
      setError(e?.response?.data?.detail || 'No fue posible cargar el portal. Verifica el enlace.');
    } finally {
      setLoading(false);
    }
  }

  async function openDetalle(cot) {
    setSelectedCot(cot);
    setDetalle(null);
    setAprobadoMsg('');
    setLoadingDetalle(true);
    try {
      const res = await api(`/portal/${token}/cotizaciones/${cot.Cotizacion_Id}`);
      setDetalle(res.data);
    } catch {
      setDetalle(null);
    } finally {
      setLoadingDetalle(false);
    }
  }

  async function handleAprobar() {
    if (!selectedCot) return;
    setAprobando(true);
    try {
      const res = await apiPost(`/portal/${token}/cotizaciones/${selectedCot.Cotizacion_Id}/aprobar`, {});
      setAprobadoMsg(res.data?.message || 'Cotización aprobada');
      // Actualizar estatus en la lista local
      setCotizaciones((prev) => prev.map((c) =>
        c.Cotizacion_Id === selectedCot.Cotizacion_Id ? { ...c, Status: 'APROBADA' } : c
      ));
      setSelectedCot((prev) => prev ? { ...prev, Status: 'APROBADA' } : prev);
    } catch (e) {
      setAprobadoMsg(e?.response?.data?.detail || 'Error al aprobar');
    } finally {
      setAprobando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500 text-sm">Cargando portal...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Enlace inválido</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#092052] text-white px-6 py-4 flex items-center justify-between shadow">
        <div>
          <div className="text-lg font-bold">Portal de Cliente</div>
          <div className="text-sm opacity-80">{cliente?.Nombre}</div>
        </div>
        <div className="text-xs opacity-60">{cliente?.RFC}</div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {[['cotizaciones', 'Cotizaciones'], ['facturas', 'Facturas']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSelectedCot(null); setDetalle(null); }}
              className={`px-5 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                tab === key ? 'border-[#092052] text-[#092052]' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* COTIZACIONES */}
        {tab === 'cotizaciones' && !selectedCot && (
          <>
            {cotizaciones.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
                No hay cotizaciones activas.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Folio</th>
                      <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                      <th className="px-4 py-3 text-left font-semibold">Vencimiento</th>
                      <th className="px-4 py-3 text-left font-semibold">Estatus</th>
                      <th className="px-4 py-3 text-right font-semibold">Total</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cotizaciones.map((cot) => (
                      <tr key={cot.Cotizacion_Id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{cot.FolioCotizacion || `#${cot.Cotizacion_Id}`}</td>
                        <td className="px-4 py-3 text-gray-700">{toDate(cot.FechaCreacion)}</td>
                        <td className="px-4 py-3 text-gray-700">{toDate(cot.FechaVencimiento)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[cot.Status] || 'bg-gray-100 text-gray-700'}`}>
                            {cot.Status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{toCurrency(cot.Total)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openDetalle(cot)}
                            className="rounded-lg bg-[#092052] px-3 py-1.5 text-xs text-white hover:bg-[#0d347d]"
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* DETALLE COTIZACIÓN */}
        {tab === 'cotizaciones' && selectedCot && (
          <div>
            <button
              onClick={() => { setSelectedCot(null); setDetalle(null); setAprobadoMsg(''); }}
              className="mb-4 flex items-center gap-1 text-sm text-[#092052] hover:underline"
            >
              ← Volver a cotizaciones
            </button>

            {loadingDetalle ? (
              <div className="text-center text-sm text-gray-500 py-10">Cargando detalle...</div>
            ) : detalle ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
                {/* Encabezado */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {detalle.cotizacion.FolioCotizacion || `Cotización #${detalle.cotizacion.Cotizacion_Id}`}
                    </h2>
                    <p className="text-sm text-gray-500">{detalle.cotizacion.EmpresaNombre}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[selectedCot.Status] || 'bg-gray-100 text-gray-700'}`}>
                      {selectedCot.Status}
                    </span>
                    {(selectedCot.Status === 'ENVIADA' || selectedCot.Status === 'PENDIENTE_APROBACION') && !aprobadoMsg && (
                      <button
                        onClick={handleAprobar}
                        disabled={aprobando}
                        className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {aprobando ? 'Aprobando...' : 'Aprobar cotización'}
                      </button>
                    )}
                  </div>
                </div>

                {aprobadoMsg && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
                    {aprobadoMsg}
                  </div>
                )}

                {/* Fechas */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Fecha emisión</div>
                    <div className="font-medium">{toDate(detalle.cotizacion.FechaCreacion)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Vencimiento</div>
                    <div className="font-medium">{toDate(detalle.cotizacion.FechaVencimiento)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Vendedor</div>
                    <div className="font-medium">{detalle.cotizacion.VendedorNombre || '—'}</div>
                  </div>
                </div>

                {/* Renglones */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Productos / Servicios</h3>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold">#</th>
                          <th className="px-4 py-2 text-left font-semibold">Descripción</th>
                          <th className="px-4 py-2 text-right font-semibold">Cant.</th>
                          <th className="px-4 py-2 text-right font-semibold">Precio Unit.</th>
                          <th className="px-4 py-2 text-right font-semibold">Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.renglones.map((r, i) => (
                          <tr key={r.Renglon_Id || i} className="border-t border-gray-100">
                            <td className="px-4 py-2 text-gray-500">{r.Renglon || i + 1}</td>
                            <td className="px-4 py-2">
                              <div className="font-medium text-gray-900">{r.ProductoNombre || r.Descripcion}</div>
                              {r.SKU && <div className="text-xs text-gray-500">SKU: {r.SKU}</div>}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">{Number(r.Cantidad || 0).toLocaleString('es-MX')}</td>
                            <td className="px-4 py-2 text-right text-gray-700">{toCurrency(r.PrecioUnitario)}</td>
                            <td className="px-4 py-2 text-right font-medium text-gray-900">{toCurrency(r.Importe || (r.Cantidad * r.PrecioUnitario))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totales */}
                <div className="flex justify-end">
                  <div className="w-full max-w-xs space-y-1 text-sm">
                    {detalle.cotizacion.Subtotal != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium">{toCurrency(detalle.cotizacion.Subtotal)}</span>
                      </div>
                    )}
                    {detalle.cotizacion.IVA != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">IVA</span>
                        <span className="font-medium">{toCurrency(detalle.cotizacion.IVA)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-gray-200 pt-2">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="font-bold text-gray-900 text-base">{toCurrency(detalle.cotizacion.Total)}</span>
                    </div>
                  </div>
                </div>

                {detalle.cotizacion.Notas && (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                    <span className="font-medium">Notas:</span> {detalle.cotizacion.Notas}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-sm text-gray-500 py-10">No se pudo cargar el detalle.</div>
            )}
          </div>
        )}

        {/* FACTURAS */}
        {tab === 'facturas' && (
          <>
            {facturas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
                No hay facturas emitidas.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Folio</th>
                      <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                      <th className="px-4 py-3 text-left font-semibold">Vencimiento</th>
                      <th className="px-4 py-3 text-left font-semibold">UUID</th>
                      <th className="px-4 py-3 text-left font-semibold">Estatus</th>
                      <th className="px-4 py-3 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((f) => (
                      <tr key={f.Factura_Id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{f.Serie}{f.Folio}</td>
                        <td className="px-4 py-3 text-gray-700">{toDate(f.FechaEmision)}</td>
                        <td className="px-4 py-3 text-gray-700">{toDate(f.FechaVencimiento)}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-gray-500">{f.UUID ? f.UUID.slice(0, 8) + '...' : '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[f.Estatus] || 'bg-gray-100 text-gray-700'}`}>
                            {f.Estatus || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{toCurrency(f.Total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="mt-16 pb-6 text-center text-xs text-gray-400">
        Portal de autoservicio — Ardaby Tec SA de CV
      </footer>
    </div>
  );
}
