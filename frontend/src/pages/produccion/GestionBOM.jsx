import { useEffect, useMemo, useState } from 'react';
import { FaCheckCircle, FaCopy, FaEdit, FaEye, FaPlus, FaTimesCircle, FaTrash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
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
import api from '../../services/api';
import * as bomService from '../../services/bomService';
import FormularioBOMModal from './FormularioBOMModal';

const findPTCRemaCompany = (companies = []) =>
  companies.find((company) => {
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
    Vigente: '1',
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
      const response = await api.get('/companies/');
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
    if (!window.confirm('¿Está seguro de eliminar este BOM? Esta acción no se puede deshacer.')) return;

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
    const nuevaVersion = window.prompt('Ingrese el número de la nueva versión:');
    if (!nuevaVersion) return;

    try {
      const response = await bomService.clonarBOM(bomId, Number.parseInt(nuevaVersion, 10));
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

  const vigentes = useMemo(() => boms.filter((bom) => bom.Vigente).length, [boms]);
  const totalMateriales = useMemo(
    () => boms.reduce((sum, bom) => sum + Number(bom.TotalMateriales || 0), 0),
    [boms],
  );
  const totalOperaciones = useMemo(
    () => boms.reduce((sum, bom) => sum + Number(bom.TotalOperaciones || 0), 0),
    [boms],
  );

  return (
    <div className={operationPageClass}>
      <div className={operationContainerClass}>
        <OperationHeader
          eyebrow="Producción"
          title="Recetas de Producción"
          description="Administra versiones de BOM, componentes, operaciones y vigencia del modelo productivo sobre la empresa productora fija."
          actions={
            <button onClick={handleNuevo} className={operationPrimaryButtonClass}>
              <FaPlus className="text-xs" /> Nueva receta
            </button>
          }
          stats={[
            <OperationStat key="empresa" label="Empresa productora" value={ptcRemaCompany?.NameCompany || 'PTC REMA'} tone="slate" />,
            <OperationStat key="boms" label="BOMs" value={boms.length} tone="blue" />,
            <OperationStat key="vigentes" label="Vigentes" value={vigentes} tone="emerald" />,
            <OperationStat key="materiales" label="Materiales" value={totalMateriales} tone="amber" />,
          ]}
        />

        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
          <OperationSectionTitle
            eyebrow="Filtro"
            title="Vista de recetas"
            description="Refina por producto o etapa de vigencia para revisar solo la configuración activa."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Producto</label>
              <select
                value={filters.Producto_Id}
                onChange={(e) => setFilters({ ...filters, Producto_Id: e.target.value })}
                className={operationFieldClass}
              >
                <option value="">Todos</option>
                {productos.map((producto) => (
                  <option key={producto.Producto_Id} value={producto.Producto_Id}>
                    {producto.SKU} - {producto.Nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Estado</label>
              <select
                value={filters.Vigente}
                onChange={(e) => setFilters({ ...filters, Vigente: e.target.value })}
                className={operationFieldClass}
              >
                <option value="">Todos</option>
                <option value="1">Vigentes</option>
                <option value="0">Obsoletos</option>
              </select>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Operaciones</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{totalOperaciones}</p>
            </div>
          </div>
        </div>

        <div className={operationTableShellClass}>
          <div className="border-b border-[#e7edf6] px-6 py-4">
            <OperationSectionTitle
              eyebrow="BOM"
              title="Catálogo de recetas"
              description="Versiones vigentes, niveles de materiales, operaciones y accesos rápidos a detalle o edición."
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : boms.length === 0 ? (
            <div className="p-6">
              <OperationEmptyState
                title="Sin recetas registradas"
                description="Cuando captures o importes BOMs aparecerán aquí con sus versiones, materiales y vigencia."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#e7edf6]">
                    {['Código', 'Producto', 'Versión', 'Materiales', 'Operaciones', 'Merma %', 'Estado', 'Acciones'].map((header) => (
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
                  {boms.map((bom) => (
                    <tr key={bom.BOM_Id} className="border-t border-[#eef2f8] transition hover:bg-[#f7faff]">
                      <td className="px-4 py-4 pl-6 text-sm font-semibold text-slate-900">{bom.CodigoBOM}</td>
                      <td className="px-4 py-4 text-sm">
                        <div className="font-semibold text-slate-900">{bom.ProductoNombre}</div>
                        <div className="text-xs text-slate-400">{bom.SKU}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">v{bom.Version}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{bom.TotalMateriales || 0}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{bom.TotalOperaciones || 0}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{bom.MermaPct}%</td>
                      <td className="px-4 py-4 text-sm">
                        {bom.Vigente ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            <FaCheckCircle className="text-[10px]" /> Vigente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                            <FaTimesCircle className="text-[10px]" /> Obsoleto
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 pr-6">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => navigate(`/produccion/bom/${bom.BOM_Id}`)}
                            className={operationSecondaryButtonClass}
                            title="Ver detalle"
                          >
                            <FaEye className="text-xs" /> Ver
                          </button>
                          <button
                            onClick={() => handleEditar(bom.BOM_Id)}
                            className={operationSecondaryButtonClass}
                            title="Editar"
                          >
                            <FaEdit className="text-xs" /> Editar
                          </button>
                          <button
                            onClick={() => handleClonar(bom.BOM_Id)}
                            className="inline-flex items-center justify-center rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                            title="Clonar (nueva versión)"
                          >
                            <FaCopy className="text-xs" /> Clonar
                          </button>
                          <button
                            onClick={() => handleEliminar(bom.BOM_Id)}
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

        <Modal isOpen={modalOpen} onClose={handleCloseModal} title={editingId ? 'Editar Receta' : 'Nueva Receta'} size="xl">
          <FormularioBOMModal id={editingId} onClose={handleCloseModal} />
        </Modal>
      </div>
    </div>
  );
};

export default GestionBOM;
