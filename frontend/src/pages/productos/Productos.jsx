import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';
import ProductoForm from './ProductoForm';
import { getUserRole } from '../../utils/tokenHelper';

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
      console.error('Error cargando productos', err);
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
        const res = await api.get('/companies');
        setCompanies(res.data || []);

        // Obtener rol del usuario desde JWT (fuente confiable)
        setUserRole(getUserRole());
      } catch (err) {
        console.error('Error cargando empresas', err);
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

  const refresh = async () => {
    await fetchProductos();
  };

  const startCreate = () => {
    setEditing(null);
    setCreateMode(true);
  };

  const openDetail = async (p) => {
    try {
      const res = await api.get(`/productos/${p.Producto_Id}`);
      setViewDetail(res.data);
    } catch (err) {
      console.error('Error cargando detalle de producto', err);
      notify(err.response?.data?.msg || 'Error cargando detalle de producto', 'error');
    }
  };

  const startEdit = async (p) => {
    try {
      const res = await api.get(`/productos/${p.Producto_Id}`);
      setEditing(res.data);
      setCreateMode(true);
    } catch (err) {
      console.error('Error cargando producto', err);
      notify(err.response?.data?.msg || 'Error cargando producto', 'error');
    }
  };

  const removeProducto = async (p) => {
    const ok = await confirm(
      `Eliminar permanentemente el producto ${p.Nombre || p.SKU}? Esta acción no se puede deshacer.`,
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
      console.error('Error eliminando producto', err);
      notify(err.response?.data?.msg || 'Error eliminando producto', 'error');
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Productos</h2>
          <p className="text-sm text-gray-600">Listado de productos registrados en el ERP</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/productos/importar')}
            className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
          >
            Importar desde Excel
          </button>
          <button
            onClick={startCreate}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            Nuevo producto
          </button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex items-center gap-2 mb-4">
        {(userRole === 1 || userRole === 2) && (
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="p-2 rounded border bg-white text-gray-900 border-gray-300 text-sm"
          >
            <option value="all">Todas las empresas</option>
            {companies.map((c) => (
              <option key={c.Company_Id} value={c.Company_Id}>
                {c.NameCompany}
              </option>
            ))}
          </select>
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por SKU, nombre o descripción"
          className="flex-1 p-2 rounded border bg-white text-gray-900 border-gray-300 placeholder-gray-500"
        />
        <button
          type="submit"
          className="px-3 py-2 bg-[#092052] hover:bg-[#0d3a7a] text-white rounded text-sm"
        >
          Buscar
        </button>
      </form>

      {loading ? (
        <p className="text-gray-900">Cargando productos...</p>
      ) : (
        <>
          <div className="overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-sm text-gray-600">
                  <th className="py-2 pl-4 pr-4 w-32">SKU</th>
                  <th className="py-2 pr-4">Nombre</th>
                  <th className="py-2 pr-4 w-24 text-right">Precio</th>
                  <th className="py-2 pr-4 w-32">Moneda</th>
                  <th className="py-2 pr-4 w-32">Clave SAT</th>
                  <th className="py-2 pr-4 w-28">Unidad SAT</th>
                  <th className="py-2 pr-4 w-48 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 px-4 text-sm text-gray-600">
                      No hay productos registrados.
                    </td>
                  </tr>
                )}
                {productos.map((p) => (
                  <tr key={p.Producto_Id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="py-3 pl-4 pr-4 text-gray-900 text-sm">{p.SKU}</td>
                    <td className="py-3 pr-4 text-gray-900 text-sm">{p.Nombre}</td>
                    <td className="py-3 pr-4 text-gray-900 text-sm text-right">
                      {typeof p.Precio === 'number' ? p.Precio.toFixed(2) : p.Precio}
                    </td>
                    <td className="py-3 pr-4 text-gray-900 text-sm">{p.TipoMoneda || '-'}</td>
                    <td className="py-3 pr-4 text-gray-900 text-sm">{p.ClaveProdServSAT}</td>
                    <td className="py-3 pr-4 text-gray-900 text-sm">{p.ClaveUnidadSAT}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openDetail(p)}
                          className="px-3 py-1 text-sm bg-[#092052] text-white rounded hover:bg-[#0d3a7a]"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => startEdit(p)}
                          className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => removeProducto(p)}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
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

          <div className="mt-4 text-sm text-gray-700">
            Total de productos: {total}
          </div>
        </>
      )}

      {viewDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[95vh] bg-white rounded-2xl shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Detalle del producto</h3>
              <button
                onClick={() => setViewDetail(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-600">SKU:</span>
                  <p className="text-gray-900">{viewDetail.SKU}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Nombre:</span>
                  <p className="text-gray-900">{viewDetail.Nombre}</p>
                </div>
              </div>
              <div>
                <span className="font-semibold text-gray-600">Descripción:</span>
                <p className="text-gray-900">{viewDetail.Descripcion || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-600">Precio:</span>
                  <p className="text-gray-900">{typeof viewDetail.Precio === 'number' ? viewDetail.Precio.toFixed(2) : viewDetail.Precio}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Moneda:</span>
                  <p className="text-gray-900">{viewDetail.TipoMoneda || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-600">Clave Producto/Servicio SAT:</span>
                  <p className="text-gray-900">{viewDetail.ClaveProdServSAT || '-'}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Clave Unidad SAT:</span>
                  <p className="text-gray-900">{viewDetail.ClaveUnidadSAT || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-600">Objeto de Impuesto:</span>
                  <p className="text-gray-900">{viewDetail.ObjetoImpuesto || '-'}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Activo:</span>
                  <p className="text-gray-900">{viewDetail.Activo ? 'Sí' : 'No'}</p>
                </div>
              </div>
              <div>
                <span className="font-semibold text-gray-600">Empresas asignadas:</span>
                {Array.isArray(viewDetail.companies) && viewDetail.companies.length > 0 ? (
                  <ul className="mt-1 list-disc list-inside text-gray-900">
                    {viewDetail.companies.map((c) => (
                      <li key={c.Company_Id}>{c.NameCompany}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-900">Sin empresas asignadas</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => { setViewDetail(null); startEdit(viewDetail); }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Editar
              </button>
              <button
                onClick={() => setViewDetail(null)}
                className="px-4 py-2 bg-[#092052] text-white rounded hover:bg-[#0d3a7a]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {createMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[95vh] bg-white rounded-2xl shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editing ? 'Editar producto' : 'Nuevo producto'}
              </h3>
              <button
                onClick={() => { setCreateMode(false); setEditing(null); }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <ProductoForm
              producto={editing}
              onSave={async () => {
                setCreateMode(false);
                setEditing(null);
                await refresh();
              }}
              onCancel={() => { setCreateMode(false); setEditing(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
