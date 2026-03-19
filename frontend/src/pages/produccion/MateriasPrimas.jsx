import { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import * as materiaPrimaService from '../../services/materiaPrimaService';
import Modal from '../../components/Modal';
import FormularioMateriaPrimaModal from './FormularioMateriaPrimaModal';
import { notify } from '../../services/notify';

const MateriasPrimas = () => {
  const [materias, setMaterias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ Activo: '1' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    cargarMaterias();
  }, [filters]);

  const cargarMaterias = async () => {
    try {
      setLoading(true);
      const response = await materiaPrimaService.listMateriasPrimas(filters);
      setMaterias(response.data || []);
    } catch (error) {
      console.error('Error al cargar materias primas:', error);
      notify('Error al cargar materias primas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Está seguro de eliminar esta materia prima?')) return;
    
    try {
      await materiaPrimaService.deleteMateriaPrima(id);
      notify('Materia prima eliminada correctamente', 'success');
      cargarMaterias();
    } catch (error) {
      console.error('Error al eliminar:', error);
      notify(error.response?.data?.message || 'Error al eliminar materia prima', 'error');
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
    cargarMaterias();
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold">Materias Primas</h1>
          <button
            onClick={handleNuevo}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            <FaPlus /> Nueva Materia Prima
          </button>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <select
                value={filters.Activo}
                onChange={(e) => setFilters({ ...filters, Activo: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Todos</option>
                <option value="1">Activos</option>
                <option value="0">Inactivos</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Cargando...</div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidad Consumo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Costo Unitario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {materias.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                      No hay materias primas registradas
                    </td>
                  </tr>
                ) : (
                  materias.map((mat) => (
                    <tr key={mat.MateriaPrima_Id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium">{mat.Codigo}</td>
                      <td className="px-6 py-4 text-sm">{mat.Nombre}</td>
                      <td className="px-6 py-4 text-sm">{mat.Tipo}</td>
                      <td className="px-6 py-4 text-sm">{mat.UnidadConsumo}</td>
                      <td className="px-6 py-4 text-sm">${mat.CostoUnitario?.toFixed(2)} {mat.Moneda}</td>
                      <td className="px-6 py-4 text-sm">
                        {mat.Activo ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <FaCheckCircle /> Activo
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400">
                            <FaTimesCircle /> Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditar(mat.MateriaPrima_Id)}
                            className="text-yellow-600 hover:text-yellow-800"
                            title="Editar"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleEliminar(mat.MateriaPrima_Id)}
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
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingId ? 'Editar Materia Prima' : 'Nueva Materia Prima'}
        size="lg"
      >
        <FormularioMateriaPrimaModal
          id={editingId}
          onClose={handleCloseModal}
        />
      </Modal>
    </div>
  );
};

export default MateriasPrimas;
