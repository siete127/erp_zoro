import { useState, useEffect } from 'react';
import { FaSave } from 'react-icons/fa';
import * as materiaPrimaService from '../../services/materiaPrimaService';
import { notify } from '../../services/notify';

const FormularioMateriaPrimaModal = ({ id, onClose }) => {
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    Codigo: '',
    Nombre: '',
    Descripcion: '',
    Tipo: 'PAPEL',
    UnidadCompra: 'TONELADA',
    UnidadConsumo: 'KG',
    FactorConversion: 1000,
    Gramaje: '',
    CostoUnitario: 0,
    Moneda: 'MXN',
    Activo: true
  });

  useEffect(() => {
    if (isEdit) {
      cargarMateria();
    }
  }, [id]);

  const cargarMateria = async () => {
    try {
      setLoading(true);
      const response = await materiaPrimaService.getMateriaPrimaDetalle(id);
      setFormData(response.data);
    } catch (error) {
      console.error('Error al cargar materia prima:', error);
      notify('Error al cargar materia prima', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      if (isEdit) {
        await materiaPrimaService.updateMateriaPrima(id, formData);
        notify('Materia prima actualizada correctamente', 'success');
      } else {
        await materiaPrimaService.createMateriaPrima(formData);
        notify('Materia prima creada correctamente', 'success');
      }
      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
      notify(error.response?.data?.message || 'Error al guardar materia prima', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Código *</label>
          <input
            type="text"
            value={formData.Codigo}
            onChange={(e) => setFormData({ ...formData, Codigo: e.target.value })}
            className="w-full border rounded px-3 py-2"
            placeholder="Ej: MP-001, ADH-001"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Nombre *</label>
          <input
            type="text"
            value={formData.Nombre}
            onChange={(e) => setFormData({ ...formData, Nombre: e.target.value })}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <textarea
            value={formData.Descripcion}
            onChange={(e) => setFormData({ ...formData, Descripcion: e.target.value })}
            className="w-full border rounded px-3 py-2"
            rows="2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Tipo *</label>
          <select
            value={formData.Tipo}
            onChange={(e) => setFormData({ ...formData, Tipo: e.target.value })}
            className="w-full border rounded px-3 py-2"
            required
          >
            <option value="PAPEL">Papel</option>
            <option value="ADHESIVO">Adhesivo</option>
            <option value="REVENTA">Reventa</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Unidad de Compra *</label>
          <select
            value={formData.UnidadCompra}
            onChange={(e) => setFormData({ ...formData, UnidadCompra: e.target.value })}
            className="w-full border rounded px-3 py-2"
            required
          >
            <option value="TONELADA">Tonelada</option>
            <option value="KILO">Kilo</option>
            <option value="LITRO">Litro</option>
            <option value="METRO">Metro</option>
            <option value="PIEZA">Pieza</option>
            <option value="ROLLO">Rollo</option>
            <option value="CAJA">Caja</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Unidad de Consumo *</label>
          <select
            value={formData.UnidadConsumo}
            onChange={(e) => setFormData({ ...formData, UnidadConsumo: e.target.value })}
            className="w-full border rounded px-3 py-2"
            required
          >
            <option value="KG">Kilogramo (KG)</option>
            <option value="GRAMO">Gramo</option>
            <option value="LITRO">Litro</option>
            <option value="ML">Mililitro (ML)</option>
            <option value="PIEZA">Pieza</option>
            <option value="METRO">Metro</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Factor de Conversión *</label>
          <input
            type="number"
            value={formData.FactorConversion}
            onChange={(e) => setFormData({ ...formData, FactorConversion: parseFloat(e.target.value) })}
            className="w-full border rounded px-3 py-2"
            step="0.001"
            min="0"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Ej: 1 Tonelada = 1000 KG
          </p>
        </div>
        
        {formData.Tipo === 'PAPEL' && (
          <div>
            <label className="block text-sm font-medium mb-1">Gramaje (g/m²)</label>
            <input
              type="number"
              value={formData.Gramaje}
              onChange={(e) => setFormData({ ...formData, Gramaje: parseFloat(e.target.value) })}
              className="w-full border rounded px-3 py-2"
              step="0.01"
              min="0"
            />
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium mb-1">Costo Unitario *</label>
          <input
            type="number"
            value={formData.CostoUnitario}
            onChange={(e) => setFormData({ ...formData, CostoUnitario: parseFloat(e.target.value) })}
            className="w-full border rounded px-3 py-2"
            step="0.01"
            min="0"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Costo por {formData.UnidadConsumo}
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Moneda</label>
          <select
            value={formData.Moneda}
            onChange={(e) => setFormData({ ...formData, Moneda: e.target.value })}
            className="w-full border rounded px-3 py-2"
          >
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.Activo}
              onChange={(e) => setFormData({ ...formData, Activo: e.target.checked })}
            />
            <span className="text-sm font-medium">Activo</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
        >
          <FaSave /> {loading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
};

export default FormularioMateriaPrimaModal;
