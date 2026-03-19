import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';

const DEFAULT_IVA_RATE = 16.0;

const generateRandomFacturaReferencia = () => {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `F-${datePart}-${randomPart}`;
};

const emptyItem = () => ({ Tipo: 'producto', Producto_Id: '', MateriaPrima_Id: '', Descripcion: '', Cantidad: 1, PrecioCompra: 0, IVA: DEFAULT_IVA_RATE });

export default function NuevaOrdenCompra() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    Company_Id: '',
    Proveedor_Id: '',
    FechaRequerida: '',
    Moneda: 'MXN',
    RequiereDobleAutorizacion: true,
    FacturaReferencia: generateRandomFacturaReferencia(),
    Observaciones: '',
  });
  const [items, setItems] = useState([emptyItem()]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, pRes, mpRes] = await Promise.all([
          api.get('/companies'),
          api.get('/compras/proveedores'),
          api.get('/materias-primas'),
        ]);
        setCompanies(cRes.data || []);
        setProveedores(pRes.data?.data || []);
        setMateriasPrimas(mpRes.data?.data || mpRes.data || []);
      } catch (err) {
        notify('Error cargando catálogos', 'error');
      }
    };
    load();
  }, []);

  // Cuando cambia Company_Id, cargar productos y proveedores de esa empresa
  useEffect(() => {
    if (!form.Company_Id) return;
    const loadFiltered = async () => {
      try {
        const [pRes, provRes] = await Promise.all([
          api.get(`/productos?company_id=${form.Company_Id}`),
          api.get(`/compras/proveedores?Company_Id=${form.Company_Id}`),
        ]);
        setProductos(pRes.data?.data || pRes.data || []);
        setProveedores(provRes.data?.data || []);
      } catch {
        // ignore
      }
    };
    loadFiltered();
  }, [form.Company_Id]);

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleItemChange = (idx, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };

      // Auto-rellenar descripción y precio desde catálogo
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

  const subtotal = items.reduce((s, it) => s + Number(it.Cantidad) * Number(it.PrecioCompra), 0);
  const totalIVA  = items.reduce((s, it) => {
    const sub = Number(it.Cantidad) * Number(it.PrecioCompra);
    return s + sub * (Number(it.IVA ?? DEFAULT_IVA_RATE) / 100);
  }, 0);
  const total = subtotal + totalIVA;

  const fmt = (n) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Company_Id || !form.Proveedor_Id) {
      notify('Selecciona empresa y proveedor', 'error'); return;
    }
    if (items.some(it => !it.Descripcion || Number(it.Cantidad) <= 0)) {
      notify('Todos los productos deben tener descripción y cantidad > 0', 'error'); return;
    }
    setSaving(true);
    try {
      const res = await api.post('/compras/ordenes', { ...form, items });
      notify(`OC creada: ${res.data.NumeroOC}`, 'success');
      navigate(`/compras/${res.data.OC_Id}`);
    } catch (err) {
      notify(err.response?.data?.message || 'Error al crear orden', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Nueva Orden de Compra</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos generales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Datos Generales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Empresa *</label>
              <select name="Company_Id" value={form.Company_Id} onChange={handleFormChange} required
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— Seleccionar —</option>
                {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor *</label>
              <select name="Proveedor_Id" value={form.Proveedor_Id} onChange={handleFormChange} required
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— Seleccionar —</option>
                {proveedores.map(p => <option key={p.Client_Id} value={p.Client_Id}>{p.ProviderName || p.CommercialName || p.LegalName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Requerida</label>
              <input type="date" name="FechaRequerida" value={form.FechaRequerida} onChange={handleFormChange}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
              <select name="Moneda" value={form.Moneda} onChange={handleFormChange}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="MXN">MXN — Peso Mexicano</option>
                <option value="USD">USD — Dólar Americano</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Factura de Referencia</label>
              <div className="flex gap-2">
                <input type="text" name="FacturaReferencia" value={form.FacturaReferencia} onChange={handleFormChange}
                  placeholder="Ej: F-001234"
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, FacturaReferencia: generateRandomFacturaReferencia() }))}
                  className="px-3 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                >
                  Random
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="dobleAuth" name="RequiereDobleAutorizacion"
                checked={form.RequiereDobleAutorizacion} onChange={handleFormChange}
                className="w-4 h-4 accent-blue-600" />
              <label htmlFor="dobleAuth" className="text-sm text-gray-700">
                Requiere doble autorización
              </label>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
            <textarea name="Observaciones" value={form.Observaciones} onChange={handleFormChange}
              rows={2} placeholder="Notas adicionales..."
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </div>

        {/* Detalle de productos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-700">Productos / Materiales</h2>
            <button type="button" onClick={addItem}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg">
              + Agregar línea
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="pb-2 text-left w-36">Tipo</th>
                  <th className="pb-2 text-left w-48">Artículo</th>
                  <th className="pb-2 text-left">Descripción</th>
                  <th className="pb-2 text-right w-20">Cant.</th>
                  <th className="pb-2 text-right w-28">P. Compra</th>
                  <th className="pb-2 text-right w-16">IVA %</th>
                  <th className="pb-2 text-right w-28">Total</th>
                  <th className="pb-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((it, idx) => {
                  const rowTotal = (Number(it.Cantidad) * Number(it.PrecioCompra)) * (1 + Number(it.IVA ?? DEFAULT_IVA_RATE) / 100);
                  const tipoActual = it.Tipo || (it.Producto_Id ? 'producto' : it.MateriaPrima_Id ? 'mp' : 'producto');
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 pr-2">
                        <select
                          value={tipoActual}
                          onChange={e => {
                            const t = e.target.value;
                            setItems(prev => {
                              const u = [...prev];
                              u[idx] = { ...emptyItem(), Tipo: t, Descripcion: t === 'otro' ? u[idx].Descripcion : '' };
                              return u;
                            });
                          }}
                          className="w-full border rounded px-2 py-1 text-xs"
                        >
                          <option value="producto">Producto</option>
                          <option value="mp">Materia Prima</option>
                          <option value="otro">Otro</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        {tipoActual === 'producto' ? (
                          <select value={it.Producto_Id} onChange={e => handleItemChange(idx, 'Producto_Id', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs">
                            <option value="">— Producto —</option>
                            {productos.map(p => <option key={p.Producto_Id} value={p.Producto_Id}>{p.SKU} - {p.Nombre}</option>)}
                          </select>
                        ) : tipoActual === 'mp' ? (
                          <select value={it.MateriaPrima_Id} onChange={e => handleItemChange(idx, 'MateriaPrima_Id', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs">
                            <option value="">— Mat. Prima —</option>
                            {materiasPrimas.map(m => <option key={m.MateriaPrima_Id} value={m.MateriaPrima_Id}>{m.Nombre}</option>)}
                          </select>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        <input type="text" value={it.Descripcion} onChange={e => handleItemChange(idx, 'Descripcion', e.target.value)}
                          placeholder="Descripción del artículo"
                          className="w-full border rounded px-2 py-1 text-xs" />
                      </td>
                      <td className="py-2 pr-2">
                        <input type="number" min="0.01" step="0.01" value={it.Cantidad}
                          onChange={e => handleItemChange(idx, 'Cantidad', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-xs text-right" />
                      </td>
                      <td className="py-2 pr-2">
                        <input type="number" min="0" step="0.01" value={it.PrecioCompra}
                          onChange={e => handleItemChange(idx, 'PrecioCompra', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-xs text-right" />
                      </td>
                      <td className="py-2 pr-2">
                        <input type="number" min="0" max="100" step="0.01" value={it.IVA}
                          onChange={e => handleItemChange(idx, 'IVA', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-xs text-right" />
                      </td>
                      <td className="py-2 text-right font-medium text-gray-700 text-xs">
                        {fmt(rowTotal)}
                      </td>
                      <td className="py-2 text-center">
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)}
                            className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="mt-4 flex justify-end">
            <div className="w-64 text-sm text-gray-700 space-y-1">
              <div className="flex justify-between"><span>Subtotal:</span><span>{fmt(subtotal)}</span></div>
              <div className="flex justify-between"><span>IVA:</span><span>{fmt(totalIVA)}</span></div>
              <div className="flex justify-between font-bold text-base text-blue-800 border-t pt-1">
                <span>TOTAL:</span><span>{fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate('/compras')}
            className="px-5 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {saving ? 'Guardando...' : 'Crear Orden de Compra'}
          </button>
        </div>
      </form>
    </div>
  );
}
