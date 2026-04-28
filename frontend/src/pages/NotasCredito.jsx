import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaFileInvoiceDollar } from 'react-icons/fa';
import api from '../services/api';
import { notify } from '../services/notify';

const premiumFieldClass =
  'w-full rounded-[14px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20';

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</label>
    {children}
  </div>
);

function NotasCredito() {
  const navigate = useNavigate();
  const [notas, setNotas] = useState([]);
  const [companyMap, setCompanyMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showTimbrarModal, setShowTimbrarModal] = useState(false);
  const [timbrarNoteId, setTimbrarNoteId] = useState(null);
  const [timbrarPaymentForm, setTimbrarPaymentForm] = useState('01');
  const [timbrarPaymentMethod, setTimbrarPaymentMethod] = useState('PUE');
  const [facturas, setFacturas] = useState([]);
  const [productosFactura, setProductosFactura] = useState([]);
  const [formData, setFormData] = useState({ Factura_Id: '', Motivo: '', productos: [] });

  useEffect(() => { cargarNotas(); cargarFacturas(); }, []);

  const cargarNotas = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notas-credito');
      const items = res.data.data || [];
      setNotas(items);
      const companyIds = Array.from(new Set(items.map(i => i.Company_Id).filter(Boolean)));
      if (companyIds.length) {
        const map = {};
        await Promise.all(companyIds.map(async (cid) => {
          try { const r = await api.get(`/companies/${cid}`); map[cid] = r.data || null; }
          catch { map[cid] = null; }
        }));
        setCompanyMap(map);
      }
    } catch { notify('Error al cargar notas de crédito', 'error'); }
    finally { setLoading(false); }
  };

  const cargarFacturas = async () => {
    try { const res = await api.get('/reporteria/facturas'); setFacturas(res.data.data || []); }
    catch { /* silent */ }
  };

  const cargarProductosFactura = async (facturaId) => {
    try {
      const res = await api.get(`/notas-credito/factura/${facturaId}/productos`);
      setProductosFactura((res.data.data || []).map(d => ({
        Producto_Id: d.Producto_Id,
        Descripcion: d.ProductoNombre || d.Nombre || 'Sin nombre',
        Cantidad: d.Cantidad, PrecioUnitario: d.PrecioUnitario,
        CantidadOriginal: d.Cantidad, seleccionado: false
      })));
    } catch { setProductosFactura([]); }
  };

  const handleFacturaChange = (facturaId) => {
    setFormData({ ...formData, Factura_Id: facturaId });
    if (facturaId) cargarProductosFactura(facturaId); else setProductosFactura([]);
  };

  const toggleProducto = (index) => {
    const n = [...productosFactura]; n[index].seleccionado = !n[index].seleccionado; setProductosFactura(n);
  };

  const actualizarCantidad = (index, cantidad) => {
    const n = [...productosFactura]; n[index].Cantidad = parseFloat(cantidad) || 0; setProductosFactura(n);
  };

  const handleCrearNota = async () => {
    if (!formData.Factura_Id || !formData.Motivo) { notify('Completa todos los campos', 'warning'); return; }
    const seleccionados = productosFactura.filter(p => p.seleccionado).map(p => ({
      Producto_Id: p.Producto_Id, Descripcion: p.Descripcion, Cantidad: p.Cantidad,
      PrecioUnitario: p.PrecioUnitario, Subtotal: p.Cantidad * p.PrecioUnitario,
      IVA: p.Cantidad * p.PrecioUnitario * 0.16, Total: p.Cantidad * p.PrecioUnitario * 1.16
    }));
    if (seleccionados.length === 0) { notify('Selecciona al menos un producto', 'warning'); return; }
    try {
      await api.post('/notas-credito', { ...formData, productos: seleccionados });
      notify('Nota de crédito creada exitosamente', 'success');
      setShowModal(false); cargarNotas();
      setFormData({ Factura_Id: '', Motivo: '', productos: [] }); setProductosFactura([]);
    } catch (error) { notify(error.response?.data?.message || 'Error al crear nota de crédito', 'error'); }
  };

  const openTimbrarModal = (id) => {
    setTimbrarNoteId(id); setTimbrarPaymentForm('01'); setTimbrarPaymentMethod('PUE'); setShowTimbrarModal(true);
  };

  const handleTimbrar = async () => {
    try {
      await api.post(`/notas-credito/${timbrarNoteId}/timbrar`, { PaymentForm: timbrarPaymentForm, PaymentMethod: timbrarPaymentMethod });
      notify('Nota de crédito timbrada exitosamente', 'success');
      setShowTimbrarModal(false); setTimbrarNoteId(null); cargarNotas();
    } catch (error) { notify(error.response?.data?.message || 'Error al timbrar', 'error'); }
  };

  const handleVerNota = async (id) => {
    try {
      const response = await api.get(`/notas-credito/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error) { notify(error.response?.data?.message || 'Error al descargar PDF', 'error'); }
  };

  const handleDescargarPdf = async (id) => {
    try {
      const response = await api.get(`/notas-credito/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `nota_credito_${id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error) { notify(error.response?.data?.message || 'Error al descargar PDF', 'error'); }
  };

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#1b3d86] to-[#2a5fc4] shadow-[0_4px_14px_rgba(27,61,134,0.35)]">
              <FaFileInvoiceDollar className="text-white text-lg" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Ventas</p>
              <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Notas de Crédito</h1>
              <p className="text-sm text-slate-500">Gestión de notas de crédito (CFDI Egreso)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/reporteria')} className="flex items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
              ← Volver
            </button>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.40)] transition">
              + Nueva Nota
            </button>
          </div>
        </div>

        {/* Table */}
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
                    {['Folio', 'Factura', 'Motivo', 'Total', 'Status', 'Acciones'].map((col, i) => (
                      <th key={col} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i === 3 ? 'text-right' : i === 5 ? 'text-center' : ''}`}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notas.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">No hay notas de crédito</td></tr>
                  ) : notas.map((nota) => (
                    <tr key={nota.NotaCredito_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="py-3 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          {companyMap[nota.Company_Id]?.LogoUrl ? (
                            <img src={companyMap[nota.Company_Id].LogoUrl} alt="logo" className="h-8 w-8 object-contain rounded" />
                          ) : (
                            <div className="h-8 w-8 rounded-[8px] bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">—</div>
                          )}
                          {nota.UUID ? (
                            <span className="text-sm font-semibold text-slate-800">{nota.Serie || ''}{nota.Folio || ''}</span>
                          ) : (
                            <span className="text-sm italic text-slate-400">Sin timbrar</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        <span className="font-semibold text-[#3b6fd4]">Factura #{nota.Factura_Id}</span>
                        {nota.FacturaSerie && nota.FacturaFolio && (
                          <span className="ml-1 text-xs text-slate-400">({nota.FacturaSerie}{nota.FacturaFolio})</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-sm text-slate-700">{nota.Motivo}</td>
                      <td className="py-3 pr-4 text-sm font-semibold text-right text-slate-800">
                        ${(nota.Total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${nota.Status === 'Vigente' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>
                          {nota.Status || 'Pendiente'}
                        </span>
                      </td>
                      <td className="py-3 pr-6 text-center">
                        {nota.UUID ? (
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleVerNota(nota.NotaCredito_Id)} className="rounded-[8px] border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition" title="Ver PDF">👁️</button>
                            <button onClick={() => handleDescargarPdf(nota.NotaCredito_Id)} className="rounded-[8px] border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition" title="Descargar">📥</button>
                          </div>
                        ) : (
                          <button onClick={() => openTimbrarModal(nota.NotaCredito_Id)} className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition">Timbrar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal crear nota */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-4xl max-h-[90vh] flex-col overflow-hidden rounded-[26px] shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex-shrink-0">
              <h3 className="text-base font-bold text-white">Nueva Nota de Crédito</h3>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto bg-white p-6 space-y-4">
              <Field label="Factura">
                <select value={formData.Factura_Id} onChange={(e) => handleFacturaChange(e.target.value)} className={premiumFieldClass}>
                  <option value="">Seleccionar factura</option>
                  {facturas.map(f => (
                    <option key={f.Factura_Id} value={f.Factura_Id}>{f.Serie}{f.Folio} — {f.ReceptorNombre} — ${f.Total}</option>
                  ))}
                </select>
              </Field>
              <Field label="Motivo">
                <textarea value={formData.Motivo} onChange={(e) => setFormData({ ...formData, Motivo: e.target.value })} rows={2} placeholder="Devolución, descuento, error…" className={premiumFieldClass + ' resize-none'} />
              </Field>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Productos a Acreditar</p>
                {productosFactura.length === 0 ? (
                  <div className="rounded-[14px] border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">💡 Selecciona una factura para ver sus productos</div>
                ) : (
                  <div className="rounded-[14px] border border-[#eaf0fa] overflow-hidden">
                    <div className="grid grid-cols-5 gap-2 border-b border-[#eaf0fa] bg-[#f4f7ff] p-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96]">
                      <span>Sel.</span><span>Producto</span><span>Cant. Orig.</span><span>Cant. Acreditar</span><span className="text-right">Precio Unit.</span>
                    </div>
                    {productosFactura.map((prod, idx) => (
                      <div key={idx} className="grid grid-cols-5 gap-2 border-b border-[#eaf0fa] p-2.5 items-center transition hover:bg-[#f4f7ff]/50">
                        <input type="checkbox" checked={prod.seleccionado} onChange={() => toggleProducto(idx)} className="h-4 w-4 rounded border-slate-300 text-[#3b6fd4]" />
                        <span className="text-sm text-slate-800">{prod.Descripcion}</span>
                        <span className="text-sm text-slate-500">{prod.CantidadOriginal}</span>
                        <input type="number" value={prod.Cantidad} onChange={(e) => actualizarCantidad(idx, e.target.value)} disabled={!prod.seleccionado} max={prod.CantidadOriginal} className="rounded-[8px] border border-[#dce4f0] px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400 outline-none focus:border-[#3b6fd4]" />
                        <span className="text-sm font-semibold text-right text-slate-800">${prod.PrecioUnitario.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#eaf0fa] bg-white px-6 py-4">
              <button onClick={() => setShowModal(false)} className="rounded-[14px] border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleCrearNota} className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)]">Crear Nota</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal timbrar */}
      {showTimbrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-[26px] shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4">
              <h3 className="text-base font-bold text-white">Timbrar Nota de Crédito</h3>
              <button onClick={() => setShowTimbrarModal(false)} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="bg-white p-6 space-y-4">
              <Field label="Forma de Pago">
                <select value={timbrarPaymentForm} onChange={(e) => setTimbrarPaymentForm(e.target.value)} className={premiumFieldClass}>
                  <option value="01">01 — Efectivo</option>
                  <option value="03">03 — Transferencia electrónica</option>
                  <option value="04">04 — Tarjeta de crédito</option>
                  <option value="28">28 — Tarjeta de débito</option>
                  <option value="99">99 — Por definir</option>
                </select>
              </Field>
              <Field label="Método de Pago">
                <select value={timbrarPaymentMethod} onChange={(e) => setTimbrarPaymentMethod(e.target.value)} className={premiumFieldClass}>
                  <option value="PUE">PUE — Pago en una sola exhibición</option>
                  <option value="PPD">PPD — Pago en parcialidades</option>
                </select>
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowTimbrarModal(false)} className="rounded-[14px] border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button onClick={handleTimbrar} className="rounded-[14px] bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(5,150,105,0.30)]">Timbrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotasCredito;
