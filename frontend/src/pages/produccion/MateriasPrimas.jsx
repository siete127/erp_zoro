import { useEffect, useMemo, useState } from 'react';
import { FaCheckCircle, FaEdit, FaPlus, FaTimesCircle, FaTrash } from 'react-icons/fa';
import Modal from '../../components/Modal';
import {
  OperationEmptyState,
  OperationHeader,
  OperationSectionTitle,
  OperationStat,
  operationContainerClass,
  operationDangerButtonClass,
  operationFieldClass,
  operationPageClass,
  operationPrimaryButtonClass,
  operationSecondaryButtonClass,
  operationTableShellClass,
} from '../../components/operation/OperationUI';
import { notify } from '../../services/notify';
import * as materiaPrimaService from '../../services/materiaPrimaService';
import FormularioMateriaPrimaModal from './FormularioMateriaPrimaModal';

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
    if (!window.confirm('¿Está seguro de eliminar esta materia prima?')) return;

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

  const activas = useMemo(() => materias.filter((materia) => materia.Activo).length, [materias]);
  const costoPromedio = useMemo(() => {
    if (!materias.length) return 0;
    const conCosto = materias.filter((materia) => Number(materia.CostoUnitario || 0) > 0);
    if (!conCosto.length) return 0;
    return conCosto.reduce((sum, materia) => sum + Number(materia.CostoUnitario || 0), 0) / conCosto.length;
  }, [materias]);
  const tipos = useMemo(() => new Set(materias.map((materia) => materia.Tipo).filter(Boolean)).size, [materias]);

  return (
    <div className={operationPageClass}>
      <div className={operationContainerClass}>
        <OperationHeader
          eyebrow="Producción"
          title="Materias Primas"
          description="Administra catálogo, consumo, costo unitario y vigencia operativa de los insumos base para producción."
          actions={
            <button onClick={handleNuevo} className={operationPrimaryButtonClass}>
              <FaPlus className="text-xs" /> Nueva materia prima
            </button>
          }
          stats={[
            <OperationStat key="total" label="Registros" value={materias.length} tone="blue" />,
            <OperationStat key="activas" label="Activas" value={activas} tone="emerald" />,
            <OperationStat key="tipos" label="Tipos" value={tipos} tone="amber" />,
            <OperationStat
              key="costo"
              label="Costo prom."
              value={costoPromedio ? `$${costoPromedio.toFixed(2)}` : '-'}
              tone="slate"
            />,
          ]}
        />

        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
          <OperationSectionTitle
            eyebrow="Filtro"
            title="Estado del catálogo"
            description="Revisa activos e inactivos para mantener limpio el maestro operativo."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Estado</label>
              <select
                value={filters.Activo}
                onChange={(e) => setFilters({ ...filters, Activo: e.target.value })}
                className={operationFieldClass}
              >
                <option value="">Todos</option>
                <option value="1">Activos</option>
                <option value="0">Inactivos</option>
              </select>
            </div>
          </div>
        </div>

        <div className={operationTableShellClass}>
          <div className="border-b border-[#e7edf6] px-6 py-4">
            <OperationSectionTitle
              eyebrow="Catálogo"
              title="Maestro de materias primas"
              description="Consulta código, tipo, unidad de consumo, costo y estado operativo."
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : materias.length === 0 ? (
            <div className="p-6">
              <OperationEmptyState
                title="Sin materias primas registradas"
                description="Cuando captures insumos productivos aparecerán aquí con su costo y estado operativo."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#e7edf6]">
                    {['Código', 'Nombre', 'Tipo', 'Unidad consumo', 'Costo unitario', 'Estado', 'Acciones'].map((header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materias.map((materia) => (
                    <tr key={materia.MateriaPrima_Id} className="border-t border-[#eef2f8] transition hover:bg-[#f7faff]">
                      <td className="px-4 py-4 pl-6 text-sm font-semibold text-slate-900">{materia.Codigo}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{materia.Nombre}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{materia.Tipo}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{materia.UnidadConsumo}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-800">
                        ${Number(materia.CostoUnitario || 0).toFixed(2)} {materia.Moneda}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {materia.Activo ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            <FaCheckCircle className="text-[10px]" /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                            <FaTimesCircle className="text-[10px]" /> Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 pr-6">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleEditar(materia.MateriaPrima_Id)}
                            className={operationSecondaryButtonClass}
                            title="Editar"
                          >
                            <FaEdit className="text-xs" /> Editar
                          </button>
                          <button
                            onClick={() => handleEliminar(materia.MateriaPrima_Id)}
                            className={operationDangerButtonClass}
                            title="Eliminar"
                          >
                            <FaTrash className="text-xs" /> Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Modal isOpen={modalOpen} onClose={handleCloseModal} title={editingId ? 'Editar Materia Prima' : 'Nueva Materia Prima'} size="lg">
          <FormularioMateriaPrimaModal id={editingId} onClose={handleCloseModal} />
        </Modal>
      </div>
    </div>
  );
};

export default MateriasPrimas;
