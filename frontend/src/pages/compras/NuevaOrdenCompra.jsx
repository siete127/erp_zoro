import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';
import {
  operationContainerClass,
  operationPageClass,
  operationPrimaryButtonClass,
  operationSecondaryButtonClass,
  OperationHeader,
  OperationSectionTitle,
  OperationStat,
} from '../../components/operation/OperationUI';

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
  Tipo: 'producto',
  Producto_Id: '',
  MateriaPrima_Id: '',
  Descripcion: '',
  Cantidad: 1,
  PrecioCompra: 0,
  IVA: DEFAULT_IVA_RATE,
});

const toInputDate = (value) => {
  if (!value) return '';
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString('es-MX') : 'Sin fecha');

const buildReqObservation = (req) => {
  const header = `Generada desde requisicion ${req.NumeroReq}`;
  return req.Notas ? `${header}\n${req.Notas}` : header;
};

const mapReqLineToItem = (linea) => ({
  Tipo: linea.Producto_Id ? 'producto' : linea.MateriaPrima_Id ? 'mp' : 'otro',
  Producto_Id: linea.Producto_Id ? String(linea.Producto_Id) : '',
  MateriaPrima_Id: linea.MateriaPrima_Id ? String(linea.MateriaPrima_Id) : '',
  Descripcion: linea.Descripcion || linea.ProductoNombre || linea.MateriaPrimaNombre || '',
  Cantidad: Number(linea.CantidadSolicitada || 1),
  PrecioCompra: Number(linea.CostoEstimado || 0),
  IVA: DEFAULT_IVA_RATE,
});

const fmtMoney = (value) =>
  `$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

export default function NuevaOrdenCompra() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requisicionIdParam = searchParams.get('requisicion_id');

  const [companies, setCompanies] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [requisicionesDisponibles, setRequisicionesDisponibles] = useState([]);
  const [requisicionContext, setRequisicionContext] = useState(null);
  const [loadingRequisicion, setLoadingRequisicion] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    Company_Id: '',
    Proveedor_Id: '',
    Requisicion_Id: requisicionIdParam || '',
    FechaRequerida: '',
    Moneda: 'MXN',
    RequiereDobleAutorizacion: true,
    FacturaReferencia: generateRandomFacturaReferencia(),
    Observaciones: '',
  });
  const [items, setItems] = useState([emptyItem()]);

  const loadRequisicion = async (reqId) => {
    if (!reqId) return;
    setLoadingRequisicion(true);
    try {
      const res = await api.get(`/requisiciones/${reqId}`);
      const req = res.data || {};
      const mappedItems = (req.lineas || []).map(mapReqLineToItem);
      setRequisicionContext(req);
      setItems(mappedItems.length ? mappedItems : [emptyItem()]);
      setForm((prev) => ({
        ...prev,
        Company_Id: req.Company_Id ? String(req.Company_Id) : prev.Company_Id,
        Proveedor_Id: '',
        Requisicion_Id: String(req.Req_Id || reqId),
        FechaRequerida: toInputDate(req.FechaRequerida),
        Observaciones: buildReqObservation(req),
      }));
    } catch (err) {
      setRequisicionContext(null);
      setItems([emptyItem()]);
      setForm((prev) => ({ ...prev, Requisicion_Id: '' }));
      notify(err.response?.data?.detail || 'Error cargando requisicion', 'error');
    } finally {
      setLoadingRequisicion(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, pRes, mpRes] = await Promise.all([
          api.get('/companies/'),
          api.get('/compras/proveedores'),
          api.get('/materias-primas/'),
        ]);
        setCompanies(cRes.data || []);
        setProveedores(pRes.data?.data || []);
        setMateriasPrimas(mpRes.data?.data || mpRes.data || []);
      } catch {
        notify('Error cargando catalogos', 'error');
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!form.Company_Id) {
      setProductos([]);
      setRequisicionesDisponibles([]);
      return;
    }
    const loadFiltered = async () => {
      try {
        const [pRes, provRes, reqRes] = await Promise.all([
          api.get(`/productos/?company_id=${form.Company_Id}`),
          api.get(`/compras/proveedores?Company_Id=${form.Company_Id}`),
          api.get(`/requisiciones/?company_id=${form.Company_Id}`),
        ]);
        const reqs = Array.isArray(reqRes.data) ? reqRes.data : [];
        setProductos(pRes.data?.data || pRes.data || []);
        setProveedores(provRes.data?.data || []);
        setRequisicionesDisponibles(
          reqs.filter(
            (req) => req.Estatus === 'APROBADA' || String(req.Req_Id) === String(form.Requisicion_Id || ''),
          ),
        );
      } catch {
        // ignore
      }
    };
    loadFiltered();
  }, [form.Company_Id, form.Requisicion_Id]);

  useEffect(() => {
    if (!requisicionIdParam) return;
    loadRequisicion(requisicionIdParam);
  }, [requisicionIdParam]);

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'Company_Id' && value !== String(form.Company_Id || '')) {
      if (form.Requisicion_Id) {
        setRequisicionContext(null);
        setItems([emptyItem()]);
      }
      setForm((prev) => ({
        ...prev,
        Company_Id: value,
        Proveedor_Id: '',
        Requisicion_Id: '',
        Observaciones: prev.Requisicion_Id ? '' : prev.Observaciones,
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleRequisicionChange = async (e) => {
    const value = e.target.value;
    if (!value) {
      setRequisicionContext(null);
      setItems([emptyItem()]);
      setForm((prev) => ({ ...prev, Requisicion_Id: '', Proveedor_Id: '', Observaciones: '' }));
      return;
    }
    await loadRequisicion(value);
  };

  const handleItemChange = (idx, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'Producto_Id' && value) {
        const prod = productos.find((p) => String(p.Producto_Id) === String(value));
        if (prod) {
          updated[idx].Tipo = 'producto';
          updated[idx].Descripcion = prod.Nombre || prod.SKU || '';
          updated[idx].PrecioCompra = prod.CostoInicial || prod.Precio || 0;
          updated[idx].MateriaPrima_Id = '';
        }
      }
      if (field === 'MateriaPrima_Id' && value) {
        const mp = materiasPrimas.find((m) => String(m.MateriaPrima_Id) === String(value));
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

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((sum, item) => sum + Number(item.Cantidad) * Number(item.PrecioCompra), 0);
  const totalIVA = items.reduce((sum, item) => {
    const lineSubtotal = Number(item.Cantidad) * Number(item.PrecioCompra);
    return sum + lineSubtotal * (Number(item.IVA ?? DEFAULT_IVA_RATE) / 100);
  }, 0);
  const total = subtotal + totalIVA;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Company_Id || !form.Proveedor_Id) {
      notify('Selecciona empresa y proveedor', 'error');
      return;
    }
    if (items.some((item) => !item.Descripcion || Number(item.Cantidad) <= 0)) {
      notify('Todas las lineas deben tener descripcion y cantidad mayor a 0', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        Requisicion_Id: form.Requisicion_Id ? Number(form.Requisicion_Id) : null,
        items,
      };
      const res = await api.post('/compras/ordenes', payload);
      notify(`OC creada: ${res.data.NumeroOC}`, 'success');
      navigate(`/compras/${res.data.OC_Id}`);
    } catch (err) {
      notify(err.response?.data?.message || 'Error al crear orden', 'error');
    } finally {
      setSaving(false);
    }
  };

  const smallFieldClass =
    "w-full rounded-[10px] border border-[#dce4f0] bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/15";

  return (
    <div className={operationPageClass}>
      <div className={`${operationContainerClass} max-w-5xl`}>
        <OperationHeader
          eyebrow="Compras"
          title="Nueva Orden de Compra"
          description="Captura el encabezado, vincula requisiciones aprobadas y construye lineas de producto o materia prima con el mismo lenguaje visual operativo."
          stats={
            <>
              <OperationStat label="Lineas activas" value={items.length} tone="blue" />
              <OperationStat label="Requisicion" value={requisicionContext?.NumeroReq || 'Manual'} tone="slate" />
              <OperationStat label="Total estimado" value={fmtMoney(total)} tone="emerald" />
            </>
          }
        />

        {/* Requisicion context banner */}
        {requisicionContext && (
          <div className="rounded-[20px] border border-indigo-200 bg-[linear-gradient(135deg,rgba(238,242,255,0.95),rgba(245,247,255,0.92))] px-5 py-4 shadow-[0_4px_14px_rgba(79,79,220,0.08)]">
            <p className="text-sm font-bold text-indigo-900">
              Requisicion {requisicionContext.NumeroReq} precargada
            </p>
            <p className="mt-1 text-xs text-indigo-700">
              {(requisicionContext.lineas || []).length} lineas listas para editar. Al guardar la OC, la requisicion quedara marcada como CONVERTIDA.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Datos Generales */}
          <div className={premiumSectionClass}>
            <OperationSectionTitle eyebrow="Encabezado" title="Datos Generales" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Empresa *">
                <select name="Company_Id" value={form.Company_Id} onChange={handleFormChange} required className={premiumFieldClass}>
                  <option value="">-- Seleccionar --</option>
                  {companies.map((c) => (
                    <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>
                  ))}
                </select>
              </Field>
              <Field label="Desde requisicion">
                <select
                  value={form.Requisicion_Id}
                  onChange={handleRequisicionChange}
                  disabled={!form.Company_Id || loadingRequisicion}
                  className={`${premiumFieldClass} disabled:opacity-50`}
                >
                  <option value="">-- Sin requisicion --</option>
                  {requisicionesDisponibles.map((req) => (
                    <option key={req.Req_Id} value={req.Req_Id}>
                      {req.NumeroReq} - {fmtDate(req.FechaRequerida)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 -mt-0.5">
                  {loadingRequisicion ? 'Precargando requisicion...' : form.Company_Id ? 'Muestra requisiciones aprobadas de la empresa.' : 'Selecciona una empresa primero.'}
                </p>
              </Field>
              <Field label="Proveedor *">
                <select name="Proveedor_Id" value={form.Proveedor_Id} onChange={handleFormChange} required className={premiumFieldClass}>
                  <option value="">-- Seleccionar --</option>
                  {proveedores.map((p) => (
                    <option key={p.Client_Id} value={p.Client_Id}>
                      {p.ProviderName || p.CommercialName || p.LegalName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha Requerida">
                <input type="date" name="FechaRequerida" value={form.FechaRequerida} onChange={handleFormChange} className={premiumFieldClass} />
              </Field>
              <Field label="Moneda">
                <select name="Moneda" value={form.Moneda} onChange={handleFormChange} className={premiumFieldClass}>
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="USD">USD - Dolar Americano</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </Field>
              <Field label="Factura de Referencia">
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="FacturaReferencia"
                    value={form.FacturaReferencia}
                    onChange={handleFormChange}
                    placeholder="Ej: F-001234"
                    className={premiumFieldClass}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, FacturaReferencia: generateRandomFacturaReferencia() }))}
                    className="px-3.5 rounded-[14px] border border-[#dce4f0] bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap shadow-[0_2px_8px_rgba(15,45,93,0.06)]"
                  >
                    Random
                  </button>
                </div>
              </Field>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="dobleAuth"
                  name="RequiereDobleAutorizacion"
                  checked={form.RequiereDobleAutorizacion}
                  onChange={handleFormChange}
                  className="h-4 w-4 rounded accent-[#1b3d86]"
                />
                <label htmlFor="dobleAuth" className="text-sm font-medium text-slate-700">
                  Requiere doble autorizacion
                </label>
              </div>
            </div>
            <div className="mt-4">
              <Field label="Observaciones">
                <textarea
                  name="Observaciones"
                  value={form.Observaciones}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Notas adicionales..."
                  className={`${premiumFieldClass} resize-none`}
                />
              </Field>
            </div>
          </div>

          {/* Items */}
          <div className={premiumSectionClass}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96] mb-0.5">Detalle</p>
                <h3 className="text-base font-semibold text-slate-900">Productos / Materiales</h3>
              </div>
              <button
                type="button"
                onClick={addItem}
                className={operationPrimaryButtonClass}
              >
                Agregar linea
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
                    <th className="pb-2.5 pr-2 text-right font-bold uppercase tracking-[0.15em] text-[#6b7a96] w-16">IVA %</th>
                    <th className="pb-2.5 pr-2 text-right font-bold uppercase tracking-[0.15em] text-[#6b7a96] w-28">Total</th>
                    <th className="pb-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaf0fa]">
                  {items.map((item, idx) => {
                    const rowTotal =
                      Number(item.Cantidad) * Number(item.PrecioCompra) * (1 + Number(item.IVA ?? DEFAULT_IVA_RATE) / 100);
                    const tipoActual =
                      item.Tipo || (item.Producto_Id ? 'producto' : item.MateriaPrima_Id ? 'mp' : 'producto');

                    return (
                      <tr key={idx} className="hover:bg-[#f5f8fe] transition-colors">
                        <td className="py-2.5 pr-2">
                          <select
                            value={tipoActual}
                            onChange={(e) => {
                              const tipo = e.target.value;
                              setItems((prev) => {
                                const updated = [...prev];
                                updated[idx] = { ...emptyItem(), Tipo: tipo, Descripcion: tipo === 'otro' ? updated[idx].Descripcion : '' };
                                return updated;
                              });
                            }}
                            className={smallFieldClass}
                          >
                            <option value="producto">Producto</option>
                            <option value="mp">Materia Prima</option>
                            <option value="otro">Otro</option>
                          </select>
                        </td>
                        <td className="py-2.5 pr-2">
                          {tipoActual === 'producto' ? (
                            <select
                              value={item.Producto_Id}
                              onChange={(e) => handleItemChange(idx, 'Producto_Id', e.target.value)}
                              className={smallFieldClass}
                            >
                              <option value="">-- Producto --</option>
                              {productos.map((p) => (
                                <option key={p.Producto_Id} value={p.Producto_Id}>{p.SKU} - {p.Nombre}</option>
                              ))}
                            </select>
                          ) : tipoActual === 'mp' ? (
                            <select
                              value={item.MateriaPrima_Id}
                              onChange={(e) => handleItemChange(idx, 'MateriaPrima_Id', e.target.value)}
                              className={smallFieldClass}
                            >
                              <option value="">-- Mat. Prima --</option>
                              {materiasPrimas.map((mp) => (
                                <option key={mp.MateriaPrima_Id} value={mp.MateriaPrima_Id}>{mp.Nombre}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-2">
                          <input
                            type="text"
                            value={item.Descripcion}
                            onChange={(e) => handleItemChange(idx, 'Descripcion', e.target.value)}
                            placeholder="Descripcion del articulo"
                            className={smallFieldClass}
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.Cantidad}
                            onChange={(e) => handleItemChange(idx, 'Cantidad', e.target.value)}
                            className={`${smallFieldClass} text-right`}
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.PrecioCompra}
                            onChange={(e) => handleItemChange(idx, 'PrecioCompra', e.target.value)}
                            className={`${smallFieldClass} text-right`}
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.IVA}
                            onChange={(e) => handleItemChange(idx, 'IVA', e.target.value)}
                            className={`${smallFieldClass} text-right`}
                          />
                        </td>
                        <td className="py-2.5 pr-2 text-right font-semibold text-slate-700">
                          {fmtMoney(rowTotal)}
                        </td>
                        <td className="py-2.5 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="h-6 w-6 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 text-xs font-bold transition-colors"
                            >
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

            {/* Totals */}
            <div className="mt-5 flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-medium text-slate-800">{fmtMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>IVA:</span>
                  <span className="font-medium text-slate-800">{fmtMoney(totalIVA)}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-[#1b3d86] border-t border-[#eaf0fa] pt-2">
                  <span>TOTAL:</span>
                  <span>{fmtMoney(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pb-6">
            <button
              type="button"
              onClick={() => navigate('/compras')}
              className={operationSecondaryButtonClass}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={operationPrimaryButtonClass}
            >
              {saving ? 'Guardando...' : 'Crear Orden de Compra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
