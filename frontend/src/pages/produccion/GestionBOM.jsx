import { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCopy, FaEye, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import * as bomService from '../../services/bomService';
import Modal from '../../components/Modal';
import FormularioBOMModal from './FormularioBOMModal';
import { notify } from '../../services/notify';
import api from '../../services/api';

const findPTCRemaCompany = (companies = []) => companies.find((company) => {
  const name = String(company?.NameCompany || company?.CompanyName || company?.Nombre || '').toUpperCase();
  const code = String(company?.EmpresaCodigo || '').toUpperCase();
  return name.includes('PTC REMA') || (name.includes('PTC') && name.includes('REMA')) || code === 'PTC';
});

const GestionBOM = () => {
  const navigate = useNavigate();
  const [boms, setBoms] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ptcRemaCompany, setPtcRemaCompany] = useState(null);
  const [filters, setFilters] = useState({
    Company_Id: '',
    Producto_Id: '',
    Vigente: '1'
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    resolverEmpresaPTCRema();
  }, []);

  useEffect(() => {
    if (filters.Company_Id) {
      cargarProductos();
      cargarBOMs();
    }
  }, [filters]);

  const resolverEmpresaPTCRema = async () => {
    try {
      const response = await api.get('/companies');
      const empresas = response.data?.data || response.data || [];
      const empresa = findPTCRemaCompany(empresas);

      if (!empresa) {
        notify('No se encontró la empresa PTC REMA', 'error');
        return;
      }

      setPtcRemaCompany(empresa);
      setFilters((prev) => ({ ...prev, Company_Id: String(empresa.Company_Id) }));
    } catch (error) {
      console.error('Error al resolver empresa PTC REMA:', error);
      notify('Error al cargar empresa productora', 'error');
    }
  };

  const cargarProductos = async () => {
    try {
      const params = new URLSearchParams();
      params.append('limit', '1000');
      if (filters.Company_Id) params.append('company_id', filters.Company_Id);
      const res = await api.get(`/productos?${params.toString()}`);
      setProductos(res.data?.data || []);
    } catch (error) {
      console.error('Error al cargar productos para filtro BOM:', error);
      setProductos([]);
    }
  };

  const cargarBOMs = async () => {
    try {
      setLoading(true);
      const response = await bomService.listBOM(filters);
      setBoms(response.data || []);
    } catch (error) {
      console.error('Error al cargar BOMs:', error);
      notify('Error al cargar lista de materiales', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async (bomId) => {
    if (!confirm('¿Está seguro de eliminar este BOM? Esta acción no se puede deshacer.')) return;
    
    try {
      await bomService.deleteBOM(bomId);
      notify('BOM eliminado correctamente', 'success');
      cargarBOMs();
    } catch (error) {
      console.error('Error al eliminar BOM:', error);
      notify(error.response?.data?.message || 'Error al eliminar BOM', 'error');
    }
  };

  const handleClonar = async (bomId) => {
    const nuevaVersion = prompt('Ingrese el número de la nueva versión:');
    if (!nuevaVersion) return;
    
    try {
      const response = await bomService.clonarBOM(bomId, parseInt(nuevaVersion));
      notify('BOM clonado correctamente', 'success');
      navigate(`/produccion/bom/${response.data.BOM_Id}`);
    } catch (error) {
      console.error('Error al clonar BOM:', error);
      notify('Error al clonar BOM', 'error');
    }
  };

  const handleNuevo = () => {
    setEditingId(null);
    setModalOpen(true);
  };

  const handleEditar = (id) => {
    setEditingId(id);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingId(null);
    cargarBOMs();
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Recetas de Producción</h1>
          <p className="text-sm text-gray-500 mt-1">
            Empresa productora fija: <span className="font-medium text-gray-700">{ptcRemaCompany?.NameCompany || 'PTC REMA'}</span>
          </p>
        </div>
        <button
          onClick={handleNuevo}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
        >
          <FaPlus /> Nueva Receta
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Producto</label>
            <select
              value={filters.Producto_Id}
              onChange={(e) => setFilters({ ...filters, Producto_Id: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Todos</option>
              {productos.map((p) => (
                <option key={p.Producto_Id} value={p.Producto_Id}>
                  {p.SKU} - {p.Nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Estado</label>
            <select
              value={filters.Vigente}
              onChange={(e) => setFilters({ ...filters, Vigente: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="1">Vigentes</option>
              <option value="0">Obsoletos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de BOMs */}
      {loading ? (
        <div className="text-center py-8">Cargando...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Versión</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Materiales</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operaciones</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Merma %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {boms.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                    No hay recetas registradas
                  </td>
                </tr>
              ) : (
                boms.map((bom) => (
                  <tr key={bom.BOM_Id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">{bom.CodigoBOM}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium">{bom.ProductoNombre}</div>
                      <div className="text-gray-500 text-xs">{bom.SKU}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">v{bom.Version}</td>
                    <td className="px-6 py-4 text-sm text-center">{bom.TotalMateriales || 0}</td>
                    <td className="px-6 py-4 text-sm text-center">{bom.TotalOperaciones || 0}</td>
                    <td className="px-6 py-4 text-sm">{bom.MermaPct}%</td>
                    <td className="px-6 py-4 text-sm">
                      {bom.Vigente ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <FaCheckCircle /> Vigente
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400">
                          <FaTimesCircle /> Obsoleto
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/produccion/bom/${bom.BOM_Id}`)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Ver detalle"
                        >
                          <FaEye />
                        </button>
                        <button
                          onClick={() => handleEditar(bom.BOM_Id)}
                          className="text-yellow-600 hover:text-yellow-800"
                          title="Editar"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleClonar(bom.BOM_Id)}
                          className="text-green-600 hover:text-green-800"
                          title="Clonar (nueva versión)"
                        >
                          <FaCopy />
                        </button>
                        <button
                          onClick={() => handleEliminar(bom.BOM_Id)}
                          className="text-red-600 hover:text-red-800"
                          title="Eliminar"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingId ? 'Editar Receta' : 'Nueva Receta'}
        size="xl"
      >
        <FormularioBOMModal
          id={editingId}
          onClose={handleCloseModal}
        />
      </Modal>
    </div>
  );
};

export default GestionBOM;
