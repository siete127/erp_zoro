import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';
import UserCreate from './UserCreate';
import UserPermissions from '../../components/UserPermissions';
import { getUserCompanies, getUserRole } from '../../utils/tokenHelper';

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [viewingDetails, setViewingDetails] = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [createMode, setCreateMode] = useState(false);
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
        const url = selectedCompany === 'all' ? '/users/' : `/users/?company_id=${selectedCompany}`;
        const res = await api.get(url);
        setUsers(res.data || []);
      } catch (err) {
        setError('Error cargando usuarios');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
    (async () => {
      try {
        const r = await api.get('/roles/');
        setRoles(r.data || []);
      } catch {}
    })();
    (async () => {
      try {
        const c = await api.get('/companies/');
        const allCompanies = c.data || [];
        if (isSuperAdmin) { setCompanies(allCompanies); return; }
        const filtered = allCompanies.filter((company) => allowedCompanyIds.includes(Number(company.Company_Id)));
        setCompanies(filtered);
        if (selectedCompany !== 'all' && !filtered.some((company) => String(company.Company_Id) === String(selectedCompany))) {
          setSelectedCompany('all');
        }
      } catch {}
    })();
  }, [selectedCompany, allowedCompanyIds, isSuperAdmin]);

  const refresh = async () => {
    setLoading(true);
    try {
      const url = selectedCompany === 'all' ? '/users/' : `/users/?company_id=${selectedCompany}`;
      const res = await api.get(url);
      setUsers(res.data || []);
    } catch {} finally { setLoading(false); }
  };

  const startEdit = (user) => {
    const copy = { ...user };
    copy.IsActive = !!copy.IsActive;
    setEditingUser(copy);
    setCreateMode(true);
  };

  const viewDetails = async (u) => {
    try {
      const res = await api.get(`/users/${u.User_Id}`);
      setViewingDetails(res.data);
    } catch {
      notify('Error cargando detalles del usuario', 'error');
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u.User_Id}/active`, { IsActive: u.IsActive ? 0 : 1 });
      await refresh();
    } catch {
      notify('Error cambiando estado', 'error');
    }
  };

  const removeUser = async (u) => {
    const ok = await confirm(`Eliminar permanentemente a ${u.Username}? Esta acción no se puede deshacer.`, "Eliminar usuario", "Eliminar", "Cancelar");
    if (!ok) return;
    try {
      await api.delete(`/users/${u.User_Id}`);
      await refresh();
    } catch {
      notify('Error eliminando usuario', 'error');
    }
  };

  const getRoleName = (rolId) =>
    (roles.find(r => (r.Rol_Id ?? r.RolId ?? r.id) === rolId)?.Name) || rolId;

  const filteredUsers = users.filter(u => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (`${u.Name} ${u.Lastname}`.toLowerCase().includes(q) ||
      (u.Username || '').toLowerCase().includes(q) ||
      (u.Email || '').toLowerCase().includes(q));
  });

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Administración</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Gestor de Usuarios</h1>
            <p className="text-sm text-slate-500">Edita datos, activa/desactiva o gestiona permisos de usuarios.</p>
          </div>
          <button
            onClick={() => { setEditingUser(null); setCreateMode(true); }}
            className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition"
          >
            + Crear usuario
          </button>
        </div>

        {notice && (
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {/* Filters */}
        <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] px-5 py-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
          <div className="flex flex-wrap items-end gap-3">
            {companies.length > 1 && (
              <div className="flex-1 min-w-[180px]">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresa</label>
                <select className={premiumField} value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}>
                  {isSuperAdmin && <option value="all">Todas las empresas</option>}
                  {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                </select>
              </div>
            )}
            {companies.length === 1 && (
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresa</label>
                <span className="inline-flex items-center rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-700">
                  {companies[0].NameCompany}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-[240px]">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Buscar</label>
              <input
                className={premiumField}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre, usuario o email..."
              />
            </div>
            <div className="text-sm text-slate-400 pb-2.5">
              {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : error ? (
            <p className="px-6 py-12 text-center text-sm text-rose-500">{error}</p>
          ) : filteredUsers.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">No hay usuarios registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["Nombre", "Usuario", "Email", "Área", "Rol", "Estado", "Acciones"].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.User_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="px-4 py-3 pl-6 text-sm font-semibold text-slate-800">{u.Name} {u.Lastname}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{u.Username}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{u.Email}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{u.Area || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{getRoleName(u.RolId)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          u.IsActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}>
                          {u.IsActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 pr-6">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => viewDetails(u)}
                            className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2.5 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition"
                          >
                            Detalles
                          </button>
                          <button
                            onClick={() => startEdit(u)}
                            className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2.5 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => { setSelectedUserForPermissions(u); setShowPermissions(true); }}
                            className="rounded-[9px] border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition"
                          >
                            🔒 Permisos
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            className={`rounded-[9px] border px-2.5 py-1.5 text-xs font-semibold transition ${
                              u.IsActive
                                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {u.IsActive ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            onClick={() => removeUser(u)}
                            className="rounded-[9px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
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
          )}
        </div>

      </div>

      {/* Create/Edit Modal */}
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
                setNotice('Nuevo usuario creado exitosamente');
                notify('Nuevo usuario creado exitosamente', 'success');
                setTimeout(() => setNotice(''), 3000);
                await refresh();
              }}
              onSaved={async () => {
                setCreateMode(false);
                setEditingUser(null);
                setNotice('Usuario actualizado correctamente');
                notify('Usuario actualizado correctamente', 'success');
                setTimeout(() => setNotice(''), 3000);
                await refresh();
              }}
              onCancel={() => { setCreateMode(false); setEditingUser(null); }}
            />
          </div>
        </div>
      )}

      {/* Details Modal */}
      {viewingDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between sticky top-0">
              <h2 className="text-base font-bold text-white">Detalles del Usuario</h2>
              <button onClick={() => setViewingDetails(null)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white p-6 space-y-4">
              <div className="rounded-[16px] border border-[#eaf0fa] bg-[#f8faff] p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Información Personal</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ["Nombre", `${viewingDetails.Name} ${viewingDetails.Lastname}`],
                    ["Usuario", viewingDetails.Username],
                    ["Email", viewingDetails.Email || '—'],
                    ["Teléfono", viewingDetails.PhoneNumber || '—'],
                    ["Área", viewingDetails.Area || '—'],
                    ["Rol", getRoleName(viewingDetails.RolId)],
                    ["Estado", viewingDetails.IsActive ? 'Activo' : 'Inactivo'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">{label}</p>
                      <p className="mt-0.5 text-sm text-slate-800">{value}</p>
                    </div>
                  ))}
                  {viewingDetails.companies && viewingDetails.companies.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresas Asignadas</p>
                      <p className="mt-0.5 text-sm text-slate-800">{viewingDetails.companies.map(c => c.NameCompany).join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setViewingDetails(null)}
                  className="rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
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
