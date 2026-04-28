import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaUsers } from 'react-icons/fa';
import api from '../../../services/api';

export default function UsuariosEmpresa() {
  const { empresaId } = useOutletContext();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get(`/superadmin/empresas/${empresaId}/usuarios`)
      .then(r => setUsuarios(r.data.items || []))
      .finally(() => setLoading(false));
  }, [empresaId]);

  const filtered = usuarios.filter(u =>
    `${u.name} ${u.lastname || ''} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500">Todos los usuarios de esta empresa</p>
        </div>

        <div className="mb-4">
          <input
            type="text" placeholder="Buscar usuario..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-8">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FaUsers className="text-4xl mx-auto mb-3" />
            <p>Sin usuarios encontrados</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{u.name} {u.lastname || ''}</td>
                    <td className="py-3 px-4 text-gray-600">{u.email}</td>
                    <td className="py-3 px-4 text-gray-600">{u.rol_name || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 px-4 py-2">{filtered.length} usuarios</p>
          </div>
        )}
      </div>
    </div>
  );
}
