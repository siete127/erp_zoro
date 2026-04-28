import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';
import { socket } from '../../services/socket';

const ESTADOS = ['pendiente', 'en_proceso', 'completada'];
const ESTADO_LABELS = { pendiente: 'Pendiente', en_proceso: 'En Proceso', completada: 'Completada' };

const ESTADO_COL = {
  pendiente: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400', label: 'text-amber-700' },
  en_proceso: { bg: 'bg-blue-50', border: 'border-[#3b6fd4]/30', dot: 'bg-[#3b6fd4]', label: 'text-[#1b3d86]' },
  completada: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'text-emerald-700' }
};

const PRIORIDAD_BADGE = {
  urgente: 'border-rose-200 bg-rose-50 text-rose-700',
  alta: 'border-orange-200 bg-orange-50 text-orange-700',
  media: 'border-blue-200 bg-blue-50 text-blue-700',
  baja: 'border-slate-200 bg-slate-50 text-slate-500'
};

const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'];

const fieldCls = 'w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20';
const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]';

function ModalTarea({ tarea, companyId, usuarios, onClose, onSaved }) {
  const isNew = !tarea;
  const [form, setForm] = useState({
    Titulo: tarea?.Titulo || '',
    Descripcion: tarea?.Descripcion || '',
    AsignadoA: tarea?.AsignadoA || '',
    FechaLimite: tarea?.FechaLimite ? tarea.FechaLimite.split('T')[0] : '',
    Prioridad: tarea?.Prioridad || 'media',
    Estado: tarea?.Estado || 'pendiente'
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.Titulo.trim()) {
      notify.error('El titulo es requerido');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, Company_Id: companyId, AsignadoA: form.AsignadoA || null };
      if (isNew) await api.post('/tareas/', payload);
      else await api.put(`/tareas/${tarea.Tarea_Id}`, payload);
      notify.success(isNew ? 'Tarea creada' : 'Tarea actualizada');
      onSaved();
    } catch (err) {
      notify.error(err?.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
        <div className="flex items-center justify-between bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4">
          <h2 className="text-base font-bold text-white">{isNew ? 'Nueva tarea' : 'Editar tarea'}</h2>
          <button onClick={onClose} className="text-xl leading-none text-white/70 hover:text-white">x</button>
        </div>
        <div className="space-y-4 bg-white p-6">
          <div>
            <label className={labelCls}>Titulo *</label>
            <input className={fieldCls} placeholder="Titulo de la tarea" value={form.Titulo} onChange={(e) => setForm({ ...form, Titulo: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Descripcion</label>
            <textarea className={`${fieldCls} resize-none`} placeholder="Descripcion opcional" rows={3} value={form.Descripcion} onChange={(e) => setForm({ ...form, Descripcion: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Prioridad</label>
              <select className={fieldCls} value={form.Prioridad} onChange={(e) => setForm({ ...form, Prioridad: e.target.value })}>
                {PRIORIDADES.map((priority) => <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha limite</label>
              <input type="date" className={fieldCls} value={form.FechaLimite} onChange={(e) => setForm({ ...form, FechaLimite: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Asignar a</label>
            <select className={fieldCls} value={form.AsignadoA} onChange={(e) => setForm({ ...form, AsignadoA: e.target.value })}>
              <option value="">Sin asignar</option>
              {usuarios.map((user) => <option key={user.User_Id} value={user.User_Id}>{user.Name} {user.Lastname}</option>)}
            </select>
          </div>
          {!isNew && (
            <div>
              <label className={labelCls}>Estado</label>
              <select className={fieldCls} value={form.Estado} onChange={(e) => setForm({ ...form, Estado: e.target.value })}>
                {ESTADOS.map((estado) => <option key={estado} value={estado}>{ESTADO_LABELS[estado]}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] transition disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Tareas() {
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [companyId, setCompanyId] = useState(null);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    const company = user?.Company_Id || user?.companies?.[0] || 1;
    setCompanyId(company);
  }, []);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [taskResponse, usersResponse] = await Promise.all([
        api.get(`/tareas/?company_id=${companyId}`),
        api.get('/users/')
      ]);
      setTareas(taskResponse.data || []);
      setUsuarios(usersResponse.data?.data || usersResponse.data || []);
    } catch {
      notify.error('Error al cargar tareas');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    socket.on('tarea:changed', handler);
    return () => socket.off('tarea:changed', handler);
  }, [load]);

  const handleDelete = async (tarea) => {
    if (!window.confirm(`Eliminar "${tarea.Titulo}"?`)) return;
    try {
      await api.delete(`/tareas/${tarea.Tarea_Id}`);
      notify.success('Tarea eliminada');
      load();
    } catch {
      notify.error('Error al eliminar');
    }
  };

  const moveEstado = async (tarea, nuevoEstado) => {
    try {
      await api.put(`/tareas/${tarea.Tarea_Id}`, { Estado: nuevoEstado });
      load();
    } catch {
      notify.error('Error al actualizar estado');
    }
  };

  const columnas = useMemo(
    () => ESTADOS.map((estado) => ({ estado, items: tareas.filter((task) => task.Estado === estado) })),
    [tareas]
  );

  const totalPendiente = tareas.filter((task) => task.Estado === 'pendiente').length;
  const totalEnProceso = tareas.filter((task) => task.Estado === 'en_proceso').length;
  const totalCompletada = tareas.filter((task) => task.Estado === 'completada').length;

  if (loading) {
    return (
      <div
        className="min-h-full w-full px-4 py-4 flex items-center justify-center sm:px-6 sm:py-6"
        style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86]" />
      </div>
    );
  }

  return (
    <div
      className="min-h-full w-full px-4 py-4 sm:px-6 sm:py-6"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-white/70 bg-white/70 px-5 py-4 shadow-[0_10px_30px_rgba(15,45,93,0.06)] backdrop-blur-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Gestion</p>
            <h1 className="text-xl font-bold text-[#0d1f3c]">Tareas</h1>
            <p className="mt-1 text-sm text-slate-500">Organiza pendientes, mueve avances y mantiene el tablero util aunque todavia no haya registros.</p>
          </div>
          <button
            onClick={() => setModal('new')}
            className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition hover:shadow-[0_6px_18px_rgba(27,61,134,0.38)]"
          >
            + Nueva tarea
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4 shadow-[0_4px_20px_rgba(15,45,93,0.06)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Pendientes</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{totalPendiente}</p>
          </div>
          <div className="rounded-[20px] border border-[#dce4f0] bg-[#f8faff] p-4 shadow-[0_4px_20px_rgba(15,45,93,0.06)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">En proceso</p>
            <p className="mt-1 text-2xl font-bold text-[#1b3d86]">{totalEnProceso}</p>
          </div>
          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 shadow-[0_4px_20px_rgba(15,45,93,0.06)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Completadas</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{totalCompletada}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {columnas.map(({ estado, items }) => {
            const col = ESTADO_COL[estado];
            return (
              <div key={estado} className={`min-h-[420px] rounded-[24px] border-2 ${col.border} ${col.bg} p-4 shadow-[0_10px_30px_rgba(15,45,93,0.06)]`}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                    <h2 className={`text-sm font-bold ${col.label}`}>{ESTADO_LABELS[estado]}</h2>
                  </div>
                  <span className="rounded-full border border-white/70 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 shadow-sm">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {items.map((tarea) => (
                    <div
                      key={tarea.Tarea_Id}
                      className="group rounded-[16px] border border-white/80 bg-white p-3.5 shadow-[0_2px_10px_rgba(15,45,93,0.07)] transition hover:shadow-[0_4px_16px_rgba(15,45,93,0.12)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="leading-snug text-sm font-semibold text-slate-800">{tarea.Titulo}</p>
                        <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${PRIORIDAD_BADGE[tarea.Prioridad] || PRIORIDAD_BADGE.baja}`}>
                          {tarea.Prioridad}
                        </span>
                      </div>
                      {tarea.Descripcion && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">{tarea.Descripcion}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[11px] text-slate-400">
                          {tarea.NombreAsignado ? `Asignada a ${tarea.NombreAsignado}` : 'Sin asignar'}
                        </p>
                        {tarea.FechaLimite && (
                          <span className="text-[10px] text-slate-400">{new Date(tarea.FechaLimite).toLocaleDateString('es-MX')}</span>
                        )}
                      </div>
                      <div className="mt-2.5 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          onClick={() => setModal(tarea)}
                          className="rounded-[7px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2.5 py-1 text-[11px] font-semibold text-[#1b3d86] hover:bg-[#e4ecff]"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(tarea)}
                          className="rounded-[7px] border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                        >
                          Eliminar
                        </button>
                        {estado !== 'pendiente' && (
                          <button
                            onClick={() => moveEstado(tarea, ESTADOS[ESTADOS.indexOf(estado) - 1])}
                            className="rounded-[7px] border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                          >
                            Atras
                          </button>
                        )}
                        {estado !== 'completada' && (
                          <button
                            onClick={() => moveEstado(tarea, ESTADOS[ESTADOS.indexOf(estado) + 1])}
                            className="rounded-[7px] border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                          >
                            Avanzar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[18px] border border-dashed border-white/80 bg-white/55 px-6 text-center">
                      <p className={`text-sm font-semibold ${col.label}`}>Sin tareas</p>
                      <p className="mt-2 max-w-[220px] text-xs leading-relaxed text-slate-400">
                        {estado === 'pendiente'
                          ? 'Crea una tarea nueva para empezar a llenar el backlog del equipo.'
                          : estado === 'en_proceso'
                            ? 'Cuando una tarea arranque aparecera aqui para dar seguimiento.'
                            : 'Las tareas terminadas se mostraran aqui como historial del trabajo completado.'}
                      </p>
                      {estado === 'pendiente' && (
                        <button
                          onClick={() => setModal('new')}
                          className="mt-4 rounded-[12px] border border-amber-200 bg-white px-4 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                        >
                          Crear primera tarea
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modal && (
        <ModalTarea
          tarea={modal === 'new' ? null : modal}
          companyId={companyId}
          usuarios={usuarios}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
