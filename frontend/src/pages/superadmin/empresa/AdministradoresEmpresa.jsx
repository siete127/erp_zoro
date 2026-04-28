import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaUserShield, FaPlus, FaTrash } from 'react-icons/fa';
import api from '../../../services/api';

export default function AdministradoresEmpresa() {
  const { empresaId } = useOutletContext();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ Name: '', Lastname: '', Email: '', Password: 'DefaultPass123!', PhoneNumber: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/superadmin/empresas/${empresaId}/admins`)
      .then(r => setAdmins(r.data.items || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, [empresaId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/superadmin/empresas/${empresaId}/admins`, form);
      setShowModal(false);
      setForm({ Name: '', Lastname: '', Email: '', Password: 'DefaultPass123!', PhoneNumber: '' });
      load();
    } catch { alert('Error al crear administrador'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (adminId) => {
    if (!window.confirm('¿Eliminar este administrador?')) return;
    await api.delete(`/superadmin/empresas/${empresaId}/admins/${adminId}`);
    load();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Administradores</h1>
            <p className="text-sm text-gray-500">Gestión de admins de esta empresa</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <FaPlus /> Nuevo admin
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-8">Cargando...</div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FaUserShield className="text-4xl mx-auto mb-3" />
            <p>No hay administradores registrados</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Teléfono</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {admins.map(admin => (
                  <tr key={admin.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{admin.name} {admin.lastname || ''}</td>
                    <td className="py-3 px-4 text-gray-600">{admin.email}</td>
                    <td className="py-3 px-4 text-gray-600">{admin.phone || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        admin.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {admin.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(admin.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nuevo administrador</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    required value={form.Name}
                    onChange={e => setForm(f => ({ ...f, Name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Apellido</label>
                  <input
                    value={form.Lastname}
                    onChange={e => setForm(f => ({ ...f, Lastname: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input
                  required type="email" value={form.Email}
                  onChange={e => setForm(f => ({ ...f, Email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  value={form.Password}
                  onChange={e => setForm(f => ({ ...f, Password: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  value={form.PhoneNumber}
                  onChange={e => setForm(f => ({ ...f, PhoneNumber: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Crear admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
