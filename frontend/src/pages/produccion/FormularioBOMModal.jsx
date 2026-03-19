import { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaSave } from 'react-icons/fa';
import * as bomService from '../../services/bomService';
import api from '../../services/api';
import { notify } from '../../services/notify';

const findPTCRemaCompany = (companies = []) => companies.find((company) => {
  const name = String(company?.NameCompany || company?.CompanyName || company?.Nombre || '').toUpperCase();
  const code = String(company?.EmpresaCodigo || '').toUpperCase();
  return name.includes('PTC REMA') || (name.includes('PTC') && name.includes('REMA')) || code === 'PTC';
});

const FormularioBOMModal = ({ id, onClose }) => {
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [ptcRemaCompany, setPtcRemaCompany] = useState(null);
  
  const [formData, setFormData] = useState({
    Company_Id: '',
    Producto_Id: '',
    CodigoBOM: '',
    Version: 1,
    MermaPct: 0,
    Descripcion: '',
    Vigente: true
  });

  const [productoSearch, setProductoSearch] = useState('');
  const [productoDropOpen, setProductoDropOpen] = useState(false);
  const productosFiltrados = productos.filter(p => {
    const q = productoSearch.toLowerCase();
    return !q || (p.SKU || '').toLowerCase().includes(q) || (p.Nombre || '').toLowerCase().includes(q);
  });
  const productoSeleccionado = productos.find(p => String(p.Producto_Id) === String(formData.Producto_Id));
  
  const [materiales, setMateriales] = useState([]);
  const [operaciones, setOperaciones] = useState([]);

  useEffect(() => {
    cargarEmpresas();
  }, []);

  useEffect(() => {
    if (formData.Company_Id) {
      cargarDatos();
    }
    if (isEdit) {
      cargarBOM();
    }
  }, [id, formData.Company_Id, ptcRemaCompany?.Company_Id]);

  const cargarEmpresas = async () => {
    try {
      const response = await api.get('/companies');
      const empresasData = response.data.data || response.data || [];
      const ptcCompany = findPTCRemaCompany(empresasData);

      if (!ptcCompany) {
        setEmpresas([]);
        setPtcRemaCompany(null);
        notify('No se encontró la empresa PTC REMA', 'error');
        return;
      }

      setEmpresas([ptcCompany]);
      setPtcRemaCompany(ptcCompany);
      setFormData((prev) => ({
        ...prev,
        Company_Id: String(ptcCompany.Company_Id)
      }));
    } catch (error) {
      console.error('Error al cargar empresas:', error);
    }
  };

  const cargarDatos = async () => {
    if (!formData.Company_Id) return;
    
    try {
      const prodRes = await api.get('/productos', {
        params: { company_id: formData.Company_Id }
      });
      setProductos(prodRes.data.data || []);
      
      const matRes = await bomService.listMateriasPrimas(formData.Company_Id);
      setMateriasPrimas(matRes.data || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    }
  };

  const cargarBOM = async () => {
    try {
      setLoading(true);
      const response = await bomService.getBOMDetalle(id);
      const { bom, materiales: mats, operaciones: ops } = response.data;
      
      setFormData({
        Company_Id: String(ptcRemaCompany?.Company_Id || bom.Company_Id),
        Producto_Id: String(bom.Producto_Id),
        CodigoBOM: bom.CodigoBOM,
        Version: bom.Version,
        MermaPct: bom.MermaPct,
        Descripcion: bom.Descripcion || '',
        Vigente: bom.Vigente
      });
      
      setMateriales(mats || []);
      setOperaciones(ops || []);
    } catch (error) {
      console.error('Error al cargar BOM:', error);
      notify('Error al cargar BOM', 'error');
    } finally {
      setLoading(false);
    }
  };

  const agregarMaterial = () => {
    setMateriales([...materiales, {
      MateriaPrima_Id: '',
      CantidadTeorica: 0,
      TipoComponente: 'Principal',
      MermaPct: 0,
      Notas: ''
    }]);
  };

  const eliminarMaterial = (index) => {
    setMateriales(materiales.filter((_, i) => i !== index));
  };

  const actualizarMaterial = (index, campo, valor) => {
    const nuevos = [...materiales];
    nuevos[index][campo] = valor;
    setMateriales(nuevos);
  };

  const agregarOperacion = () => {
    setOperaciones([...operaciones, {
      NombreOperacion: '',
      TipoCosto: 'MANO_OBRA',
      MinutosPorUnidad: 0,
      CostoPorUnidad: 0,
      CostoHoraReferencia: 0
    }]);
  };

  const eliminarOperacion = (index) => {
    setOperaciones(operaciones.filter((_, i) => i !== index));
  };

  const actualizarOperacion = (index, campo, valor) => {
    const nuevas = [...operaciones];
    nuevas[index][campo] = valor;
    setOperaciones(nuevas);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Asegurar que hay Company_Id
    const companyId = formData.Company_Id || String(ptcRemaCompany?.Company_Id || '');

    if (!companyId) {
      notify('No se encontró la empresa PTC REMA', 'error');
      return;
    }
    
    if (!formData.Producto_Id) {
      notify('Debe seleccionar un producto', 'error');
      return;
    }
    
    if (materiales.length === 0) {
      notify('Debe agregar al menos un material', 'error');
      return;
    }
    
    try {
      setLoading(true);
      const data = {
        ...formData,
        Company_Id: companyId,
        materiales,
        operaciones
      };
      
      if (isEdit) {
        await bomService.updateBOM(id, data);
        notify('BOM actualizado correctamente', 'success');
      } else {
        await bomService.createBOM(data);
        notify('BOM creado correctamente', 'success');
      }
      
      onClose();
    } catch (error) {
      console.error('Error al guardar BOM:', error);
      notify(error.response?.data?.message || 'Error al guardar BOM', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información General */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Información General</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Empresa *</label>
            <input
              type="text"
              value={ptcRemaCompany?.NameCompany || 'PTC REMA'}
              className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-700"
              disabled
              readOnly
            />
            {empresas.length === 0 && (
              <p className="text-xs text-red-500 mt-1">No se encontraron empresas</p>
            )}
          </div>
          
          <div className="relative">
            <label className="block text-sm font-medium mb-1">Producto *</label>
            <div className="relative">
              <input
                type="text"
                value={productoDropOpen ? productoSearch : (productoSeleccionado ? `${productoSeleccionado.SKU} - ${productoSeleccionado.Nombre}` : '')}
                onFocus={() => { setProductoDropOpen(true); setProductoSearch(''); }}
                onChange={(e) => { setProductoSearch(e.target.value); setProductoDropOpen(true); }}
                onBlur={() => setTimeout(() => setProductoDropOpen(false), 180)}
                placeholder="Buscar por SKU o nombre..."
                className="w-full border rounded px-3 py-2 pr-8"
                required={!formData.Producto_Id}
              />
              {formData.Producto_Id && (
                <button type="button" onClick={() => { setFormData({ ...formData, Producto_Id: '' }); setProductoSearch(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
              )}
            </div>
            {productoDropOpen && (
              <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded shadow-lg max-h-56 overflow-y-auto mt-1">
                {productosFiltrados.length === 0 && (
                  <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
                )}
                {productosFiltrados.map(p => (
                  <li key={p.Producto_Id}
                    onMouseDown={() => { setFormData({ ...formData, Producto_Id: String(p.Producto_Id) }); setProductoDropOpen(false); setProductoSearch(''); }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                      String(formData.Producto_Id) === String(p.Producto_Id) ? 'bg-blue-100 font-medium' : ''
                    }`}>
                    <span className="font-mono text-xs text-gray-500 mr-2">{p.SKU}</span>
                    {p.Nombre}
                  </li>
                ))}
              </ul>
            )}
            {/* input oculto para validación required */}
            <input type="hidden" value={formData.Producto_Id} required />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Código BOM</label>
            <input
              type="text"
              value={formData.CodigoBOM}
              onChange={(e) => setFormData({ ...formData, CodigoBOM: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="Auto-generado"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Versión</label>
            <input
              type="number"
              value={formData.Version}
              onChange={(e) => setFormData({ ...formData, Version: parseInt(e.target.value) })}
              className="w-full border rounded px-3 py-2"
              min="1"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Merma (%)</label>
            <input
              type="number"
              value={formData.MermaPct}
              onChange={(e) => setFormData({ ...formData, MermaPct: parseFloat(e.target.value) })}
              className="w-full border rounded px-3 py-2"
              step="0.01"
              min="0"
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
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.Vigente}
                onChange={(e) => setFormData({ ...formData, Vigente: e.target.checked })}
              />
              <span className="text-sm font-medium">BOM Vigente</span>
            </label>
          </div>
        </div>
      </div>

      {/* Materiales */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Materiales *</h3>
          <button
            type="button"
            onClick={agregarMaterial}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1 hover:bg-green-700"
          >
            <FaPlus size={12} /> Agregar
          </button>
        </div>
        
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left text-xs">Materia Prima</th>
                <th className="px-2 py-2 text-left text-xs">Cantidad</th>
                <th className="px-2 py-2 text-left text-xs">Tipo</th>
                <th className="px-2 py-2 text-left text-xs">Merma %</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {materiales.map((mat, index) => (
                <tr key={index} className="border-t">
                  <td className="px-2 py-2">
                    <select
                      value={mat.MateriaPrima_Id}
                      onChange={(e) => actualizarMaterial(index, 'MateriaPrima_Id', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                      required
                    >
                      <option value="">Seleccione...</option>
                      {materiasPrimas.map(mp => (
                        <option key={mp.MateriaPrima_Id} value={mp.MateriaPrima_Id}>
                          {mp.Codigo} - {mp.Nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={mat.CantidadTeorica}
                      onChange={(e) => actualizarMaterial(index, 'CantidadTeorica', parseFloat(e.target.value))}
                      className="w-full border rounded px-2 py-1 text-sm"
                      step="0.001"
                      min="0"
                      required
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={mat.TipoComponente}
                      onChange={(e) => actualizarMaterial(index, 'TipoComponente', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    >
                      <option value="Principal">Principal</option>
                      <option value="Secundario">Secundario</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={mat.MermaPct}
                      onChange={(e) => actualizarMaterial(index, 'MermaPct', parseFloat(e.target.value))}
                      className="w-full border rounded px-2 py-1 text-sm"
                      step="0.01"
                      min="0"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => eliminarMaterial(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FaTrash size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {materiales.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No hay materiales. Click en "Agregar".
            </div>
          )}
        </div>
      </div>

      {/* Operaciones */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Operaciones</h3>
          <button
            type="button"
            onClick={agregarOperacion}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1 hover:bg-green-700"
          >
            <FaPlus size={12} /> Agregar
          </button>
        </div>
        
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left text-xs">Descripción</th>
                <th className="px-2 py-2 text-left text-xs">Tipo</th>
                <th className="px-2 py-2 text-left text-xs">Min/Unidad</th>
                <th className="px-2 py-2 text-left text-xs">Costo/Unidad</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {operaciones.map((op, index) => (
                <tr key={index} className="border-t">
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={op.NombreOperacion}
                      onChange={(e) => actualizarOperacion(index, 'NombreOperacion', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                      placeholder="Ej: Corte"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={op.TipoCosto}
                      onChange={(e) => actualizarOperacion(index, 'TipoCosto', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    >
                      <option value="MANO_OBRA">Mano de obra</option>
                      <option value="MAQUINA">Maquinaria</option>
                      <option value="INDIRECTO">Indirecto</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={op.MinutosPorUnidad}
                      onChange={(e) => actualizarOperacion(index, 'MinutosPorUnidad', parseFloat(e.target.value))}
                      className="w-full border rounded px-2 py-1 text-sm"
                      step="0.01"
                      min="0"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={op.CostoPorUnidad}
                      onChange={(e) => actualizarOperacion(index, 'CostoPorUnidad', parseFloat(e.target.value))}
                      className="w-full border rounded px-2 py-1 text-sm"
                      step="0.01"
                      min="0"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => eliminarOperacion(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FaTrash size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {operaciones.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No hay operaciones (opcional).
            </div>
          )}
        </div>
      </div>

      {/* Botones */}
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

export default FormularioBOMModal;
