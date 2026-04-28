import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaPlus, FaTrash, FaSave, FaArrowLeft } from 'react-icons/fa';
import * as bomService from '../../services/bomService';
import api from '../../services/api';
import { notify } from '../../services/notify';

const PTC_REMA_LABEL = 'PTC REMA';

const FormularioBOM = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  
  const [loading, setLoading] = useState(false);
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  
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
    if (isEdit) {
      cargarBOM();
    }
  }, [id]);

  useEffect(() => {
    if (formData.Company_Id) {
      cargarDatos();
    }
  }, [formData.Company_Id]);

  useEffect(() => {
    resolverEmpresaPTCRema();
  }, []);

  const resolverEmpresaPTCRema = async () => {
    try {
      const response = await api.get('/companies/');
      const empresas = response.data.data || response.data || [];
      const empresa = empresas.find((company) => {
        const name = String(company?.NameCompany || company?.CompanyName || company?.Nombre || '').toUpperCase();
        const code = String(company?.EmpresaCodigo || '').toUpperCase();
        return name.includes('PTC REMA') || (name.includes('PTC') && name.includes('REMA')) || code === 'PTC';
      });

      if (!empresa) {
        notify('No se encontró la empresa PTC REMA', 'error');
        return;
      }

      setFormData((prev) => ({ ...prev, Company_Id: String(empresa.Company_Id) }));
    } catch (error) {
      console.error('Error al resolver empresa PTC REMA:', error);
    }
  };

  const cargarDatos = async () => {
    try {
      if (!formData.Company_Id) {
        return;
      }

      const prodRes = await api.get('/productos', { params: { company_id: formData.Company_Id } });
      setProductos(prodRes.data.data || []);
      
      // Cargar materias primas
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
        Company_Id: bom.Company_Id,
        Producto_Id: bom.Producto_Id,
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
      
      navigate('/produccion/bom');
    } catch (error) {
      console.error('Error al guardar BOM:', error);
      notify(error.response?.data?.message || 'Error al guardar BOM', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return <div className="p-6 text-center">Cargando...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/produccion/bom')}
          className="text-gray-600 hover:text-gray-800 flex-shrink-0"
        >
          <FaArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold">
          {isEdit ? 'Editar BOM' : 'Nuevo BOM'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información General */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Información General</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Empresa *</label>
              <input
                type="text"
                value={PTC_REMA_LABEL}
                className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-700"
                disabled
                readOnly
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium mb-1">Producto *</label>
              <div className="relative">
                <input
                  type="text"
                  value={productoDropOpen ? productoSearch : (productoSeleccionado ? `${productoSeleccionado.SKU} - ${productoSeleccionado.Nombre}` : '')}
                  onFocus={() => { if (!isEdit) { setProductoDropOpen(true); setProductoSearch(''); } }}
                  onChange={(e) => { setProductoSearch(e.target.value); setProductoDropOpen(true); }}
                  onBlur={() => setTimeout(() => setProductoDropOpen(false), 180)}
                  placeholder="Buscar por SKU o nombre..."
                  className={`w-full border rounded px-3 py-2 pr-8 ${isEdit ? 'bg-gray-100 text-gray-600' : ''}`}
                  readOnly={isEdit}
                  required={!formData.Producto_Id}
                />
                {formData.Producto_Id && !isEdit && (
                  <button type="button" onClick={() => { setFormData({ ...formData, Producto_Id: '' }); setProductoSearch(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                )}
              </div>
              {productoDropOpen && !isEdit && (
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
              <input type="hidden" value={formData.Producto_Id} required />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Código BOM</label>
              <input
                type="text"
                value={formData.CodigoBOM}
                onChange={(e) => setFormData({ ...formData, CodigoBOM: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Auto-generado si se deja vacío"
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
              <label className="block text-sm font-medium mb-1">Merma Esperada (%)</label>
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
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Materiales *</h2>
            <button
              type="button"
              onClick={agregarMaterial}
              className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-2 hover:bg-green-700"
            >
              <FaPlus /> Agregar Material
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Materia Prima</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Cantidad</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Tipo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Merma %</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Notas</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {materiales.map((mat, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-2">
                      <select
                        value={mat.MateriaPrima_Id}
                        onChange={(e) => actualizarMaterial(index, 'MateriaPrima_Id', e.target.value)}
                        className="w-full border rounded px-2 py-1"
                        required
                      >
                        <option value="">Seleccione...</option>
                        {materiasPrimas.map(mp => (
                          <option key={mp.MateriaPrima_Id} value={mp.MateriaPrima_Id}>
                            {mp.Codigo} - {mp.Nombre} ({mp.UnidadConsumo})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={mat.CantidadTeorica}
                        onChange={(e) => actualizarMaterial(index, 'CantidadTeorica', parseFloat(e.target.value))}
                        className="w-full border rounded px-2 py-1"
                        step="0.001"
                        min="0"
                        required
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={mat.TipoComponente}
                        onChange={(e) => actualizarMaterial(index, 'TipoComponente', e.target.value)}
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value="Principal">Principal</option>
                        <option value="Secundario">Secundario</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={mat.MermaPct}
                        onChange={(e) => actualizarMaterial(index, 'MermaPct', parseFloat(e.target.value))}
                        className="w-full border rounded px-2 py-1"
                        step="0.01"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={mat.Notas || ''}
                        onChange={(e) => actualizarMaterial(index, 'Notas', e.target.value)}
                        className="w-full border rounded px-2 py-1"
                        placeholder="Opcional"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => eliminarMaterial(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {materiales.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No hay materiales agregados. Click en "Agregar Material" para comenzar.
              </div>
            )}
          </div>
        </div>

        {/* Operaciones */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Operaciones y Costos</h2>
            <button
              type="button"
              onClick={agregarOperacion}
              className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-2 hover:bg-green-700"
            >
              <FaPlus /> Agregar Operación
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Descripción</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Tipo Costo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Min/Unidad</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Costo/Unidad</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Costo Hora</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {operaciones.map((op, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={op.NombreOperacion}
                        onChange={(e) => actualizarOperacion(index, 'NombreOperacion', e.target.value)}
                        className="w-full border rounded px-2 py-1"
                        placeholder="Ej: Corte, Ensamble..."
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={op.TipoCosto}
                        onChange={(e) => actualizarOperacion(index, 'TipoCosto', e.target.value)}
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value="MANO_OBRA">Mano de obra</option>
                        <option value="MAQUINA">Maquinaria</option>
                        <option value="INDIRECTO">Indirecto</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={op.MinutosPorUnidad}
                        onChange={(e) => actualizarOperacion(index, 'MinutosPorUnidad', parseFloat(e.target.value))}
                        className="w-full border rounded px-2 py-1"
                        step="0.01"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={op.CostoPorUnidad}
                        onChange={(e) => actualizarOperacion(index, 'CostoPorUnidad', parseFloat(e.target.value))}
                        className="w-full border rounded px-2 py-1"
                        step="0.01"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={op.CostoHoraReferencia}
                        onChange={(e) => actualizarOperacion(index, 'CostoHoraReferencia', parseFloat(e.target.value))}
                        className="w-full border rounded px-2 py-1"
                        step="0.01"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => eliminarOperacion(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {operaciones.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No hay operaciones agregadas (opcional).
              </div>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/produccion/bom')}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
          >
            <FaSave /> {loading ? 'Guardando...' : 'Guardar BOM'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormularioBOM;
