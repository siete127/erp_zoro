import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api';
import confirm from '../../services/confirm';
import { notify } from '../../services/notify';

const TASK_PRIORITIES = ['baja', 'media', 'alta', 'urgente'];
const TASK_STATES = ['pendiente', 'en_proceso', 'completada', 'cancelada'];

const STATUS_BADGE = {
  ACTIVO:    'border-emerald-200 bg-emerald-50 text-emerald-700',
  PAUSADO:   'border-amber-200 bg-amber-50 text-amber-700',
  CERRADO:   'border-slate-200 bg-slate-50 text-slate-600',
  CANCELADO: 'border-rose-200 bg-rose-50 text-rose-700',
  pendiente:  'border-amber-200 bg-amber-50 text-amber-700',
  en_proceso: 'border-sky-200 bg-sky-50 text-sky-700',
  completada: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelada:  'border-rose-200 bg-rose-50 text-rose-700',
};

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

function toCurrency(value) {
  return Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

function toHours(value) {
  return `${Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
}

function toDate(value) {
  return value ? new Date(String(value).slice(0, 10)).toLocaleDateString('es-MX') : '—';
}

function Field({ label, children, span = false }) {
  return (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">{label}</label>
      {children}
    </div>
  );
}

function TaskModal({ project, users, task, onClose, onSaved }) {
  const [form, setForm] = useState({
    Titulo: task?.Titulo || '',
    Descripcion: task?.Descripcion || '',
    AsignadoA: task?.AsignadoA ? String(task.AsignadoA) : '',
    FechaLimite: task?.FechaLimite ? String(task.FechaLimite).slice(0, 10) : '',
    Prioridad: task?.Prioridad || 'media',
    Estado: task?.Estado || 'pendiente',
    HorasEstimadas: task?.HorasEstimadas ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.Titulo.trim()) { notify.error('El título es requerido'); return; }
    setSaving(true);
    try {
      const payload = {
        Company_Id: Number(project.Company_Id),
        Proyecto_Id: Number(project.Proyecto_Id),
        Titulo: form.Titulo.trim(),
        Descripcion: form.Descripcion || null,
        AsignadoA: form.AsignadoA ? Number(form.AsignadoA) : null,
        FechaLimite: form.FechaLimite || null,
        Prioridad: form.Prioridad,
        Estado: form.Estado,
        HorasEstimadas: form.HorasEstimadas !== '' ? Number(form.HorasEstimadas) : null,
      };
      if (task) {
        await api.put(`/tareas/${task.Tarea_Id}`, payload);
        notify.success('Tarea actualizada');
      } else {
        await api.post('/tareas/', payload);
        notify.success('Tarea creada');
      }
      onSaved();
    } catch (error) {
      notify.error(error?.response?.data?.detail || 'No fue posible guardar la tarea');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
        <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">{task ? 'Editar tarea' : 'Nueva tarea'}</h3>
            <p className="text-xs text-white/70">Vinculada al proyecto actual.</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="bg-white p-6">
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <Field label="Título" span>
              <input className={premiumField} value={form.Titulo} onChange={(e) => setForm(p => ({ ...p, Titulo: e.target.value }))} required />
            </Field>
            <Field label="Descripción" span>
              <textarea rows={3} className={`${premiumField} resize-none`} value={form.Descripcion} onChange={(e) => setForm(p => ({ ...p, Descripcion: e.target.value }))} />
            </Field>
            <Field label="Asignado a">
              <select className={premiumField} value={form.AsignadoA} onChange={(e) => setForm(p => ({ ...p, AsignadoA: e.target.value }))}>
                <option value="">Sin asignar</option>
                {users.map((u) => <option key={u.User_Id} value={u.User_Id}>{`${u.Name || ''} ${u.Lastname || ''}`.trim() || u.Username}</option>)}
              </select>
            </Field>
            <Field label="Fecha límite">
              <input type="date" className={premiumField} value={form.FechaLimite} onChange={(e) => setForm(p => ({ ...p, FechaLimite: e.target.value }))} />
            </Field>
            <Field label="Prioridad">
              <select className={premiumField} value={form.Prioridad} onChange={(e) => setForm(p => ({ ...p, Prioridad: e.target.value }))}>
                {TASK_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select className={premiumField} value={form.Estado} onChange={(e) => setForm(p => ({ ...p, Estado: e.target.value }))}>
                {TASK_STATES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Horas estimadas">
              <input type="number" min="0" step="0.01" className={premiumField} value={form.HorasEstimadas} onChange={(e) => setForm(p => ({ ...p, HorasEstimadas: e.target.value }))} />
            </Field>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" disabled={saving} className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition">
                {saving ? 'Guardando...' : 'Guardar tarea'}
              </button>
              <button type="button" onClick={onClose} className="flex-1 rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function TimesheetModal({ project, tasks, users, entry, onClose, onSaved }) {
  const currentUserId = Number(localStorage.getItem('userId') || 0);
  const [form, setForm] = useState({
    User_Id: entry?.User_Id ? String(entry.User_Id) : String(currentUserId || ''),
    Tarea_Id: entry?.Tarea_Id ? String(entry.Tarea_Id) : '',
    Fecha: entry?.Fecha ? String(entry.Fecha).slice(0, 10) : new Date().toISOString().slice(0, 10),
    HorasRegistradas: entry?.HorasRegistradas ?? '',
    Descripcion: entry?.Descripcion || '',
    Facturable: entry ? Boolean(entry.Facturable) : true,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.User_Id || !form.Fecha || !form.HorasRegistradas) {
      notify.error('Usuario, fecha y horas son requeridos'); return;
    }
    setSaving(true);
    try {
      const payload = {
        User_Id: Number(form.User_Id),
        Proyecto_Id: Number(project.Proyecto_Id),
        Tarea_Id: form.Tarea_Id ? Number(form.Tarea_Id) : null,
        Fecha: form.Fecha,
        HorasRegistradas: Number(form.HorasRegistradas),
        Descripcion: form.Descripcion || null,
        Facturable: Boolean(form.Facturable),
      };
      if (entry) {
        await api.put(`/timesheets/${entry.Timesheet_Id}`, payload);
        notify.success('Horas actualizadas');
      } else {
        await api.post('/timesheets/', payload);
        notify.success('Horas registradas');
      }
      onSaved();
    } catch (error) {
      notify.error(error?.response?.data?.detail || 'No fue posible guardar el registro de horas');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
        <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">{entry ? 'Editar horas' : 'Registrar horas'}</h3>
            <p className="text-xs text-white/70">Costo calculado con salario mensual referencial del perfil RH.</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="bg-white p-6">
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <Field label="Usuario">
              <select className={premiumField} value={form.User_Id} onChange={(e) => setForm(p => ({ ...p, User_Id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {users.map((u) => <option key={u.User_Id} value={u.User_Id}>{`${u.Name || ''} ${u.Lastname || ''}`.trim() || u.Username}</option>)}
              </select>
            </Field>
            <Field label="Tarea">
              <select className={premiumField} value={form.Tarea_Id} onChange={(e) => setForm(p => ({ ...p, Tarea_Id: e.target.value }))}>
                <option value="">Sin tarea específica</option>
                {tasks.map((t) => <option key={t.Tarea_Id} value={t.Tarea_Id}>{t.Titulo}</option>)}
              </select>
            </Field>
            <Field label="Fecha">
              <input type="date" className={premiumField} value={form.Fecha} onChange={(e) => setForm(p => ({ ...p, Fecha: e.target.value }))} />
            </Field>
            <Field label="Horas registradas">
              <input type="number" min="0.25" step="0.25" className={premiumField} value={form.HorasRegistradas} onChange={(e) => setForm(p => ({ ...p, HorasRegistradas: e.target.value }))} />
            </Field>
            <Field label="Descripción" span>
              <textarea rows={3} className={`${premiumField} resize-none`} value={form.Descripcion} onChange={(e) => setForm(p => ({ ...p, Descripcion: e.target.value }))} />
            </Field>
            <div className="md:col-span-2 flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.Facturable} onChange={(e) => setForm(p => ({ ...p, Facturable: e.target.checked }))} />
                Facturable
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition">
                  {saving ? 'Guardando...' : 'Guardar horas'}
                </button>
                <button type="button" onClick={onClose} className="rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function DetalleProyecto() {
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskModal, setTaskModal] = useState(null);
  const [timesheetModal, setTimesheetModal] = useState(null);

  useEffect(() => { loadEverything(); }, [id]);

  async function loadEverything() {
    setLoading(true);
    try {
      const [detailRes, userRes] = await Promise.all([
        api.get(`/proyectos/${id}`),
        api.get('/users/'),
      ]);
      setDetail(detailRes.data);
      setUsers(Array.isArray(userRes.data) ? userRes.data : (userRes.data?.data || []));
    } catch {
      notify.error('No fue posible cargar el detalle del proyecto');
    } finally { setLoading(false); }
  }

  async function deleteTask(task) {
    const ok = await confirm(`¿Eliminar la tarea "${task.Titulo}"?`, 'Tarea', 'Eliminar', 'Cancelar');
    if (!ok) return;
    try {
      await api.delete(`/tareas/${task.Tarea_Id}`);
      notify.success('Tarea eliminada');
      await loadEverything();
    } catch (error) {
      notify.error(error?.response?.data?.detail || 'No fue posible eliminar la tarea');
    }
  }

  async function deleteTimesheet(entry) {
    const ok = await confirm('¿Eliminar este registro de horas?', 'Horas', 'Eliminar', 'Cancelar');
    if (!ok) return;
    try {
      await api.delete(`/timesheets/${entry.Timesheet_Id}`);
      notify.success('Registro eliminado');
      await loadEverything();
    } catch (error) {
      notify.error(error?.response?.data?.detail || 'No fue posible eliminar el registro');
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
      >
        <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
      </div>
    );
  }

  if (!detail?.project) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
      >
        <p className="text-sm text-slate-400">No se encontró el proyecto.</p>
      </div>
    );
  }

  const project = detail.project;
  const tasks = detail.tareas || [];
  const timesheets = detail.timesheets || [];
  const resumenUsuarios = detail.resumen_usuarios || [];

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link to="/proyectos" className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4] hover:underline">
              ← Proyectos
            </Link>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">{project.Nombre}</h1>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[project.Status] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                {project.Status}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {project.NameCompany} · {project.ClienteNombre || 'Sin cliente'} · Responsable: {project.ResponsableNombre || 'Sin asignar'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTaskModal({})}
              className="rounded-[14px] border border-[#1b3d86] px-4 py-2 text-sm font-semibold text-[#1b3d86] hover:bg-[#f0f4ff] transition"
            >
              + Nueva tarea
            </button>
            <button
              onClick={() => setTimesheetModal({})}
              className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition"
            >
              + Registrar horas
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { title: "Horas reales", value: toHours(project.HorasReales), color: "text-sky-700", bg: "border-sky-200 bg-sky-50" },
            { title: "Ppto. horas", value: toHours(project.PresupuestoHoras), color: "text-slate-700", bg: "border-slate-200 bg-slate-50" },
            { title: "Costo real", value: toCurrency(project.CostoReal), color: "text-violet-700", bg: "border-violet-200 bg-violet-50" },
            { title: "Ppto. costo", value: toCurrency(project.PresupuestoCosto), color: "text-indigo-700", bg: "border-indigo-200 bg-indigo-50" },
            { title: "Tareas", value: `${project.TareasCompletadas || 0}/${project.TotalTareas || 0}`, color: "text-emerald-700", bg: "border-emerald-200 bg-emerald-50" },
            { title: "Avance", value: `${Number(project.AvancePct || 0).toFixed(1)}%`, color: "text-amber-700", bg: "border-amber-200 bg-amber-50" },
          ].map(({ title, value, color, bg }) => (
            <div key={title} className={`rounded-[20px] border p-4 shadow-[0_4px_20px_rgba(15,45,93,0.06)] ${bg}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96]">{title}</p>
              <p className={`mt-1.5 text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">

          {/* Tasks */}
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#eaf0fa]">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Proyecto</p>
              <h3 className="text-base font-bold text-[#0d1f3c]">Tareas</h3>
            </div>
            {tasks.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-400">No hay tareas registradas para este proyecto.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#eaf0fa]">
                      {["Tarea", "Asignado", "Estado", "Horas", ""].map(col => (
                        <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.Tarea_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                        <td className="px-4 py-3 pl-6">
                          <div className="text-sm font-semibold text-slate-800">{task.Titulo}</div>
                          <div className="text-xs text-slate-400 capitalize">{task.Prioridad} · vence {toDate(task.FechaLimite)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{task.NombreAsignado || 'Sin asignar'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[task.Estado] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                            {task.Estado?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          <div>{toHours(task.HorasReales)}</div>
                          <div className="text-xs text-slate-400">/ {toHours(task.HorasEstimadas)}</div>
                        </td>
                        <td className="px-4 py-3 pr-6">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setTaskModal(task)} className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition">Editar</button>
                            <button onClick={() => deleteTask(task)} className="rounded-[9px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* User summary */}
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#eaf0fa]">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Tiempo</p>
              <h3 className="text-base font-bold text-[#0d1f3c]">Resumen por usuario</h3>
            </div>
            {resumenUsuarios.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-400">Sin horas registradas todavía.</p>
            ) : (
              <div className="p-4 space-y-2">
                {resumenUsuarios.map((row) => (
                  <div key={row.User_Id} className="rounded-[14px] border border-[#eaf0fa] bg-[#f8faff] px-4 py-3">
                    <div className="text-sm font-semibold text-slate-800">{row.NombreUsuario || `Usuario ${row.User_Id}`}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{toHours(row.Horas)} · {toCurrency(row.Costo)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Timesheets */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#eaf0fa]">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Proyecto</p>
            <h3 className="text-base font-bold text-[#0d1f3c]">Timesheets</h3>
          </div>
          {timesheets.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">Todavía no hay horas registradas para este proyecto.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["Fecha", "Usuario", "Tarea", "Horas", "Costo", "Detalle", ""].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timesheets.map((entry) => (
                    <tr key={entry.Timesheet_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="px-4 py-3 pl-6 text-sm text-slate-600">{toDate(entry.Fecha)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{entry.NombreUsuario || `Usuario ${entry.User_Id}`}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{entry.TareaTitulo || 'Sin tarea'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{toHours(entry.HorasRegistradas)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{toCurrency(entry.CostoCalculado)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{entry.Descripcion || '—'}</td>
                      <td className="px-4 py-3 pr-6">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setTimesheetModal(entry)} className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition">Editar</button>
                          <button onClick={() => deleteTimesheet(entry)} className="rounded-[9px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">Eliminar</button>
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

      {taskModal && (
        <TaskModal
          project={project}
          users={users}
          task={taskModal?.Tarea_Id ? taskModal : null}
          onClose={() => setTaskModal(null)}
          onSaved={() => { setTaskModal(null); loadEverything(); }}
        />
      )}

      {timesheetModal && (
        <TimesheetModal
          project={project}
          tasks={tasks}
          users={users}
          entry={timesheetModal?.Timesheet_Id ? timesheetModal : null}
          onClose={() => setTimesheetModal(null)}
          onSaved={() => { setTimesheetModal(null); loadEverything(); }}
        />
      )}
    </div>
  );
}
