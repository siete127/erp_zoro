import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';
import { socket } from '../../services/socket';

const ESTADOS = ['pendiente', 'en_proceso', 'completada'];
const ESTADO_LABELS = { pendiente: 'Pendiente', en_proceso: 'En Proceso', completada: 'Completada' };
const ESTADO_COLORS = {
  pendiente:   'bg-yellow-50 border-yellow-300',
  en_proceso:  'bg-blue-50 border-blue-300',
  completada:  'bg-green-50 border-green-300',
};
const PRIORIDAD_COLORS = {
  urgente: 'bg-red-100 text-red-700',
  alta:    'bg-orange-100 text-orange-700',
  media:   'bg-blue-100 text-blue-700',
  baja:    'bg-gray-100 text-gray-600',
};

const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'];

function ModalTarea({ tarea, companyId, usuarios, onClose, onSaved }) {
  const isNew = !tarea;
  const [form, setForm] = useState({
    Titulo: tarea?.Titulo || '',
    Descripcion: tarea?.Descripcion || '',
    AsignadoA: tarea?.AsignadoA || '',
    FechaLimite: tarea?.FechaLimite ? tarea.FechaLimite.split('T')[0] : '',
    Prioridad: tarea?.Prioridad || 'media',
    Estado: tarea?.Estado || 'pendiente',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.Titulo.trim()) { notify.error('El título es requerido'); return; }
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">{isNew ? 'Nueva tarea' : 'Editar tarea'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-3">
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Título *"
            value={form.Titulo}
            onChange={(e) => setForm({ ...form, Titulo: e.target.value })}
          />
          <textarea
            className="w-full border rounded px-3 py-2 text-sm resize-none"
            placeholder="Descripción"
            rows={3}
            value={form.Descripcion}
            onChange={(e) => setForm({ ...form, Descripcion: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Prioridad</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={form.Prioridad} onChange={(e) => setForm({ ...form, Prioridad: e.target.value })}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Fecha límite</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={form.FechaLimite} onChange={(e) => setForm({ ...form, FechaLimite: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Asignar a</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={form.AsignadoA} onChange={(e) => setForm({ ...form, AsignadoA: e.target.value })}>
              <option value="">Sin asignar</option>
              {usuarios.map((u) => <option key={u.User_Id} value={u.User_Id}>{u.Name} {u.Lastname}</option>)}
            </select>
          </div>
          {!isNew && (
            <div>
              <label className="text-xs text-gray-500">Estado</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={form.Estado} onChange={(e) => setForm({ ...form, Estado: e.target.value })}>
                {ESTADOS.map((e) => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Tareas() {
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | tarea object
  const [companyId, setCompanyId] = useState(null);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    const cid = user?.Company_Id || user?.companies?.[0] || 1;
    setCompanyId(cid);
  }, []);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [tr, ur] = await Promise.all([
        api.get(`/tareas/?company_id=${companyId}`),
        api.get('/users/'),
      ]);
      setTareas(tr.data || []);
      setUsuarios(ur.data?.data || ur.data || []);
    } catch {
      notify.error('Error al cargar tareas');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    socket.on('tarea:changed', handler);
    return () => socket.off('tarea:changed', handler);
  }, [load]);

  const handleDelete = async (tarea) => {
    if (!window.confirm(`¿Eliminar "${tarea.Titulo}"?`)) return;
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

  const columnas = ESTADOS.map((estado) => ({
    estado,
    items: tareas.filter((t) => t.Estado === estado),
  }));

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Cargando tareas...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tareas</h1>
        <button
          onClick={() => setModal('new')}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          + Nueva tarea
        </button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {columnas.map(({ estado, items }) => (
          <div key={estado} className={`rounded-xl border-2 ${ESTADO_COLORS[estado]} p-4 min-h-[300px]`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">{ESTADO_LABELS[estado]}</h2>
              <span className="bg-white rounded-full text-xs font-bold px-2 py-0.5 text-gray-600 border">{items.length}</span>
            </div>
            <div className="space-y-3">
              {items.map((tarea) => (
                <div key={tarea.Tarea_Id} className="bg-white rounded-lg shadow-sm border p-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 leading-snug">{tarea.Titulo}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${PRIORIDAD_COLORS[tarea.Prioridad] || ''}`}>
                      {tarea.Prioridad}
                    </span>
                  </div>
                  {tarea.Descripcion && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{tarea.Descripcion}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs text-gray-400">
                      {tarea.NombreAsignado ? `→ ${tarea.NombreAsignado}` : 'Sin asignar'}
                    </div>
                    {tarea.FechaLimite && (
                      <span className="text-[10px] text-gray-400">
                        {new Date(tarea.FechaLimite).toLocaleDateString('es-MX')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => setModal(tarea)} className="text-xs text-indigo-600 hover:underline">Editar</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={() => handleDelete(tarea)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                    {estado !== 'pendiente' && (
                      <><span className="text-gray-300">|</span>
                      <button onClick={() => moveEstado(tarea, ESTADOS[ESTADOS.indexOf(estado) - 1])} className="text-xs text-gray-500 hover:underline">← Atrás</button></>
                    )}
                    {estado !== 'completada' && (
                      <><span className="text-gray-300">|</span>
                      <button onClick={() => moveEstado(tarea, ESTADOS[ESTADOS.indexOf(estado) + 1])} className="text-xs text-gray-500 hover:underline">Adelante →</button></>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center pt-4">Sin tareas</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <ModalTarea
          tarea={modal === 'new' ? null : modal}
          companyId={companyId}
          usuarios={usuarios}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
