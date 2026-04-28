import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';

const DEFAULT_IVA_RATE = 16.0;

const premiumFieldClass =
  "w-full rounded-[14px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

const premiumSectionClass =
  "rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,253,0.96))] p-5 shadow-[0_8px_24px_rgba(15,45,93,0.07)]";

const generateRandomFacturaReferencia = () => {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `F-${datePart}-${randomPart}`;
};

const emptyItem = () => ({
  Tipo: 'producto', Producto_Id: '', MateriaPrima_Id: '',
  Descripcion: '', Cantidad: 1, PrecioCompra: 0, IVA: DEFAULT_IVA_RATE,
});

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

export default function RegistroDirectoCompra() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [analyzingSheet, setAnalyzingSheet] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState(null);
  const [form, setForm] = useState({
    Company_Id: '', Proveedor_Id: '', FacturaReferencia: generateRandomFacturaReferencia(),
    Moneda: 'MXN', Observaciones: '',
  });
  const [items, setItems] = useState([emptyItem()]);

  useEffect(() => {
    const load = async () => {
      const [cRes, mpRes] = await Promise.all([
        api.get('/companies/'),
        api.get('/materias-primas/'),
      ]);
      setCompanies(cRes.data || []);
      setMateriasPrimas(mpRes.data?.data || mpRes.data || []);
    };
    load().catch(() => notify('Error cargando catalogos', 'error'));
  }, []);

  useEffect(() => {
    if (!form.Company_Id) return;
    const loadFiltered = async () => {
      const [pRes, provRes] = await Promise.all([
        api.get(`/productos/?company_id=${form.Company_Id}`),
        api.get(`/compras/proveedores?Company_Id=${form.Company_Id}`),
      ]);
      setProductos(pRes.data?.data || pRes.data || []);
      setProveedores(provRes.data?.data || []);
    };
    loadFiltered().catch(() => {});
  }, [form.Company_Id]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleItemChange = (idx, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'Producto_Id' && value) {
        const prod = productos.find(p => String(p.Producto_Id) === String(value));
        if (prod) {
          updated[idx].Tipo = 'producto';
          updated[idx].Descripcion = prod.Nombre || prod.SKU || '';
          updated[idx].PrecioCompra = prod.CostoInicial || prod.Precio || 0;
          updated[idx].MateriaPrima_Id = '';
        }
      }
      if (field === 'MateriaPrima_Id' && value) {
        const mp = materiasPrimas.find(m => String(m.MateriaPrima_Id) === String(value));
        if (mp) {
          updated[idx].Tipo = 'mp';
          updated[idx].Descripcion = mp.Nombre || '';
          updated[idx].PrecioCompra = mp.PrecioUnitario || 0;
          updated[idx].Producto_Id = '';
        }
      }
      return updated;
    });
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleAnalyzeSupplierSheet = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('hojaProveedor', file);
    setAnalyzingSheet(true);
    try {
      const res = await api.post('/compras/registro-directo/analizar-hoja', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const parsedItems = res.data?.data?.items || [];
      const resumen = res.data?.data?.resumen || null;
      if (!parsedItems.length) {
        notify('La hoja no genero articulos utilizables', 'warning');
        setAnalysisSummary(null);
        return;
      }
      setItems(parsedItems.map((item) => ({
        Tipo: item.Tipo || 'otro',
        Producto_Id: item.Producto_Id || '',
        MateriaPrima_Id: item.MateriaPrima_Id || '',
        Descripcion: item.Descripcion || '',
        Cantidad: item.Cantidad || 1,
        PrecioCompra: item.PrecioCompra || 0,
        IVA: item.IVA ?? DEFAULT_IVA_RATE,
        ReferenciaProveedor: item.ReferenciaProveedor || '',
        MatchNombre: item.MatchNombre || '',
        MatchCodigo: item.MatchCodigo || '',
        MatchConfidence: item.MatchConfidence || 0,
      })));
      setAnalysisSummary(resumen);
      notify(`Hoja analizada: ${resumen?.materiasLigadas || 0} materias primas ligadas`, 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Error al analizar la hoja del proveedor', 'error');
    } finally {
      event.target.value = '';
      setAnalyzingSheet(false);
    }
  };

  const subtotal = items.reduce((s, it) => s + Number(it.Cantidad) * Number(it.PrecioCompra), 0);
  const totalIVA = items.reduce((s, it) => {
    const sub = Number(it.Cantidad) * Number(it.PrecioCompra);
    return s + sub * (Number(it.IVA ?? DEFAULT_IVA_RATE) / 100);
  }, 0);
  const total = subtotal + totalIVA;
  const fmt = (n) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Company_Id || !form.Proveedor_Id) { notify('Selecciona empresa y proveedor', 'error'); return; }
    if (!form.FacturaReferencia) { notify('Ingresa el numero de factura del proveedor', 'error'); return; }
    if (items.some(it => !it.Descripcion || Number(it.Cantidad) <= 0)) {
      notify('Todos los articulos deben tener descripcion y cantidad > 0', 'error'); return;
    }
    setSaving(true);
    try {
      const res = await api.post('/compras/registro-directo', { ...form, items });
      notify(`Compra registrada: ${res.data.NumeroOC}`, 'success');
      navigate(`/compras/${res.data.OC_Id}`);
    } catch (err) {
      notify(err.response?.data?.message || 'Error al registrar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const smallFieldClass =
    "w-full rounded-[10px] border border-[#dce4f0] bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/15";

  return (
    <div
      className="w-full min-h-screen overflow-auto"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, transparent 60%), radial-gradient(ellipse at 0% 80%, rgba(99,55,197,0.05) 0%, transparent 50%), #f4f7fc' }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Page header */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#6b7a96]">Compras</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1d2430]">Registro Directo con Factura</h1>
          <p className="mt-1 text-sm text-slate-500">Registra una compra que ya cuenta con factura del proveedor, sin pasar por el flujo de autorizacion.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Datos */}
          <div className={premiumSectionClass}>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Encabezado</p>
            <h3 className="mb-4 text-base font-semibold text-slate-900">Datos de la Compra</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Empresa *">
                <select name="Company_Id" value={form.Company_Id} onChange={handleFormChange} required className={premiumFieldClass}>
                  <option value="">— Seleccionar —</option>
                  {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                </select>
              </Field>
              <Field label="Proveedor *">
                <select name="Proveedor_Id" value={form.Proveedor_Id} onChange={handleFormChange} required className={premiumFieldClass}>
                  <option value="">— Seleccionar —</option>
                  {proveedores.map(p => <option key={p.Client_Id} value={p.Client_Id}>{p.ProviderName || p.CommercialName || p.LegalName}</option>)}
                </select>
              </Field>
              <Field label="No. Factura Proveedor *">
                <div className="flex gap-2">
                  <input type="text" name="FacturaReferencia" value={form.FacturaReferencia} onChange={handleFormChange}
                    required placeholder="Ej: FAC-00123" className={premiumFieldClass} />
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, FacturaReferencia: generateRandomFacturaReferencia() }))}
                    className="px-3.5 rounded-[14px] border border-[#dce4f0] bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap shadow-[0_2px_8px_rgba(15,45,93,0.06)]"
                  >
                    Random
                  </button>
                </div>
              </Field>
              <Field label="Moneda">
                <select name="Moneda" value={form.Moneda} onChange={handleFormChange} className={premiumFieldClass}>
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="USD">USD - Dolar Americano</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </Field>
            </div>

            {/* Hoja proveedor */}
            <div className="mt-5 rounded-[20px] border border-blue-200/80 bg-[linear-gradient(135deg,rgba(238,244,255,0.95),rgba(245,249,255,0.92))] p-4 shadow-[0_4px_14px_rgba(27,61,134,0.06)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-indigo-900">Cargar hoja del proveedor</h4>
                  <p className="mt-0.5 text-xs text-indigo-700">Sube la hoja Excel o CSV del proveedor para precargar automaticamente la materia prima adquirida.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-[12px] bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,79,220,0.25)] hover:shadow-[0_6px_20px_rgba(79,79,220,0.35)] transition-shadow">
                  <input type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf" className="hidden"
                    onChange={handleAnalyzeSupplierSheet} disabled={analyzingSheet} />
                  {analyzingSheet ? 'Analizando hoja...' : 'Cargar hoja proveedor'}
                </label>
              </div>
              {analysisSummary && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[14px] border border-blue-100 bg-white px-3.5 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-500">Archivo</div>
                    <div className="mt-1 text-sm font-semibold text-slate-800 break-all">{analysisSummary.archivo}</div>
                  </div>
                  <div className="rounded-[14px] border border-emerald-100 bg-white px-3.5 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-500">Materias ligadas</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-700">{analysisSummary.materiasLigadas}</div>
                  </div>
                  <div className="rounded-[14px] border border-amber-100 bg-white px-3.5 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-500">Pendientes revision</div>
                    <div className="mt-1 text-2xl font-bold text-amber-700">{analysisSummary.lineasPendientes}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <Field label="Observaciones">
                <textarea name="Observaciones" value={form.Observaciones} onChange={handleFormChange}
                  rows={2} className={`${premiumFieldClass} resize-none`} />
              </Field>
            </div>
          </div>

          {/* Detalle items */}
          <div className={premiumSectionClass}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96] mb-0.5">Detalle</p>
                <h3 className="text-base font-semibold text-slate-900">Articulos Comprados</h3>
              </div>
              <button type="button" onClick={addItem}
                className="px-4 py-2 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white text-xs font-semibold shadow-[0_3px_10px_rgba(27,61,134,0.25)] hover:shadow-[0_5px_16px_rgba(27,61,134,0.35)] transition-shadow">
                + Agregar linea
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    <th className="pb-2.5 pr-2 text-left font-bold uppercase tracking-[0.15em] text-[#6b7a96] w-32">Tipo</th>
                    <th className="pb-2.5 pr-2 text-left font-bold uppercase tracking-[0.15em] text-[#6b7a96] w-44">Articulo</th>
                    <th className="pb-2.5 pr-2 text-left font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Descripcion</th>
                    <th className="pb-2.5 pr-2 text-right font-bold uppercase tracking-[0.15em] text-[#6b7a96] w-20">Cant.</th>
                    <th className="pb-2.5 pr-2 text-right font-bold uppercase tracking-[0.15em] text-[#6b7a96] w-28">P. Compra</th>
                    <th className="pb-2.5 pr-2 text-right font-bold uppercase tracking-[0.15em] text-[#6b7a96] w-16">IVA%</th>
                    <th className="pb-2.5 pr-2 text-right font-bold uppercase tracking-[0.15em] text-[#6b7a96] w-28">Total</th>
                    <th className="pb-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaf0fa]">
                  {items.map((it, idx) => {
                    const rowTotal = Number(it.Cantidad) * Number(it.PrecioCompra) * (1 + Number(it.IVA ?? DEFAULT_IVA_RATE) / 100);
                    const tipo = it.Tipo || (it.Producto_Id ? 'producto' : it.MateriaPrima_Id ? 'mp' : 'producto');
                    return (
                      <tr key={idx} className="hover:bg-[#f5f8fe] transition-colors">
                        <td className="py-2.5 pr-2">
                          <select value={tipo}
                            onChange={e => setItems(prev => {
                              const u = [...prev];
                              u[idx] = { ...emptyItem(), Tipo: e.target.value, Descripcion: e.target.value === 'otro' ? u[idx].Descripcion : '' };
                              return u;
                            })}
                            className={smallFieldClass}>
                            <option value="producto">Producto</option>
                            <option value="mp">Mat. Prima</option>
                            <option value="otro">Otro</option>
                          </select>
                        </td>
                        <td className="py-2.5 pr-2">
                          {tipo === 'producto' ? (
                            <select value={it.Producto_Id} onChange={e => handleItemChange(idx, 'Producto_Id', e.target.value)} className={smallFieldClass}>
                              <option value="">— Producto —</option>
                              {productos.map(p => <option key={p.Producto_Id} value={p.Producto_Id}>{p.SKU} - {p.Nombre}</option>)}
                            </select>
                          ) : tipo === 'mp' ? (
                            <div>
                              <select value={it.MateriaPrima_Id} onChange={e => handleItemChange(idx, 'MateriaPrima_Id', e.target.value)} className={smallFieldClass}>
                                <option value="">— Mat. Prima —</option>
                                {materiasPrimas.map(m => <option key={m.MateriaPrima_Id} value={m.MateriaPrima_Id}>{m.Nombre}</option>)}
                              </select>
                              {it.MatchNombre && (
                                <p className="mt-1 text-[11px] text-emerald-700">
                                  Ligada a {it.MatchCodigo ? `${it.MatchCodigo} · ` : ''}{it.MatchNombre}
                                  {it.MatchConfidence ? ` (${it.MatchConfidence}%)` : ''}
                                </p>
                              )}
                            </div>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-2.5 pr-2">
                          <input type="text" value={it.Descripcion} onChange={e => handleItemChange(idx, 'Descripcion', e.target.value)} className={smallFieldClass} />
                        </td>
                        <td className="py-2.5 pr-2">
                          <input type="number" min="0.01" step="0.01" value={it.Cantidad} onChange={e => handleItemChange(idx, 'Cantidad', e.target.value)} className={`${smallFieldClass} text-right`} />
                        </td>
                        <td className="py-2.5 pr-2">
                          <input type="number" min="0" step="0.01" value={it.PrecioCompra} onChange={e => handleItemChange(idx, 'PrecioCompra', e.target.value)} className={`${smallFieldClass} text-right`} />
                        </td>
                        <td className="py-2.5 pr-2">
                          <input type="number" min="0" max="100" step="0.01" value={it.IVA} onChange={e => handleItemChange(idx, 'IVA', e.target.value)} className={`${smallFieldClass} text-right`} />
                        </td>
                        <td className="py-2.5 pr-2 text-right font-semibold text-slate-700">{fmt(rowTotal)}</td>
                        <td className="py-2.5 text-center">
                          {items.length > 1 && (
                            <button type="button" onClick={() => removeItem(idx)}
                              className="h-6 w-6 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 text-xs font-bold transition-colors">
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-medium text-slate-800">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>IVA:</span>
                  <span className="font-medium text-slate-800">{fmt(totalIVA)}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-[#1b3d86] border-t border-[#eaf0fa] pt-2">
                  <span>TOTAL:</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pb-6">
            <button type="button" onClick={() => navigate('/compras')}
              className="px-5 py-2.5 rounded-[14px] border border-[#dce4f0] bg-white text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-[0_2px_8px_rgba(15,45,93,0.06)]">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-[14px] bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-semibold shadow-[0_4px_14px_rgba(16,98,70,0.3)] hover:shadow-[0_6px_20px_rgba(16,98,70,0.4)] transition-shadow disabled:opacity-50">
              {saving ? 'Registrando...' : 'Registrar Compra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
