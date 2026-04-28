import { useState, useEffect } from 'react';
import SATAutocomplete from '../../components/SATAutocomplete';
import api from '../../services/api';
import { notify } from '../../services/notify';

const premiumFieldClass =
  'w-full rounded-[14px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20';

const disabledFieldClass =
  'w-full rounded-[14px] border border-[#eaf0fa] bg-slate-50 px-3.5 py-2.5 text-sm text-slate-400 cursor-not-allowed';

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</label>
    {children}
  </div>
);

export default function ProductoForm({ producto, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    SKU: producto?.SKU || '',
    Nombre: producto?.Nombre || '',
    Descripcion: producto?.Descripcion || '',
    Precio: producto?.Precio || 0,
    TipoMoneda: producto?.TipoMoneda || '',
    ClaveProdServSAT: producto?.ClaveProdServSAT || '',
    ClaveUnidadSAT: producto?.ClaveUnidadSAT || '',
    ImpuestoIVA: producto?.ImpuestoIVA || 16.00,
    Activo: producto?.Activo !== undefined ? producto.Activo : true,
    companies: producto?.companies?.map(c => c.Company_Id) || []
  });
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await api.get('/companies/');
        setCompanies(res.data || []);
      } catch (err) {
        console.error('Error cargando empresas', err);
      }
    };
    fetchCompanies();
  }, []);

  const toggleCompany = (companyId) => {
    setFormData(prev => ({
      ...prev,
      companies: prev.companies.includes(companyId)
        ? prev.companies.filter(id => id !== companyId)
        : [...prev.companies, companyId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ClaveProdServSAT) {
      notify.error('Debe seleccionar una Clave de Producto/Servicio SAT');
      return;
    }
    if (!formData.ClaveUnidadSAT) {
      notify.error('Debe seleccionar una Clave de Unidad SAT');
      return;
    }
    try {
      if (producto?.Producto_Id) {
        await api.put(`/productos/${producto.Producto_Id}`, formData);
        notify.success('Producto actualizado');
      } else {
        await api.post('/productos', formData);
        notify.success('Producto creado');
      }
      onSave();
    } catch (err) {
      notify.error(err.response?.data?.msg || 'Error al guardar producto');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="SKU *">
          <input
            type="text"
            value={formData.SKU}
            onChange={(e) => setFormData({ ...formData, SKU: e.target.value })}
            required
            disabled={!!producto?.Producto_Id}
            className={producto?.Producto_Id ? disabledFieldClass : premiumFieldClass}
          />
        </Field>
        <Field label="Nombre *">
          <input
            type="text"
            value={formData.Nombre}
            onChange={(e) => setFormData({ ...formData, Nombre: e.target.value })}
            required
            className={premiumFieldClass}
          />
        </Field>
      </div>

      <Field label="Descripción">
        <textarea
          value={formData.Descripcion}
          onChange={(e) => setFormData({ ...formData, Descripcion: e.target.value })}
          rows={3}
          className={premiumFieldClass + ' resize-none'}
        />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Precio">
          <input
            type="number"
            step="0.01"
            value={formData.Precio}
            onChange={(e) => setFormData({ ...formData, Precio: parseFloat(e.target.value) })}
            className={premiumFieldClass}
          />
        </Field>
        <Field label="Tipo de Moneda">
          <select
            value={formData.TipoMoneda}
            onChange={(e) => setFormData({ ...formData, TipoMoneda: e.target.value })}
            className={premiumFieldClass}
          >
            <option value="">Seleccionar</option>
            <option value="MXN">MXN — Peso Mexicano</option>
            <option value="USD">USD — Dólar Americano</option>
            <option value="EUR">EUR — Euro</option>
          </select>
        </Field>
        <Field label="IVA (%)">
          <input
            type="number"
            step="0.01"
            value={formData.ImpuestoIVA}
            onChange={(e) => setFormData({ ...formData, ImpuestoIVA: parseFloat(e.target.value) })}
            className={premiumFieldClass}
          />
        </Field>
      </div>

      <SATAutocomplete
        type="prodserv"
        value={formData.ClaveProdServSAT}
        onChange={(clave) => setFormData({ ...formData, ClaveProdServSAT: clave })}
        label="Clave Producto/Servicio SAT *"
        placeholder="Buscar por clave o descripción..."
      />

      <SATAutocomplete
        type="unidades"
        value={formData.ClaveUnidadSAT}
        onChange={(clave) => setFormData({ ...formData, ClaveUnidadSAT: clave })}
        label="Clave Unidad SAT *"
        placeholder="Buscar por clave o nombre..."
      />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="productoActivo"
          checked={formData.Activo}
          onChange={(e) => setFormData({ ...formData, Activo: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-[#3b6fd4] focus:ring-[#3b6fd4]/30"
        />
        <label htmlFor="productoActivo" className="text-sm font-medium text-slate-700 cursor-pointer">Activo</label>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Empresas asignadas</p>
        <div className="rounded-[14px] border border-[#dce4f0] bg-white p-3 max-h-40 overflow-y-auto shadow-[0_2px_8px_rgba(15,45,93,0.04)]">
          {companies.length === 0 ? (
            <p className="text-sm text-slate-400">No hay empresas disponibles</p>
          ) : (
            companies.map(company => (
              <label key={company.Company_Id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={formData.companies.includes(company.Company_Id)}
                  onChange={() => toggleCompany(company.Company_Id)}
                  className="h-4 w-4 rounded border-slate-300 text-[#3b6fd4] focus:ring-[#3b6fd4]/30"
                />
                <span className="text-sm text-slate-700">{company.NameCompany}</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-2 border-t border-[#eaf0fa] pt-4">
        <button
          type="submit"
          className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition hover:shadow-[0_6px_20px_rgba(27,61,134,0.40)]"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[14px] border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
