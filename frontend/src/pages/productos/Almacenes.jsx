import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';

export default function Almacenes() {
  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ Nombre: '', Codigo: '', Direccion: '', Activo: true, Company_Id: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [viewDetail, setViewDetail] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const fetchAlmacenes = async () => {
    setLoading(true);
    try {
      const url = selectedCompany === 'all' ? '/almacenes' : `/almacenes?company_id=${selectedCompany}`;
      const res = await api.get(url);
      setAlmacenes(res.data || []);
    } catch (err) {
      console.error('Error cargando almacenes', err);
      notify(err.response?.data?.msg || 'Error cargando almacenes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlmacenes();
  }, [selectedCompany]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await api.get('/companies');
        setCompanies(res.data || []);
        
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setUserRole(user.RolId);
      } catch (err) {
        console.error('Error cargando empresas', err);
      }
    };
    fetchCompanies();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData({ Nombre: '', Codigo: '', Direccion: '', Activo: true, Company_Id: '' });
    setModalOpen(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setFormData({
      Nombre: a.Nombre || '',
      Codigo: a.Codigo || '',
      Direccion: a.Direccion || '',
      Activo: a.Activo === false ? false : true,
      Company_Id: a.Company_Id || ''
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing?.Almacen_Id) {
        await api.put(`/almacenes/${editing.Almacen_Id}`, formData);
        notify('Almacén actualizado', 'success');
      } else {
        await api.post('/almacenes', formData);
        notify('Almacén creado', 'success');
      }
      setModalOpen(false);
      setEditing(null);
      await fetchAlmacenes();
    } catch (err) {
      console.error('Error guardando almacén', err);
      notify(err.response?.data?.msg || 'Error al guardar almacén', 'error');
    }
  };

  const removeAlmacen = async (a) => {
    const ok = await confirm(
      `Eliminar permanentemente el almacén ${a.Nombre}? Esta acción no se puede deshacer.`,
      'Eliminar almacén',
      'Eliminar',
      'Cancelar'
    );
    if (!ok) return;
    try {
      await api.delete(`/almacenes/${a.Almacen_Id}`);
      notify('Almacén eliminado', 'success');
      await fetchAlmacenes();
    } catch (err) {
      console.error('Error eliminando almacén', err);
      notify(err.response?.data?.msg || 'Error al eliminar almacén', 'error');
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Almacenes</h2>
          <p className="text-sm text-gray-600">Gestión de bodegas y sucursales</p>
        </div>
        <button
          onClick={openCreate}
          className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
        >
          Nuevo almacén
        </button>
      </div>

      {loading ? (
        <p className="text-gray-900">Cargando almacenes...</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3 max-w-xl">
            {(userRole === 1 || userRole === 2) && (
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="p-2 rounded border bg-white text-gray-900 border-gray-300"
              >
                <option value="all">Todas las empresas</option>
                {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
              </select>
            )}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o código"
              className="flex-1 p-2 rounded border bg-white text-gray-900 border-gray-300 placeholder-gray-500"
            />
          </div>

          <div className="overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-sm text-gray-600">
                  <th className="py-2 pl-4 pr-4">Nombre</th>
                  <th className="py-2 pr-4 w-32">Código</th>
                  <th className="py-2 pr-4">Dirección</th>
                  <th className="py-2 pr-4 w-24">Activo</th>
                  <th className="py-2 pr-4 w-48 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {almacenes
                  .filter((a) => {
                    if (!query) return true;
                    const q = query.toLowerCase();
                    return (
                      (a.Nombre || '').toLowerCase().includes(q) ||
                      (a.Codigo || '').toLowerCase().includes(q)
                    );
                  })
                  .map((a) => (
                <tr key={a.Almacen_Id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="py-3 pl-4 pr-4 text-gray-900 text-sm">{a.Nombre}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm">{a.Codigo}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm">{a.Direccion || '-'}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm">{a.Activo ? 'Sí' : 'No'}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setViewDetail(a)}
                        className="px-3 py-1 text-sm bg-[#092052] text-white rounded hover:bg-[#0d3a7a]"
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => openEdit(a)}
                        className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => removeAlmacen(a)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
                {almacenes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 px-4 text-sm text-gray-600">
                      No hay almacenes registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {viewDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[95vh] bg-white rounded-2xl shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Detalle del almacén</h3>
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
                  <span className="font-semibold text-gray-600">Nombre:</span>
                  <p className="text-gray-900">{viewDetail.Nombre}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Código:</span>
                  <p className="text-gray-900">{viewDetail.Codigo}</p>
                </div>
              </div>
              <div>
                <span className="font-semibold text-gray-600">Dirección:</span>
                <p className="text-gray-900">{viewDetail.Direccion || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-600">Empresa:</span>
                  <p className="text-gray-900">{viewDetail.NameCompany || '-'}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Activo:</span>
                  <p className="text-gray-900">{viewDetail.Activo ? 'Sí' : 'No'}</p>
                </div>
              </div>
              <div>
                <span className="font-semibold text-gray-600">Fecha de creación:</span>
                <p className="text-gray-900">
                  {viewDetail.FechaCreacion ? new Date(viewDetail.FechaCreacion).toLocaleString('es-MX', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  }) : '-'}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => { setViewDetail(null); openEdit(viewDetail); }}
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[95vh] bg-white rounded-2xl shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editing ? 'Editar almacén' : 'Nuevo almacén'}
              </h3>
              <button
                onClick={() => { setModalOpen(false); setEditing(null); }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium mb-1">Código *</label>
                <input
                  type="text"
                  value={formData.Codigo}
                  onChange={(e) => setFormData({ ...formData, Codigo: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Dirección</label>
                <textarea
                  value={formData.Direccion}
                  onChange={(e) => setFormData({ ...formData, Direccion: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Empresa</label>
                <select
                  value={formData.Company_Id}
                  onChange={(e) => setFormData({ ...formData, Company_Id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar empresa</option>
                  {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.Activo}
                  onChange={(e) => setFormData({ ...formData, Activo: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm font-medium">Activo</label>
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
                  onClick={() => { setModalOpen(false); setEditing(null); }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
