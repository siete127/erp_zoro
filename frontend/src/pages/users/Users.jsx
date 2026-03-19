import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';
import UserCreate from './UserCreate';
import UserPermissions from '../../components/UserPermissions';
import { getUserCompanies, getUserRole } from '../../utils/tokenHelper';

export default function Users() {
  const [tab, setTab] = useState('gestor');
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [viewingDetails, setViewingDetails] = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState(null);
  const [roleModules, setRoleModules] = useState([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [createMode, setCreateMode] = useState(false);  
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    Name: '', Lastname: '', Username: '', Password: '', Email: '', PhoneNumber: '', Area: '', RolId: '', IsActive: true, CreatedBy: 1
  });
  const [allowedCompanyIds, setAllowedCompanyIds] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const role = getUserRole();
    const userCompanyIds = getUserCompanies().map(Number).filter((id) => Number.isInteger(id));
    setIsSuperAdmin(role === 1);
    setAllowedCompanyIds(userCompanyIds);
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const url = selectedCompany === 'all' ? '/users' : `/users?company_id=${selectedCompany}`;
        const res = await api.get(url);
        setUsers(res.data || []);
      } catch (err) {
        console.error('Error fetching users', err);
        setError('Error cargando usuarios');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
    (async () => {
      try {
        const r = await api.get('/roles');
        setRoles(r.data || []);
      } catch (e) {
        console.warn('Could not load roles', e);
      }
    })();
    (async () => {
      try {
        const c = await api.get('/companies');
        const allCompanies = c.data || [];
        if (isSuperAdmin) {
          setCompanies(allCompanies);
          return;
        }

        const filtered = allCompanies.filter((company) => allowedCompanyIds.includes(Number(company.Company_Id)));
        setCompanies(filtered);

        if (selectedCompany !== 'all' && !filtered.some((company) => String(company.Company_Id) === String(selectedCompany))) {
          setSelectedCompany('all');
        }
      } catch (e) {
        console.warn('Could not load companies', e);
      }
    })();
  }, [selectedCompany, allowedCompanyIds, isSuperAdmin]);

  const refresh = async () => {
    setLoading(true);
    try {
      const url = selectedCompany === 'all' ? '/users' : `/users?company_id=${selectedCompany}`;
      const res = await api.get(url);
      setUsers(res.data || []);
    } catch (err) {
      console.error('Error refreshing users', err);
    } finally {
      setLoading(false);
    }
  };

  // Permissions UI and API calls removed for now per request

  const startEdit = (user) => {
    const copy = { ...user };
    copy.IsActive = !!copy.IsActive;
    setEditingUser(copy);
    setTab('gestor');
    setCreateMode(true);
  };

  const viewDetails = async (u) => {
    try {
      const res = await api.get(`/users/${u.User_Id}`);
      setViewingDetails(res.data);
    } catch (err) {
      console.error('Error cargando detalles del usuario', err);
      notify('Error cargando detalles del usuario', 'error');
    }
  };

  const cancelEdit = () => setEditingUser(null);

  const saveEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const payload = { ...editingUser, RolId: editingUser.RolId ? Number(editingUser.RolId) : null };
      await api.put(`/users/${editingUser.User_Id}`, payload);
      setEditingUser(null);
      await refresh();
      setNotice('Usuario guardado correctamente');
      notify('Usuario guardado correctamente', 'success');
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      console.error('Save user error', err);
      setNotice(err.response?.data?.msg || 'Error guardando usuario');
      notify(err.response?.data?.msg || 'Error guardando usuario', 'error');
      setTimeout(() => setNotice(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u.User_Id}/active`, { IsActive: u.IsActive ? 0 : 1 });
      await refresh();
    } catch (err) {
      console.error('Toggle active error', err);
      notify('Error cambiando estado', 'error');
    }
  };

  const removeUser = async (u) => {
    const ok = await confirm(`Eliminar permanentemente a ${u.Username}? Esta acción no se puede deshacer.`, "Eliminar usuario", "Eliminar", "Cancelar");
    if (!ok) return;
    try {
      await api.delete(`/users/${u.User_Id}`);
      await refresh();
    } catch (err) {
      console.error('Delete user error', err);
      notify('Error eliminando usuario', 'error');
    }
  };

  const title = 'Gestor de usuarios';

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 animate-in fade-in duration-700 overflow-auto">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">{title}</h2>

      <div className="mb-4">
          <nav className="flex gap-3">
          <button onClick={() => setTab('gestor')} className={`px-3 py-2 rounded-md ${tab === 'gestor' ? 'bg-[#092052] text-white' : 'bg-gray-200 text-gray-800'}`}>
            Gestor de usuarios
          </button>
        </nav>
      </div>

      {/* 'usuarios' tab removed - management happens in 'gestor' */}

      {tab === 'gestor' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold text-gray-900">Gestor de usuarios</h3>
              <p className="text-sm text-gray-600">Edita los datos del usuario, activa/desactiva o elimina permanentemente.</p>
            </div>
            <div>
              <button onClick={() => setCreateMode(true)} className="px-3 py-2 bg-green-600 text-white rounded">Crear usuario</button>
            </div>
          </div>

          {/* Moved users list here (previously under 'usuarios') */}
          {loading ? (
            <p className="text-gray-900">Cargando usuarios...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="flex items-center gap-2">
                  <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="p-2 rounded border bg-white text-gray-900 border-gray-300">
                    <option value="all">Todas las empresas</option>
                    {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                  </select>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, usuario o email" className="w-full max-w-md p-2 rounded border bg-white text-gray-900 border-gray-300 placeholder-gray-500" />
                </div>
                <div className="text-sm text-gray-600">{users.length} usuarios</div>
              </div>

              <div className="overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-sm text-gray-600">
                      <th className="py-2 pr-4">Nombre</th>
                      <th className="py-2 pr-4">Usuario</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Teléfono</th>
                      <th className="py-2 pr-4">Área</th>
                      <th className="py-2 pr-4">Rol</th>
                      <th className="py-2 pr-4">Estado</th>
                      <th className="py-2 pr-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => {
                      if (!query) return true;
                      const q = query.toLowerCase();
                      return (`${u.Name} ${u.Lastname}`.toLowerCase().includes(q) || (u.Username||'').toLowerCase().includes(q) || (u.Email||'').toLowerCase().includes(q));
                    }).map(u => (
                      <tr key={u.User_Id} className="border-t border-gray-200">
                        <td className="py-3 pr-4 text-gray-900">{u.Name} {u.Lastname}</td>
                        <td className="py-3 pr-4 text-gray-900">{u.Username}</td>
                        <td className="py-3 pr-4 text-gray-900">{u.Email}</td>
                        <td className="py-3 pr-4 text-gray-900">{u.PhoneNumber}</td>
                        <td className="py-3 pr-4 text-gray-900">{u.Area || '-'}</td>
                        <td className="py-3 pr-4 text-gray-900">{(roles.find(r => (r.Rol_Id ?? r.RolId ?? r.id) === u.RolId)?.Name) || u.RolId}</td>
                        <td className="py-3 pr-4">
                          {u.IsActive ? <span className="inline-block w-3 h-3 bg-green-500 rounded-full" title="Activo"></span> : <span className="inline-block w-3 h-3 bg-red-500 rounded-full" title="Inactivo"></span>}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => viewDetails(u)} className="px-3 py-1 text-sm bg-[#092052] hover:bg-[#0d3a7a] text-white rounded">Detalles</button>
                            <button onClick={() => startEdit(u)} className="px-3 py-1 text-sm bg-gray-600 text-white rounded">Editar</button>
                            <button onClick={() => { setSelectedUserForPermissions(u); setShowPermissions(true); }} className="px-3 py-1 text-sm bg-purple-600 text-white rounded">🔒 Permisos</button>
                            <button onClick={() => toggleActive(u)} className="px-3 py-1 text-sm bg-yellow-500 text-white rounded">{u.IsActive ? 'Desactivar' : 'Activar'}</button>
                            <button onClick={() => removeUser(u)} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && <p className="mt-4 text-sm text-gray-600">No hay usuarios registrados.</p>}
              </div>
            </div>
          )}

          {createMode && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="w-full max-w-3xl max-h-[95vh]">
                <UserCreate
                  editMode={!!editingUser}
                  initialData={editingUser}
                  allowedCompanyIds={allowedCompanyIds}
                  isSuperAdmin={isSuperAdmin}
                  onCreated={async () => {
                    setCreateMode(false);
                    setNewUser({ Name: '', Lastname: '', Username: '', Password: '', Email: '', PhoneNumber: '', Area: '', RolId: '', IsActive: true, CreatedBy: 1 });
                    setNotice('Nuevo usuario creado exitosamente'); notify('Nuevo usuario creado exitosamente', 'success'); setTimeout(() => setNotice(''), 3000); await refresh();
                  }}
                  onSaved={async () => {
                    setCreateMode(false);
                    setEditingUser(null);
                    setNotice('Usuario actualizado correctamente'); notify('Usuario actualizado correctamente', 'success'); setTimeout(() => setNotice(''), 3000); await refresh();
                  }}
                  onCancel={() => { setCreateMode(false); setEditingUser(null); }}
                />
              </div>
            </div>
          )}

          {/* Editing handled via the UserCreate modal (editMode) */}
          {!editingUser && <p className="text-sm text-gray-600">Selecciona "Editar" en la tabla para modificar un usuario.</p>}
        </div>
      )}

      {viewingDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-[#092052] px-6 py-4 flex items-center justify-between sticky top-0">
              <h2 className="text-xl font-bold text-white">Detalles del Usuario</h2>
              <button onClick={() => setViewingDetails(null)} className="text-white hover:bg-white/20 rounded-full p-2">
                <span className="text-2xl">×</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-100 rounded-xl p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Información Personal</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Nombre</p>
                    <p className="text-sm text-gray-900">{viewingDetails.Name} {viewingDetails.Lastname}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Usuario</p>
                    <p className="text-sm text-gray-900">{viewingDetails.Username}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Email</p>
                    <p className="text-sm text-gray-900">{viewingDetails.Email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Teléfono</p>
                    <p className="text-sm text-gray-900">{viewingDetails.PhoneNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Área</p>
                    <p className="text-sm text-gray-900">{viewingDetails.Area || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Rol</p>
                    <p className="text-sm text-gray-900">{(roles.find(r => (r.Rol_Id ?? r.RolId ?? r.id) === viewingDetails.RolId)?.Name) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Estado</p>
                    <p className="text-sm text-gray-900">{viewingDetails.IsActive ? 'Activo' : 'Inactivo'}</p>
                  </div>
                  {viewingDetails.companies && viewingDetails.companies.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-600 font-semibold">Empresas Asignadas</p>
                      <p className="text-sm text-gray-900">{viewingDetails.companies.map(c => c.NameCompany).join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions UI removed per request */}

      {showPermissions && selectedUserForPermissions && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <UserPermissions
            userId={selectedUserForPermissions.User_Id}
            userName={`${selectedUserForPermissions.Name} ${selectedUserForPermissions.Lastname} (${selectedUserForPermissions.Username})`}
            onClose={() => {
              setShowPermissions(false);
              setSelectedUserForPermissions(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
