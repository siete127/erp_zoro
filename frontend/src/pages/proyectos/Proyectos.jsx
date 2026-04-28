import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import confirm from '../../services/confirm';
import { notify } from '../../services/notify';

const STATUS_OPTIONS = ['ACTIVO', 'PAUSADO', 'CERRADO', 'CANCELADO'];
const STATUS_STYLES = {
  ACTIVO:    'border-emerald-200 bg-emerald-50 text-emerald-700',
  PAUSADO:   'border-amber-200 bg-amber-50 text-amber-700',
  CERRADO:   'border-slate-200 bg-slate-50 text-slate-600',
  CANCELADO: 'border-rose-200 bg-rose-50 text-rose-700',
};

const emptyForm = {
  Company_Id: '',
  Nombre: '',
  Client_Id: '',
  Responsable_Id: '',
  FechaInicio: '',
  FechaFin: '',
  PresupuestoHoras: '',
  PresupuestoCosto: '',
  Status: 'ACTIVO',
  Descripcion: '',
};

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

function toCurrency(value) {
  return Number(value || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
}

function toHours(value) {
  return `${Number(value || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} h`;
}

function toPercent(value) {
  return `${Number(value || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function clientLabel(client) {
  return client?.CommercialName || client?.LegalName || `Cliente ${client?.Client_Id}`;
}

export default function Proyectos() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadMeta(); }, []);

  useEffect(() => {
    if (selectedCompany) loadProjects(selectedCompany, selectedStatus);
  }, [selectedCompany, selectedStatus]);

  async function loadMeta() {
    try {
      const [companyRes, clientRes, userRes] = await Promise.all([
        api.get('/companies/'),
        api.get('/clients/'),
        api.get('/users/'),
      ]);
      const companyList = Array.isArray(companyRes.data) ? companyRes.data : (companyRes.data?.data || []);
      const clientList = Array.isArray(clientRes.data) ? clientRes.data : (clientRes.data?.data || []);
      const userList = Array.isArray(userRes.data) ? userRes.data : (userRes.data?.data || []);
      const userLocal = JSON.parse(localStorage.getItem('user') || '{}');
      const defaultCompany = String(
        userLocal?.Company_Id || userLocal?.companies?.[0] || companyList[0]?.Company_Id || ''
      );
      setCompanies(companyList);
      setClients(clientList.filter((item) => String(item?.ClientType || '').toUpperCase() !== 'PROVEEDOR'));
      setUsers(userList);
      setSelectedCompany((prev) => prev || defaultCompany);
      setForm((prev) => ({ ...prev, Company_Id: prev.Company_Id || defaultCompany }));
    } catch {
      notify.error('No fue posible cargar los catálogos de proyectos');
    }
  }

  async function loadProjects(companyId = selectedCompany, status = selectedStatus) {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('company_id', companyId);
      if (status) params.set('status', status);
      const response = await api.get(`/proyectos/?${params.toString()}`);
      setProjects(Array.isArray(response.data) ? response.data : []);
    } catch {
      notify.error('Error cargando proyectos');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingProject(null);
    setForm({ ...emptyForm, Company_Id: selectedCompany || companies[0]?.Company_Id || '' });
    setShowForm(true);
  }

  function openEdit(project) {
    setEditingProject(project);
    setForm({
      Company_Id: String(project.Company_Id || ''),
      Nombre: project.Nombre || '',
      Client_Id: project.Client_Id ? String(project.Client_Id) : '',
      Responsable_Id: project.Responsable_Id ? String(project.Responsable_Id) : '',
      FechaInicio: project.FechaInicio ? String(project.FechaInicio).slice(0, 10) : '',
      FechaFin: project.FechaFin ? String(project.FechaFin).slice(0, 10) : '',
      PresupuestoHoras: project.PresupuestoHoras ?? '',
      PresupuestoCosto: project.PresupuestoCosto ?? '',
      Status: project.Status || 'ACTIVO',
      Descripcion: project.Descripcion || '',
    });
    setShowForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.Company_Id || !form.Nombre.trim()) {
      notify.error('Empresa y nombre son requeridos');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        Company_Id: Number(form.Company_Id),
        Nombre: form.Nombre.trim(),
        Client_Id: form.Client_Id ? Number(form.Client_Id) : null,
        Responsable_Id: form.Responsable_Id ? Number(form.Responsable_Id) : null,
        FechaInicio: form.FechaInicio || null,
        FechaFin: form.FechaFin || null,
        PresupuestoHoras: form.PresupuestoHoras !== '' ? Number(form.PresupuestoHoras) : null,
        PresupuestoCosto: form.PresupuestoCosto !== '' ? Number(form.PresupuestoCosto) : null,
        Status: form.Status,
        Descripcion: form.Descripcion || null,
      };
      if (editingProject) {
        await api.put(`/proyectos/${editingProject.Proyecto_Id}`, payload);
        notify.success('Proyecto actualizado');
      } else {
        await api.post('/proyectos/', payload);
        notify.success('Proyecto creado');
      }
      setShowForm(false);
      setEditingProject(null);
      setForm(emptyForm);
      await loadProjects(payload.Company_Id, selectedStatus);
    } catch (error) {
      notify.error(error?.response?.data?.detail || 'No fue posible guardar el proyecto');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(project) {
    const ok = await confirm(
      `¿Eliminar o cancelar ${project.Nombre || 'este proyecto'}?`,
      'Proyecto', 'Continuar', 'Cancelar'
    );
    if (!ok) return;
    try {
      const response = await api.delete(`/proyectos/${project.Proyecto_Id}`);
      notify.success(response.data?.message || 'Proyecto actualizado');
      await loadProjects();
    } catch (error) {
      notify.error(error?.response?.data?.detail || 'No fue posible eliminar el proyecto');
    }
  }

  const filteredProjects = projects.filter((project) => {
    if (!search.trim()) return true;
    const haystack = [
      project.Nombre, project.ClienteNombre, project.ResponsableNombre,
      project.NameCompany, project.Status,
    ].join(' ').toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const totalHoras = filteredProjects.reduce((sum, item) => sum + Number(item.HorasReales || 0), 0);
  const totalCosto = filteredProjects.reduce((sum, item) => sum + Number(item.CostoReal || 0), 0);
  const activos = filteredProjects.filter((item) => item.Status === 'ACTIVO').length;

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Gestión</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Proyectos</h1>
            <p className="text-sm text-slate-500">Presupuesto, avance, tareas vinculadas y captura de horas.</p>
          </div>
          <button
            onClick={openCreate}
            className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition"
          >
            + Nuevo proyecto
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Proyectos", value: filteredProjects.length, color: "text-slate-800", bg: "border-slate-200 bg-slate-50" },
            { title: "Activos", value: activos, color: "text-emerald-700", bg: "border-emerald-200 bg-emerald-50" },
            { title: "Horas reales", value: toHours(totalHoras), color: "text-sky-700", bg: "border-sky-200 bg-sky-50" },
            { title: "Costo real", value: toCurrency(totalCosto), color: "text-violet-700", bg: "border-violet-200 bg-violet-50" },
          ].map(({ title, value, color, bg }) => (
            <div key={title} className={`rounded-[20px] border p-5 shadow-[0_4px_20px_rgba(15,45,93,0.06)] ${bg}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">{title}</p>
              <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] px-5 py-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresa</label>
              <select className={premiumField} value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}>
                <option value="">Seleccionar...</option>
                {companies.map((company) => (
                  <option key={company.Company_Id} value={company.Company_Id}>{company.NameCompany}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Estatus</label>
              <select className={premiumField} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Buscar</label>
              <input
                className={premiumField}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre del proyecto, cliente o responsable"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">No hay proyectos para los filtros seleccionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["Proyecto", "Cliente", "Responsable", "Estatus", "Horas", "Costo", "Avance", "Acciones"].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => (
                    <tr key={project.Proyecto_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="px-4 py-3 pl-6">
                        <div className="font-semibold text-sm text-slate-800">{project.Nombre}</div>
                        <div className="text-xs text-slate-400">{project.NameCompany}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{project.ClienteNombre || 'Sin cliente'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{project.ResponsableNombre || 'Sin responsable'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[project.Status] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                          {project.Status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm text-slate-700">{toHours(project.HorasReales)}</div>
                        <div className="text-xs text-slate-400">/ {toHours(project.PresupuestoHoras)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm text-slate-700">{toCurrency(project.CostoReal)}</div>
                        <div className="text-xs text-slate-400">/ {toCurrency(project.PresupuestoCosto)}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{toPercent(project.AvancePct)}</td>
                      <td className="px-4 py-3 pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/proyectos/${project.Proyecto_Id}`)}
                            className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition"
                          >
                            Ver detalle
                          </button>
                          <button
                            onClick={() => openEdit(project)}
                            className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(project)}
                            className="rounded-[9px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                          >
                            Quitar
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

      {/* Modal Proyecto */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingProject ? 'Editar proyecto' : 'Nuevo proyecto'}
                </h3>
                <p className="text-xs text-white/70">Configura presupuesto, responsable y ventana de ejecución.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-white/70 hover:text-white text-xl leading-none">{"\u00d7"}</button>
            </div>
            <div className="bg-white p-6">
              <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                <Field label="Empresa">
                  <select className={premiumField} value={form.Company_Id} onChange={(e) => setForm(p => ({ ...p, Company_Id: e.target.value }))} required>
                    <option value="">Seleccionar...</option>
                    {companies.map((c) => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                  </select>
                </Field>
                <Field label="Estatus">
                  <select className={premiumField} value={form.Status} onChange={(e) => setForm(p => ({ ...p, Status: e.target.value }))}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Nombre" span>
                  <input className={premiumField} value={form.Nombre} onChange={(e) => setForm(p => ({ ...p, Nombre: e.target.value }))} required />
                </Field>
                <Field label="Cliente">
                  <select className={premiumField} value={form.Client_Id} onChange={(e) => setForm(p => ({ ...p, Client_Id: e.target.value }))}>
                    <option value="">Sin cliente</option>
                    {clients.map((c) => <option key={c.Client_Id} value={c.Client_Id}>{clientLabel(c)}</option>)}
                  </select>
                </Field>
                <Field label="Responsable">
                  <select className={premiumField} value={form.Responsable_Id} onChange={(e) => setForm(p => ({ ...p, Responsable_Id: e.target.value }))}>
                    <option value="">Sin responsable</option>
                    {users.map((u) => (
                      <option key={u.User_Id} value={u.User_Id}>
                        {`${u.Name || ''} ${u.Lastname || ''}`.trim() || u.Username}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Fecha inicio">
                  <input type="date" className={premiumField} value={form.FechaInicio} onChange={(e) => setForm(p => ({ ...p, FechaInicio: e.target.value }))} />
                </Field>
                <Field label="Fecha fin">
                  <input type="date" className={premiumField} value={form.FechaFin} onChange={(e) => setForm(p => ({ ...p, FechaFin: e.target.value }))} />
                </Field>
                <Field label="Presupuesto horas">
                  <input type="number" min="0" step="0.01" className={premiumField} value={form.PresupuestoHoras} onChange={(e) => setForm(p => ({ ...p, PresupuestoHoras: e.target.value }))} />
                </Field>
                <Field label="Presupuesto costo">
                  <input type="number" min="0" step="0.01" className={premiumField} value={form.PresupuestoCosto} onChange={(e) => setForm(p => ({ ...p, PresupuestoCosto: e.target.value }))} />
                </Field>
                <Field label="Descripción" span>
                  <textarea rows={3} className={`${premiumField} resize-none`} value={form.Descripcion} onChange={(e) => setForm(p => ({ ...p, Descripcion: e.target.value }))} />
                </Field>
                <div className="md:col-span-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition"
                  >
                    {saving ? 'Guardando...' : (editingProject ? 'Guardar cambios' : 'Crear proyecto')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, span = false }) {
  return (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">{label}</label>
      {children}
    </div>
  );
}
