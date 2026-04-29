import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaCircle,
  FaClock,
  FaUser,
  FaUsers
} from 'react-icons/fa';
import api from '../../services/api';

const PRIORIDAD_DOT = {
  urgente: 'bg-rose-500',
  alta: 'bg-orange-400',
  media: 'bg-amber-400',
  baja: 'bg-emerald-400'
};

const ESTADO_BADGE = {
  pendiente: 'border-amber-200 bg-amber-50 text-amber-700',
  en_proceso: 'border-blue-200 bg-blue-50 text-blue-700',
  completada: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelada: 'border-slate-200 bg-slate-50 text-slate-500'
};

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const USER_COLORS = [
  'from-[#1b3d86] to-[#2a5fc4]',
  'from-[#059669] to-[#10b981]',
  'from-[#7c3aed] to-[#a78bfa]',
  'from-[#dc2626] to-[#f87171]',
  'from-[#d97706] to-[#fbbf24]',
  'from-[#0891b2] to-[#22d3ee]',
  'from-[#be185d] to-[#f472b6]',
  'from-[#065f46] to-[#34d399]'
];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function fmtHora(fechaStr) {
  if (!fechaStr) return null;
  const date = new Date(fechaStr);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (hours === 0 && minutes === 0) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function avatarInitials(nombre) {
  if (!nombre) return '?';
  const parts = nombre.trim().split(' ');
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

function userColor(nombre) {
  let hash = 0;
  for (const char of (nombre || '')) hash = (hash * 31 + char.charCodeAt(0)) & 0xff;
  return USER_COLORS[hash % USER_COLORS.length];
}

function estadoKey(estado) {
  return String(estado || '').toLowerCase().replace(/\s+/g, '_');
}

export default function CalendarioUsuarios() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser?.is_admin || currentUser?.isAdmin || currentUser?.RolId <= 2;
  const companyId = currentUser?.companies?.[0]
    || currentUser?.Company_Id
    || currentUser?.company_id;

  const [vista, setVista] = useState('mis');
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioFiltro, setUsuarioFiltro] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoy] = useState(new Date());
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [tareaDetalle, setTareaDetalle] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    api.get(`/users?company_id=${companyId}&limit=200`)
      .then((response) => {
        const list = response.data?.users || response.data?.items || response.data || [];
        setUsuarios(list);
      })
      .catch(() => setUsuarios([]));
  }, [companyId, isAdmin]);

  const loadTareas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ company_id: companyId });
      if (vista === 'mis') {
        params.append('asignado_a', currentUser?.User_Id || currentUser?.user_id);
      } else if (vista === 'todos' && usuarioFiltro) {
        params.append('asignado_a', usuarioFiltro);
      }
      const response = await api.get(`/tareas/?${params}`);
      setTareas(response.data?.items || response.data || []);
    } catch {
      setTareas([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, currentUser?.User_Id, currentUser?.user_id, usuarioFiltro, vista]);

  useEffect(() => {
    loadTareas();
  }, [loadTareas]);

  const grilla = useMemo(() => {
    const primerDia = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0);
    const offsetInicio = primerDia.getDay();
    const dias = [];

    for (let i = offsetInicio - 1; i >= 0; i -= 1) {
      dias.push({ fecha: new Date(anio, mes, -i), esActual: false });
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia += 1) {
      dias.push({ fecha: new Date(anio, mes, dia), esActual: true });
    }

    let extra = 1;
    while (dias.length < 42) {
      dias.push({ fecha: new Date(anio, mes + 1, extra), esActual: false });
      extra += 1;
    }

    return dias;
  }, [anio, mes]);

  const tareasPorDia = useMemo(() => {
    const mapa = {};
    for (const tarea of tareas) {
      if (!tarea.FechaLimite) continue;
      const fecha = new Date(tarea.FechaLimite);
      const key = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(tarea);
    }
    return mapa;
  }, [tareas]);

  const resumenMes = useMemo(() => ([
    ['Pendientes', tareas.filter((t) => estadoKey(t.Estado) === 'pendiente').length, 'text-amber-600'],
    ['En proceso', tareas.filter((t) => estadoKey(t.Estado) === 'en_proceso').length, 'text-blue-600'],
    ['Completadas', tareas.filter((t) => estadoKey(t.Estado) === 'completada').length, 'text-emerald-600'],
    ['Total', tareas.length, 'text-[#1b3d86]']
  ]), [tareas]);

  function tareasDelDia(fecha) {
    const key = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
    return tareasPorDia[key] || [];
  }

  const tareasSeleccionadas = useMemo(() => {
    if (!diaSeleccionado) return [];
    return [...tareasDelDia(diaSeleccionado)].sort((a, b) => {
      const horaA = fmtHora(a.FechaLimite) || '99:99';
      const horaB = fmtHora(b.FechaLimite) || '99:99';
      return horaA.localeCompare(horaB);
    });
  }, [diaSeleccionado, tareasPorDia]);

  const prevMes = () => {
    if (mes === 0) {
      setMes(11);
      setAnio((value) => value - 1);
    } else {
      setMes((value) => value - 1);
    }
    setDiaSeleccionado(null);
  };

  const nextMes = () => {
    if (mes === 11) {
      setMes(0);
      setAnio((value) => value + 1);
    } else {
      setMes((value) => value + 1);
    }
    setDiaSeleccionado(null);
  };

  const irHoy = () => {
    setMes(hoy.getMonth());
    setAnio(hoy.getFullYear());
    setDiaSeleccionado(null);
  };

  const TareaCard = ({ tarea }) => {
    const hora = fmtHora(tarea.FechaLimite);
    const prioridad = String(tarea.Prioridad || 'media').toLowerCase();
    return (
      <div
        onClick={() => setTareaDetalle(tarea)}
        className="group cursor-pointer rounded-[16px] border border-white/80 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(15,45,93,0.07)] transition hover:shadow-[0_6px_20px_rgba(15,45,93,0.13)]"
      >
        <div className="flex items-start gap-2.5">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORIDAD_DOT[prioridad] || 'bg-slate-300'}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{tarea.Titulo}</p>
            {tarea.NombreAsignado && (
              <div className="mt-1 flex items-center gap-1.5">
                <div className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${userColor(tarea.NombreAsignado)} text-[9px] font-bold text-white`}>
                  {avatarInitials(tarea.NombreAsignado).toUpperCase()}
                </div>
                <span className="truncate text-xs text-slate-500">{tarea.NombreAsignado}</span>
              </div>
            )}
            {hora && (
              <div className="mt-1 flex items-center gap-1 text-xs text-[#3b6fd4]">
                <FaClock className="text-[9px]" />
                <span className="font-semibold">{hora}</span>
              </div>
            )}
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${ESTADO_BADGE[estadoKey(tarea.Estado)] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            {String(tarea.Estado || '').replace('_', ' ')}
          </span>
        </div>
      </div>
    );
  };

  const TareaChip = ({ tarea }) => {
    const prioridad = String(tarea.Prioridad || 'media').toLowerCase();
    return (
      <div
        title={`${tarea.Titulo} - ${tarea.NombreAsignado || 'Sin asignar'}`}
        className={`truncate rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${
          prioridad === 'urgente' ? 'bg-rose-100 text-rose-700'
            : prioridad === 'alta' ? 'bg-orange-100 text-orange-700'
              : prioridad === 'media' ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
        }`}
      >
        {tarea.Titulo}
      </div>
    );
  };

  return (
    <div
      className="min-h-full w-full px-3 pt-2 pb-6 sm:px-5 lg:px-6"
      style={{
        background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb'
      }}
    >
      <div className="mx-auto w-full max-w-[1600px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[26px] border border-white/70 bg-white/70 px-5 py-4 shadow-[0_10px_30px_rgba(15,45,93,0.06)] backdrop-blur-sm">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Calendario</p>
            <h1 className="flex items-center gap-2 text-xl font-bold text-[#0d1f3c] sm:text-2xl">
              <FaCalendarAlt className="text-[#3b6fd4]" />
              <span className="truncate">Calendario de Usuarios</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Consulta tareas del equipo por fecha sin que la vista se recorte en pantallas medianas.
            </p>
          </div>

          {isAdmin && (
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
              <div className="flex rounded-[14px] bg-[#f0f4ff] p-1">
                <button
                  onClick={() => { setVista('mis'); setUsuarioFiltro(null); }}
                  className={`flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-xs font-semibold transition ${
                    vista === 'mis'
                      ? 'bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <FaUser className="text-[10px]" /> Mis tareas
                </button>
                <button
                  onClick={() => setVista('todos')}
                  className={`flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-xs font-semibold transition ${
                    vista === 'todos'
                      ? 'bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <FaUsers className="text-[10px]" /> Todos
                </button>
              </div>

              {vista === 'todos' && (
                <select
                  value={usuarioFiltro || ''}
                  onChange={(event) => setUsuarioFiltro(event.target.value ? Number(event.target.value) : null)}
                  className="min-w-[220px] rounded-[12px] border border-[#dce4f0] bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
                >
                  <option value="">Todos los usuarios</option>
                  {usuarios.map((user) => (
                    <option key={user.User_Id} value={user.User_Id}>
                      {user.Name} {user.Lastname}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-[22px] border border-white/70 bg-white/65 px-4 py-3 shadow-[0_10px_24px_rgba(15,45,93,0.05)]">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wide text-[10px] text-slate-400">Prioridad:</span>
            {[['urgente', 'bg-rose-500'], ['alta', 'bg-orange-400'], ['media', 'bg-amber-400'], ['baja', 'bg-emerald-400']].map(([label, className]) => (
              <span key={label} className="flex items-center gap-1 capitalize">
                <span className={`h-2 w-2 rounded-full ${className}`} /> {label}
              </span>
            ))}
          </div>

          {vista === 'todos' && !usuarioFiltro && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold uppercase tracking-wide text-[10px] text-slate-400">Usuarios:</span>
              {usuarios.slice(0, 8).map((user) => (
                <button
                  key={user.User_Id}
                  onClick={() => setUsuarioFiltro(usuarioFiltro === user.User_Id ? null : user.User_Id)}
                  title={`${user.Name} ${user.Lastname}`}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${userColor(`${user.Name} ${user.Lastname}`)} text-[10px] font-bold text-white ring-2 transition ${usuarioFiltro === user.User_Id ? 'ring-[#1b3d86]' : 'ring-white hover:ring-[#3b6fd4]/40'}`}
                >
                  {avatarInitials(`${user.Name} ${user.Lastname}`).toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start">
          <div className="min-w-0 flex-1 overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(245,248,255,0.92)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)]">
            <div className="flex flex-col gap-3 border-b border-[#eaf0fa] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={prevMes} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#dce4f0] bg-white text-slate-500 transition hover:bg-[#f0f4ff] hover:text-[#1b3d86]">
                  <FaChevronLeft className="text-xs" />
                </button>
                <h2 className="min-w-[160px] text-center text-base font-bold text-[#0d1f3c] sm:text-lg">
                  {MESES[mes]} {anio}
                </h2>
                <button onClick={nextMes} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#dce4f0] bg-white text-slate-500 transition hover:bg-[#f0f4ff] hover:text-[#1b3d86]">
                  <FaChevronRight className="text-xs" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {loading && <div className="h-4 w-4 rounded-full border-2 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />}
                <button onClick={irHoy} className="rounded-[10px] border border-[#dce4f0] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-[#f0f4ff] hover:text-[#1b3d86]">
                  Hoy
                </button>
                <span className="text-xs text-slate-400">{tareas.length} tareas</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-7 border-b border-[#eaf0fa]">
                  {DIAS_SEMANA.map((dia) => (
                    <div
                      key={dia}
                      className={`py-2 text-center text-[11px] font-bold uppercase tracking-[0.1em] ${dia === 'Dom' || dia === 'Sab' ? 'text-slate-300' : 'text-[#6b7a96]'}`}
                    >
                      {dia}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {grilla.map(({ fecha, esActual }, index) => {
                    const esSeleccionado = diaSeleccionado && isSameDay(fecha, diaSeleccionado);
                    const esHoy = isSameDay(fecha, hoy);
                    const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
                    const chips = tareasDelDia(fecha);

                    return (
                      <div
                        key={index}
                        onClick={() => setDiaSeleccionado(esSeleccionado ? null : new Date(fecha))}
                        className={`min-h-[88px] cursor-pointer border-b border-r border-[#eaf0fa] p-2 transition xl:min-h-[96px]
                          ${esSeleccionado ? 'bg-[#eef2ff]' : esActual ? (esFinDeSemana ? 'bg-[#f8f9fb]' : 'bg-white hover:bg-[#f4f7ff]/70') : 'bg-[#f8f9fc]/60'}
                          ${index % 7 === 6 ? 'border-r-0' : ''}`}
                      >
                        <div
                          className={`mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
                            ${esHoy ? 'bg-gradient-to-br from-[#1b3d86] to-[#2a5fc4] text-white shadow-sm'
                              : esSeleccionado ? 'bg-[#1b3d86]/10 text-[#1b3d86]'
                                : esActual ? (esFinDeSemana ? 'text-slate-300' : 'text-slate-700')
                                  : 'text-slate-300'}`}
                        >
                          {fecha.getDate()}
                        </div>

                        <div className="space-y-0.5">
                          {chips.slice(0, 3).map((tarea) => (
                            <TareaChip key={tarea.Tarea_Id} tarea={tarea} />
                          ))}
                          {chips.length > 3 && (
                            <div className="text-[10px] font-semibold text-[#3b6fd4]">+{chips.length - 3} mas</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="grid w-full shrink-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:w-80 2xl:grid-cols-1">
            <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(245,248,255,0.92)_100%)] px-5 py-4 shadow-[0_8px_24px_rgba(15,45,93,0.08)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">
                {diaSeleccionado ? `${diaSeleccionado.getDate()} de ${MESES[diaSeleccionado.getMonth()]}` : 'Selecciona un dia'}
              </p>
              {diaSeleccionado ? (
                <p className="mt-0.5 text-sm font-semibold text-[#0d1f3c]">
                  {tareasSeleccionadas.length === 0 ? 'Sin tareas este dia' : `${tareasSeleccionadas.length} tarea${tareasSeleccionadas.length !== 1 ? 's' : ''}`}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-slate-400">Haz click en una fecha para ver las tareas</p>
              )}
            </div>

            {diaSeleccionado ? (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-0.5 md:col-span-1 2xl:col-span-1">
                {tareasSeleccionadas.length === 0 ? (
                  <div className="rounded-[16px] border border-[#eaf0fa] bg-white px-5 py-8 text-center shadow-[0_4px_14px_rgba(15,45,93,0.05)]">
                    <FaCalendarAlt className="mx-auto mb-2 text-2xl text-slate-200" />
                    <p className="text-xs text-slate-400">No hay tareas para este dia</p>
                  </div>
                ) : (
                  tareasSeleccionadas.map((tarea) => <TareaCard key={tarea.Tarea_Id} tarea={tarea} />)
                )}
              </div>
            ) : (
              <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(245,248,255,0.92)_100%)] px-5 py-4 shadow-[0_8px_24px_rgba(15,45,93,0.08)] space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Este mes</p>
                {resumenMes.map(([label, count, className]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={`text-sm font-bold ${className}`}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {tareaDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setTareaDetalle(null)}>
          <div
            className="w-full max-w-md overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">Tarea</p>
                <h3 className="mt-0.5 text-base font-bold leading-snug text-white">{tareaDetalle.Titulo}</h3>
              </div>
              <button onClick={() => setTareaDetalle(null)} className="mt-0.5 shrink-0 text-xl leading-none text-white/60 hover:text-white">x</button>
            </div>

            <div className="space-y-4 bg-white p-6">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${ESTADO_BADGE[estadoKey(tareaDetalle.Estado)] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  <FaCircle className="text-[8px]" />
                  {String(tareaDetalle.Estado || '').replace('_', ' ')}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                    tareaDetalle.Prioridad === 'urgente' ? 'bg-rose-100 text-rose-700'
                      : tareaDetalle.Prioridad === 'alta' ? 'bg-orange-100 text-orange-700'
                        : tareaDetalle.Prioridad === 'media' ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {tareaDetalle.Prioridad || 'media'}
                </span>
              </div>

              {tareaDetalle.Descripcion && (
                <p className="text-sm leading-relaxed text-slate-600">{tareaDetalle.Descripcion}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[12px] border border-[#eaf0fa] bg-[#f8faff] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Asignado a</p>
                  {tareaDetalle.NombreAsignado ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${userColor(tareaDetalle.NombreAsignado)} text-[9px] font-bold text-white`}>
                        {avatarInitials(tareaDetalle.NombreAsignado).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{tareaDetalle.NombreAsignado}</span>
                    </div>
                  ) : <p className="mt-1 text-xs text-slate-400">Sin asignar</p>}
                </div>

                <div className="rounded-[12px] border border-[#eaf0fa] bg-[#f8faff] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Creado por</p>
                  {tareaDetalle.NombreCreador ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${userColor(tareaDetalle.NombreCreador)} text-[9px] font-bold text-white`}>
                        {avatarInitials(tareaDetalle.NombreCreador).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{tareaDetalle.NombreCreador}</span>
                    </div>
                  ) : <p className="mt-1 text-xs text-slate-400">-</p>}
                </div>

                <div className="rounded-[12px] border border-[#eaf0fa] bg-[#f8faff] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Fecha limite</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    {tareaDetalle.FechaLimite
                      ? new Date(tareaDetalle.FechaLimite).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
                      : '-'}
                  </p>
                </div>

                <div className="rounded-[12px] border border-[#eaf0fa] bg-[#f8faff] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Hora limite</p>
                  <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${fmtHora(tareaDetalle.FechaLimite) ? 'text-[#3b6fd4]' : 'text-slate-400'}`}>
                    {fmtHora(tareaDetalle.FechaLimite)
                      ? <><FaClock className="text-[10px]" />{fmtHora(tareaDetalle.FechaLimite)}</>
                      : 'Sin hora'}
                  </p>
                </div>

                {tareaDetalle.HorasEstimadas > 0 && (
                  <div className="rounded-[12px] border border-[#eaf0fa] bg-[#f8faff] px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Horas estimadas</p>
                    <p className="mt-1 text-xs font-semibold text-slate-700">{tareaDetalle.HorasEstimadas}h</p>
                  </div>
                )}

                {tareaDetalle.Modulo && (
                  <div className="rounded-[12px] border border-[#eaf0fa] bg-[#f8faff] px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Modulo</p>
                    <p className="mt-1 text-xs font-semibold text-slate-700">{tareaDetalle.Modulo}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setTareaDetalle(null)}
                className="w-full rounded-[12px] border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
