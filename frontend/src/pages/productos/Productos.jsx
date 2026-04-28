import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';
import ProductoForm from './ProductoForm';
import { getUserRole } from '../../utils/tokenHelper';
import ProductoImagenes from '../../components/productos/ProductoImagenes';
import {
  operationContainerClass,
  operationFieldClass,
  operationPageClass,
  operationPrimaryButtonClass,
  operationSectionClass,
  operationSecondaryButtonClass,
  operationTableShellClass,
  OperationHeader,
  OperationSectionTitle,
  OperationStat,
} from '../../components/operation/OperationUI';

const premiumFieldClass = operationFieldClass;

function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 font-medium">{value || '-'}</p>
    </div>
  );
}

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [total, setTotal] = useState(0);
  const [createMode, setCreateMode] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('all');
  const [userRole, setUserRole] = useState(null);

  const navigate = useNavigate();

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append('search', query);
      if (companyId && companyId !== 'all') params.append('company_id', companyId);
      const res = await api.get(`/productos?${params.toString()}`);
      const data = res.data || {};
      setProductos(data.data || []);
      setTotal(data.total || (data.data ? data.data.length : 0));
    } catch (err) {
      notify(err.response?.data?.msg || 'Error cargando productos', 'error');
      setProductos([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await api.get('/companies/');
        setCompanies(res.data || []);
        setUserRole(getUserRole());
      } catch {
        // ignore
      }
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleSearch = async (e) => {
    e.preventDefault();
    await fetchProductos();
  };

  const refresh = async () => { await fetchProductos(); };

  const startCreate = () => { setEditing(null); setCreateMode(true); };

  const openDetail = async (p) => {
    try {
      const res = await api.get(`/productos/${p.Producto_Id}`);
      setViewDetail(res.data);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error cargando detalle de producto', 'error');
    }
  };

  const startEdit = async (p) => {
    try {
      const res = await api.get(`/productos/${p.Producto_Id}`);
      setEditing(res.data);
      setCreateMode(true);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error cargando producto', 'error');
    }
  };

  const removeProducto = async (p) => {
    const ok = await confirm(
      `Eliminar permanentemente el producto ${p.Nombre || p.SKU}? Esta accion no se puede deshacer.`,
      'Eliminar producto',
      'Eliminar',
      'Cancelar'
    );
    if (!ok) return;
    try {
      await api.delete(`/productos/${p.Producto_Id}`);
      notify('Producto eliminado', 'success');
      await refresh();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error eliminando producto', 'error');
    }
  };

  return (
    <div className={operationPageClass}>
      <div className={operationContainerClass}>
        <OperationHeader
          eyebrow="Operacion"
          title="Productos"
          description="Catalogo operativo, altas, consulta detallada y acceso a importacion y activos visuales."
          actions={
            <>
              <button
                onClick={() => navigate('/productos/importar')}
                className={operationSecondaryButtonClass}
              >
                Importar Excel
              </button>
              <button onClick={startCreate} className={operationPrimaryButtonClass}>
                Nuevo producto
              </button>
            </>
          }
          stats={
            <>
              <OperationStat label="Productos visibles" value={total} tone="blue" />
              <OperationStat label="Empresa filtro" value={companyId === 'all' ? 'Todas' : String(companyId)} tone="slate" />
            </>
          }
        />

        {/* Search / filter bar */}
        <div className={operationSectionClass}>
          <OperationSectionTitle
            eyebrow="Busqueda"
            title="Explorar catalogo"
            description="Filtra por empresa, SKU o nombre para concentrarte en el inventario correcto."
          />
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
            {(userRole === 1 || userRole === 2) && (
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={`sm:w-52 ${premiumFieldClass}`}
              >
                <option value="all">Todas las empresas</option>
                {companies.map((c) => (
                  <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>
                ))}
              </select>
            )}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por SKU, nombre o descripcion..."
              className={`flex-1 ${premiumFieldClass}`}
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-[14px] bg-[#1b3d86] text-white text-sm font-semibold hover:bg-[#2a5fc4] transition-colors shadow-[0_2px_8px_rgba(27,61,134,0.2)]"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* Table */}
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-[22px] bg-slate-200/60" />
            ))}
          </div>
        ) : (
          <>
            <div className={operationTableShellClass}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#eaf0fa]">
                      <th className="py-3 pl-5 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-32">SKU</th>
                      <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96]">Nombre</th>
                      <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-28 text-right">Precio</th>
                      <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-24">Moneda</th>
                      <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-32">Clave SAT</th>
                      <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-28">Unidad SAT</th>
                      <th className="py-3 pr-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-48 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 px-5 text-sm text-slate-400 text-center">
                          No hay productos registrados.
                        </td>
                      </tr>
                    )}
                    {productos.map((p) => (
                      <tr key={p.Producto_Id} className="border-t border-[#eaf0fa] hover:bg-[#f5f8fe] transition-colors">
                        <td className="py-3.5 pl-5 pr-4 text-slate-500 text-xs font-mono">{p.SKU}</td>
                        <td className="py-3.5 pr-4 text-slate-800 font-medium text-sm">{p.Nombre}</td>
                        <td className="py-3.5 pr-4 text-slate-800 font-semibold text-sm text-right">
                          {typeof p.Precio === 'number' ? p.Precio.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : p.Precio}
                        </td>
                        <td className="py-3.5 pr-4 text-slate-600 text-sm">{p.TipoMoneda || '-'}</td>
                        <td className="py-3.5 pr-4 text-slate-600 text-xs font-mono">{p.ClaveProdServSAT}</td>
                        <td className="py-3.5 pr-4 text-slate-600 text-xs">{p.ClaveUnidadSAT}</td>
                        <td className="py-3.5 pr-5">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openDetail(p)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              Ver
                            </button>
                            <button
                              onClick={() => startEdit(p)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => removeProducto(p)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-slate-500 px-1">Total de productos: <strong className="text-slate-700">{total}</strong></p>
          </>
        )}
      </div>

      {/* Detail modal */}
      {viewDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] shadow-[0_32px_80px_rgba(15,45,93,0.28)]">
            <div className="shrink-0 bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-200/80">Catalogo</p>
                  <h3 className="mt-0.5 text-xl font-bold text-white">{viewDetail.Nombre}</h3>
                  <p className="mt-1 text-sm text-blue-100/70">{viewDetail.SKU}</p>
                </div>
                <button
                  onClick={() => setViewDetail(null)}
                  className="ml-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-lg leading-none"
                >
                  {"\u00d7"}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#f4f7fc] p-5 space-y-4">
              <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,253,0.96))] p-5 shadow-[0_8px_24px_rgba(15,45,93,0.07)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96] mb-3">Identificacion</p>
                <div className="grid grid-cols-2 gap-4">
                  <DetailRow label="SKU" value={viewDetail.SKU} />
                  <DetailRow label="Nombre" value={viewDetail.Nombre} />
                  <DetailRow label="Activo" value={viewDetail.Activo ? 'Si' : 'No'} />
                  <DetailRow label="Moneda" value={viewDetail.TipoMoneda} />
                </div>
                <div className="mt-4">
                  <DetailRow label="Descripcion" value={viewDetail.Descripcion} />
                </div>
              </div>
              <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,253,0.96))] p-5 shadow-[0_8px_24px_rgba(15,45,93,0.07)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96] mb-3">Fiscal SAT</p>
                <div className="grid grid-cols-2 gap-4">
                  <DetailRow label="Precio" value={typeof viewDetail.Precio === 'number' ? viewDetail.Precio.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : viewDetail.Precio} />
                  <DetailRow label="Objeto de Impuesto" value={viewDetail.ObjetoImpuesto} />
                  <DetailRow label="Clave Prod/Serv SAT" value={viewDetail.ClaveProdServSAT} />
                  <DetailRow label="Clave Unidad SAT" value={viewDetail.ClaveUnidadSAT} />
                </div>
              </div>
              <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,253,0.96))] p-5 shadow-[0_8px_24px_rgba(15,45,93,0.07)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96] mb-3">Empresas asignadas</p>
                {Array.isArray(viewDetail.companies) && viewDetail.companies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {viewDetail.companies.map((c) => (
                      <span key={c.Company_Id} className="text-xs font-medium px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-800">
                        {c.NameCompany}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Sin empresas asignadas</p>
                )}
              </div>
              <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,253,0.96))] p-5 shadow-[0_8px_24px_rgba(15,45,93,0.07)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96] mb-3">Imagenes</p>
                <ProductoImagenes productoId={viewDetail.Producto_Id} />
              </div>
            </div>
            <div className="shrink-0 border-t border-[#eaf0fa] bg-white px-5 py-3.5 flex justify-end gap-2">
              <button
                onClick={() => { setViewDetail(null); startEdit(viewDetail); }}
                className="px-4 py-2 rounded-[12px] border border-[#dce4f0] bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => setViewDetail(null)}
                className="px-4 py-2 rounded-[12px] bg-[#1b3d86] text-white text-sm font-semibold hover:bg-[#2a5fc4] transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / edit modal */}
      {createMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] shadow-[0_32px_80px_rgba(15,45,93,0.28)]">
            <div className="shrink-0 bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-200/80">Catalogo</p>
                  <h3 className="mt-0.5 text-xl font-bold text-white">
                    {editing ? 'Editar producto' : 'Nuevo producto'}
                  </h3>
                </div>
                <button
                  onClick={() => { setCreateMode(false); setEditing(null); }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-lg leading-none"
                >
                  {"\u00d7"}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#f4f7fc] p-5">
              <ProductoForm
                producto={editing}
                onSave={async () => { setCreateMode(false); setEditing(null); await refresh(); }}
                onCancel={() => { setCreateMode(false); setEditing(null); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
