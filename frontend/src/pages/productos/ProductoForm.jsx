import { useState, useEffect } from 'react';
import SATAutocomplete from '../../components/SATAutocomplete';
import api from '../../services/api';
import { notify } from '../../services/notify';

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
        const res = await api.get('/companies');
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
    
    // Validar campos requeridos
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
      console.error('Error:', err.response?.data);
      notify.error(err.response?.data?.msg || 'Error al guardar producto');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">SKU *</label>
          <input
            type="text"
            value={formData.SKU}
            onChange={(e) => setFormData({ ...formData, SKU: e.target.value })}
            required
            disabled={!!producto?.Producto_Id}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nombre *</label>
          <input
            type="text"
            value={formData.Nombre}
            onChange={(e) => setFormData({ ...formData, Nombre: e.target.value })}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Descripción</label>
        <textarea
          value={formData.Descripcion}
          onChange={(e) => setFormData({ ...formData, Descripcion: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Precio</label>
          <input
            type="number"
            step="0.01"
            value={formData.Precio}
            onChange={(e) => setFormData({ ...formData, Precio: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tipo de Moneda</label>
          <select
            value={formData.TipoMoneda}
            onChange={(e) => setFormData({ ...formData, TipoMoneda: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar</option>
            <option value="MXN">MXN - Peso Mexicano</option>
            <option value="USD">USD - Dólar Americano</option>
            <option value="EUR">EUR - Euro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">IVA (%)</label>
          <input
            type="number"
            step="0.01"
            value={formData.ImpuestoIVA}
            onChange={(e) => setFormData({ ...formData, ImpuestoIVA: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
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

      <div className="flex items-center">
        <input
          type="checkbox"
          checked={formData.Activo}
          onChange={(e) => setFormData({ ...formData, Activo: e.target.checked })}
          className="mr-2"
        />
        <label className="text-sm font-medium">Activo</label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Empresas asignadas</label>
        <div className="border border-gray-300 rounded p-3 max-h-40 overflow-y-auto">
          {companies.length === 0 ? (
            <p className="text-sm text-gray-500">No hay empresas disponibles</p>
          ) : (
            companies.map(company => (
              <div key={company.Company_Id} className="flex items-center mb-2">
                <input
                  type="checkbox"
                  checked={formData.companies.includes(company.Company_Id)}
                  onChange={() => toggleCompany(company.Company_Id)}
                  className="mr-2"
                />
                <label className="text-sm">{company.NameCompany}</label>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
