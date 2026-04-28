import React, { useEffect, useMemo, useState } from 'react';
import { FaBuilding, FaEdit, FaEye, FaPlus, FaTrash, FaUserFriends } from 'react-icons/fa';
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
  operationTableShellClass
} from '../../components/operation/OperationUI';
import api from '../../services/api';
import confirm from '../../services/confirm';
import { notify } from '../../services/notify';

const defaultForm = { Company_Id: '', Nombre: '', Lider_Id: '', miembros: [] };

function MemberTag({ user }) {
  const fullName = `${user.Name || user.Nombre || ''} ${user.Lastname || ''}`.trim();
  return (
    <span className="inline-flex items-center rounded-full border border-[#dce4f0] bg-[#f8faff] px-2.5 py-1 text-[11px] font-semibold text-slate-600">
      {fullName || user.Username || 'Usuario'}
    </span>
  );
}

export default function EquiposVenta() {
  const [equipos, setEquipos] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEmpresa, setFiltroEmpresa] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editEquipo, setEditEquipo] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [detalle, setDetalle] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [eqRes, compRes, usrRes] = await Promise.all([
        api.get('/crm/equipos'),
        api.get('/companies/'),
        api.get('/users/')
      ]);
      setEquipos(Array.isArray(eqRes.data) ? eqRes.data : []);
      setCompanies(Array.isArray(compRes.data) ? compRes.data : (compRes.data?.data || []));
      setUsuarios(Array.isArray(usrRes.data) ? usrRes.data : (usrRes.data?.data || []));
    } catch {
      notify('Error cargando equipos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const lista = useMemo(
    () => equipos.filter((equipo) => filtroEmpresa === 'all' || String(equipo.Company_Id) === filtroEmpresa),
    [equipos, filtroEmpresa]
  );

  const totalMiembros = useMemo(
    () => lista.reduce((sum, equipo) => sum + Number(equipo.TotalMiembros || 0), 0),
    [lista]
  );

  const totalLideres = useMemo(
    () => lista.filter((equipo) => Boolean(equipo.Lider_Id || equipo.LiderNombre)).length,
    [lista]
  );

  const openNuevo = () => {
    setEditEquipo(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEditar = async (equipo) => {
    try {
      const res = await api.get(`/crm/equipos/${equipo.Equipo_Id}`);
      const data = res.data;
      setEditEquipo(data);
      setForm({
        Company_Id: String(data.Company_Id || ''),
        Nombre: data.Nombre || '',
        Lider_Id: data.Lider_Id ? String(data.Lider_Id) : '',
        miembros: (data.miembros || []).map((miembro) => miembro.User_Id)
      });
      setShowForm(true);
    } catch {
      notify('Error cargando equipo', 'error');
    }
  };

  const toggleMiembro = (userId) => {
    setForm((prev) => ({
      ...prev,
      miembros: prev.miembros.includes(userId)
        ? prev.miembros.filter((memberId) => memberId !== userId)
        : [...prev.miembros, userId]
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.Nombre.trim()) {
      notify('El nombre es requerido', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        Company_Id: Number.parseInt(form.Company_Id, 10),
        Lider_Id: form.Lider_Id ? Number.parseInt(form.Lider_Id, 10) : null
      };
      if (editEquipo) {
        await api.put(`/crm/equipos/${editEquipo.Equipo_Id}`, { ...payload, Activo: true });
        notify('Equipo actualizado', 'success');
      } else {
        await api.post('/crm/equipos', payload);
        notify('Equipo creado', 'success');
      }
      setShowForm(false);
      fetchAll();
    } catch (error) {
      notify(error?.response?.data?.detail || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (equipo) => {
    const ok = await confirm(`Eliminar el equipo "${equipo.Nombre}"? Se desvinculara de los leads.`);
    if (!ok) return;
    try {
      await api.delete(`/crm/equipos/${equipo.Equipo_Id}`);
      notify('Equipo eliminado', 'success');
      fetchAll();
    } catch (error) {
      notify(error?.response?.data?.detail || 'Error al eliminar', 'error');
    }
  };

  const verDetalle = async (equipo) => {
    try {
      const res = await api.get(`/crm/equipos/${equipo.Equipo_Id}`);
      setDetalle(res.data);
    } catch {
      notify('Error cargando detalle', 'error');
    }
  };

  const usuariosEmpresa = form.Company_Id
    ? usuarios.filter((user) => !user.companies || user.companies?.includes(Number.parseInt(form.Company_Id, 10)))
    : usuarios;

  return (
    <div className={operationPageClass}>
      <div className={operationContainerClass}>
        <OperationHeader
          eyebrow="CRM"
          title="Equipos de Venta"
          description="Organiza lideres comerciales, integrantes y empresas para distribuir leads con una vista clara aunque todavia no existan registros."
          actions={(
            <button onClick={openNuevo} className={operationPrimaryButtonClass}>
              <FaPlus className="text-xs" /> Nuevo equipo
            </button>
          )}
          stats={[
            <OperationStat key="equipos" label="Equipos" value={lista.length} tone="blue" />,
            <OperationStat key="miembros" label="Miembros" value={totalMiembros} tone="emerald" />,
            <OperationStat key="lideres" label="Lideres" value={totalLideres} tone="amber" />,
            <OperationStat key="empresas" label="Empresas" value={companies.length} tone="slate" />
          ]}
        />

        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
          <OperationSectionTitle
            eyebrow="Filtro"
            title="Explorar equipos"
            description="Filtra por empresa para revisar estructura comercial, lider asignado y numero de integrantes."
          />
          <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresa</label>
              <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)} className={operationFieldClass}>
                <option value="all">Todas las empresas</option>
                {companies.map((company) => (
                  <option key={company.Company_Id} value={String(company.Company_Id)}>{company.NameCompany}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Con lider</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{totalLideres}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Promedio miembros</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {lista.length ? (totalMiembros / lista.length).toFixed(1) : '0.0'}
                </p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Vista activa</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {filtroEmpresa === 'all'
                    ? 'Todas las empresas'
                    : companies.find((company) => String(company.Company_Id) === filtroEmpresa)?.NameCompany || 'Empresa'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={operationTableShellClass}>
          <div className="border-b border-[#e7edf6] px-6 py-4">
            <OperationSectionTitle
              eyebrow="Catalogo"
              title="Estructura comercial"
              description="Cada tarjeta resume la empresa, el lider comercial y el tamano del equipo."
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86]" />
            </div>
          ) : lista.length === 0 ? (
            <div className="p-6">
              <OperationEmptyState
                title="Sin equipos configurados"
                description="Crea tu primer equipo comercial para asignar lideres, miembros y despues conectar leads u oportunidades."
              />
            </div>
          ) : (
            <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
              {lista.map((equipo) => (
                <article key={equipo.Equipo_Id} className="rounded-[24px] border border-[#dce4f0] bg-white/95 p-5 shadow-[0_12px_24px_rgba(15,45,93,0.06)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-slate-900">{equipo.Nombre}</p>
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#f4f7ff] px-3 py-1 text-xs font-semibold text-[#1b3d86]">
                        <FaBuilding className="text-[10px]" />
                        <span className="truncate">{equipo.NameCompany || 'Empresa sin nombre'}</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-[#dce4f0] bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                      {equipo.TotalMiembros || 0} miembro{Number(equipo.TotalMiembros || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-[18px] border border-[#edf2f8] bg-[#f8fbff] p-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Lider</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{equipo.LiderNombre || 'Sin lider asignado'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Estado comercial</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {equipo.TotalMiembros ? 'Listo para asignacion de leads' : 'Necesita al menos un miembro'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => verDetalle(equipo)} className={operationSecondaryButtonClass}>
                      <FaEye className="text-xs" /> Ver
                    </button>
                    <button onClick={() => openEditar(equipo)} className={operationSecondaryButtonClass}>
                      <FaEdit className="text-xs" /> Editar
                    </button>
                    <button onClick={() => handleEliminar(equipo)} className={operationDangerButtonClass}>
                      <FaTrash className="text-xs" /> Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editEquipo ? 'Editar equipo de venta' : 'Nuevo equipo de venta'} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editEquipo && (
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresa</label>
                <select
                  value={form.Company_Id}
                  onChange={(e) => setForm((prev) => ({ ...prev, Company_Id: e.target.value, miembros: [] }))}
                  required
                  className={operationFieldClass}
                >
                  <option value="">Seleccionar...</option>
                  {companies.map((company) => (
                    <option key={company.Company_Id} value={company.Company_Id}>{company.NameCompany}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Nombre del equipo</label>
              <input
                value={form.Nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, Nombre: e.target.value }))}
                required
                className={operationFieldClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Lider del equipo</label>
              <select
                value={form.Lider_Id}
                onChange={(e) => setForm((prev) => ({ ...prev, Lider_Id: e.target.value }))}
                className={operationFieldClass}
              >
                <option value="">Sin lider</option>
                {usuariosEmpresa.map((user) => (
                  <option key={user.User_Id} value={user.User_Id}>
                    {user.Name} {user.Lastname} ({user.Username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Miembros</label>
                <span className="text-xs font-semibold text-slate-400">{form.miembros.length} seleccionados</span>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-[18px] border border-[#dce4f0] bg-[#f8fbff] p-3">
                {usuariosEmpresa.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin usuarios disponibles</p>
                ) : usuariosEmpresa.map((user) => (
                  <label key={user.User_Id} className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-white/90 bg-white px-3 py-2.5 shadow-[0_4px_10px_rgba(15,45,93,0.04)]">
                    <input
                      type="checkbox"
                      checked={form.miembros.includes(user.User_Id)}
                      onChange={() => toggleMiembro(user.User_Id)}
                      className="h-4 w-4 rounded accent-[#1b3d86]"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{user.Name} {user.Lastname}</p>
                      <p className="truncate text-xs text-slate-400">{user.Username}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className={operationSecondaryButtonClass}>Cancelar</button>
              <button type="submit" disabled={saving} className={operationPrimaryButtonClass}>
                {saving ? 'Guardando...' : editEquipo ? 'Actualizar equipo' : 'Crear equipo'}
              </button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={Boolean(detalle)} onClose={() => setDetalle(null)} title={detalle?.Nombre || 'Detalle del equipo'} size="lg">
          {detalle && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-[18px] border border-[#eaf0fa] bg-[#f8fbff] p-4 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Empresa</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{detalle.NameCompany}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Lider</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{detalle.LiderNombre || 'Sin lider'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Miembros</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{(detalle.miembros || []).length}</p>
                </div>
              </div>

              {(detalle.miembros || []).length === 0 ? (
                <OperationEmptyState
                  title="Sin miembros asignados"
                  description="Agrega integrantes al equipo para repartir oportunidades y ownership comercial."
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FaUserFriends className="text-[#1b3d86]" />
                    <p className="text-sm font-semibold text-slate-800">Integrantes del equipo</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detalle.miembros.map((member) => (
                      <MemberTag key={member.User_Id} user={member} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
