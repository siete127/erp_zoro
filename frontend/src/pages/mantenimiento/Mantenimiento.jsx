import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import confirm from '../../services/confirm';
import { notify } from '../../services/notify';

const ESTATUS_EQUIPO = ['OPERATIVO', 'EN_MANTENIMIENTO', 'BAJA'];
const ESTATUS_ORDEN = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO'];
const TIPOS_ORDEN = ['PREVENTIVO', 'CORRECTIVO'];
const CATEGORIAS = ['Maquinaria', 'Vehículo', 'Equipo de Cómputo', 'Herramienta', 'Instalación', 'Otro'];

const ESTATUS_EQUIPO_STYLE = {
  OPERATIVO:        'border-emerald-200 bg-emerald-50 text-emerald-700',
  EN_MANTENIMIENTO: 'border-amber-200 bg-amber-50 text-amber-700',
  BAJA:             'border-rose-200 bg-rose-50 text-rose-700',
};
const ESTATUS_ORDEN_STYLE = {
  PENDIENTE:  'border-slate-200 bg-slate-50 text-slate-700',
  EN_PROCESO: 'border-sky-200 bg-sky-50 text-sky-700',
  COMPLETADO: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELADO:  'border-rose-200 bg-rose-50 text-rose-700',
};
const TIPO_STYLE = {
  PREVENTIVO: 'border-blue-200 bg-blue-50 text-blue-700',
  CORRECTIVO: 'border-orange-200 bg-orange-50 text-orange-700',
};

const emptyEquipo = {
  Company_Id: '', Nombre: '', Categoria: 'Maquinaria', NumeroSerie: '',
  Ubicacion: '', Responsable_Id: '', FechaInstalacion: '', Estatus: 'OPERATIVO', Notas: '',
};
const emptyOrden = {
  Company_Id: '', Equipo_Id: '', Tipo: 'PREVENTIVO', Titulo: '',
  Descripcion: '', Tecnico_Id: '', FechaProgramada: '', Costo: '',
};

function inputClass() {
  return 'w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20';
}
function toDate(value) {
  return value ? new Date(String(value).slice(0, 10)).toLocaleDateString('es-MX') : '—';
}
function toCurrency(value) {
  return Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

export default function Mantenimiento() {
  const [tab, setTab] = useState('equipos');
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [filterEstatus, setFilterEstatus] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modales
  const [showEquipoModal, setShowEquipoModal] = useState(false);
  const [editingEquipo, setEditingEquipo] = useState(null);
  const [formEquipo, setFormEquipo] = useState(emptyEquipo);

  const [showOrdenModal, setShowOrdenModal] = useState(false);
  const [editingOrden, setEditingOrden] = useState(null);
  const [formOrden, setFormOrden] = useState(emptyOrden);

  const [showCompletarModal, setShowCompletarModal] = useState(false);
  const [completarOrden, setCompletarOrden] = useState(null);
  const [completarCosto, setCompletarCosto] = useState('');

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      if (tab === 'equipos') loadEquipos();
      else loadOrdenes();
    }
  }, [selectedCompany, tab, filterEstatus, filterTipo]);

  async function loadMeta() {
    try {
      const [compRes, userRes] = await Promise.all([
        api.get('/companies/'),
        api.get('/users/'),
      ]);
      const companyList = Array.isArray(compRes.data) ? compRes.data : (compRes.data?.data || []);
      const userList = Array.isArray(userRes.data) ? userRes.data : (userRes.data?.data || []);
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const defaultCompany = String(stored?.Company_Id || stored?.companies?.[0] || companyList[0]?.Company_Id || '');

      setCompanies(companyList);
      setUsers(userList);
      setSelectedCompany((prev) => prev || defaultCompany);
    } catch {
      notify.error('Error cargando catálogos');
    }
  }

  async function loadEquipos() {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ company_id: selectedCompany });
      if (filterEstatus) params.set('estatus', filterEstatus);
      const res = await api.get(`/mantenimiento/equipos?${params}`);
      setEquipos(Array.isArray(res.data) ? res.data : []);
    } catch {
      notify.error('Error cargando equipos');
    } finally {
      setLoading(false);
    }
  }

  async function loadOrdenes() {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ company_id: selectedCompany });
      if (filterEstatus) params.set('estatus', filterEstatus);
      if (filterTipo) params.set('tipo', filterTipo);
      const res = await api.get(`/mantenimiento/ordenes?${params}`);
      setOrdenes(Array.isArray(res.data) ? res.data : []);
    } catch {
      notify.error('Error cargando órdenes');
    } finally {
      setLoading(false);
    }
  }

  // ─── Equipos ─────────────────────────���──────────────────────

  function openCreateEquipo() {
    setEditingEquipo(null);
    setFormEquipo({ ...emptyEquipo, Company_Id: selectedCompany });
    setShowEquipoModal(true);
  }

  function openEditEquipo(equipo) {
    setEditingEquipo(equipo);
    setFormEquipo({
      Company_Id: String(equipo.Company_Id || ''),
      Nombre: equipo.Nombre || '',
      Categoria: equipo.Categoria || 'Maquinaria',
      NumeroSerie: equipo.NumeroSerie || '',
      Ubicacion: equipo.Ubicacion || '',
      Responsable_Id: equipo.Responsable_Id ? String(equipo.Responsable_Id) : '',
      FechaInstalacion: equipo.FechaInstalacion ? String(equipo.FechaInstalacion).slice(0, 10) : '',
      Estatus: equipo.Estatus || 'OPERATIVO',
      Notas: equipo.Notas || '',
    });
    setShowEquipoModal(true);
  }

  async function handleSaveEquipo(event) {
    event.preventDefault();
    if (!formEquipo.Nombre.trim()) { notify.error('Nombre es requerido'); return; }
    setSaving(true);
    try {
      const payload = {
        Company_Id: Number(formEquipo.Company_Id),
        Nombre: formEquipo.Nombre.trim(),
        Categoria: formEquipo.Categoria || null,
        NumeroSerie: formEquipo.NumeroSerie || null,
        Ubicacion: formEquipo.Ubicacion || null,
        Responsable_Id: formEquipo.Responsable_Id ? Number(formEquipo.Responsable_Id) : null,
        FechaInstalacion: formEquipo.FechaInstalacion || null,
        Estatus: formEquipo.Estatus,
        Notas: formEquipo.Notas || null,
      };
      if (editingEquipo) {
        await api.put(`/mantenimiento/equipos/${editingEquipo.Equipo_Id}`, payload);
        notify.success('Equipo actualizado');
      } else {
        await api.post('/mantenimiento/equipos', payload);
        notify.success('Equipo creado');
      }
      setShowEquipoModal(false);
      loadEquipos();
    } catch (e) {
      notify.error(e?.response?.data?.detail || 'Error guardando equipo');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEquipo(equipo) {
    const ok = await confirm(`¿Eliminar equipo "${equipo.Nombre}"?`, 'Equipo', 'Eliminar', 'Cancelar');
    if (!ok) return;
    try {
      const res = await api.delete(`/mantenimiento/equipos/${equipo.Equipo_Id}`);
      notify.success(res.data?.message || 'Equipo eliminado');
      loadEquipos();
    } catch (e) {
      notify.error(e?.response?.data?.detail || 'Error eliminando equipo');
    }
  }

  // ─── Órdenes ────────────────────────────────────────────────

  function openCreateOrden(equipo = null) {
    setEditingOrden(null);
    setFormOrden({
      ...emptyOrden,
      Company_Id: selectedCompany,
      Equipo_Id: equipo ? String(equipo.Equipo_Id) : '',
    });
    setShowOrdenModal(true);
  }

  function openEditOrden(orden) {
    setEditingOrden(orden);
    setFormOrden({
      Company_Id: String(orden.Company_Id || ''),
      Equipo_Id: String(orden.Equipo_Id || ''),
      Tipo: orden.Tipo || 'PREVENTIVO',
      Titulo: orden.Titulo || '',
      Descripcion: orden.Descripcion || '',
      Tecnico_Id: orden.Tecnico_Id ? String(orden.Tecnico_Id) : '',
      FechaProgramada: orden.FechaProgramada ? String(orden.FechaProgramada).slice(0, 10) : '',
      Costo: orden.Costo ?? '',
    });
    setShowOrdenModal(true);
  }

  async function handleSaveOrden(event) {
    event.preventDefault();
    if (!formOrden.Titulo.trim()) { notify.error('Título es requerido'); return; }
    if (!formOrden.Equipo_Id) { notify.error('Selecciona un equipo'); return; }
    setSaving(true);
    try {
      const payload = {
        Company_Id: Number(formOrden.Company_Id),
        Equipo_Id: Number(formOrden.Equipo_Id),
        Tipo: formOrden.Tipo,
        Titulo: formOrden.Titulo.trim(),
        Descripcion: formOrden.Descripcion || null,
        Tecnico_Id: formOrden.Tecnico_Id ? Number(formOrden.Tecnico_Id) : null,
        FechaProgramada: formOrden.FechaProgramada || null,
        Costo: formOrden.Costo !== '' ? Number(formOrden.Costo) : null,
      };
      if (editingOrden) {
        await api.put(`/mantenimiento/ordenes/${editingOrden.Orden_Id}`, payload);
        notify.success('Orden actualizada');
      } else {
        await api.post('/mantenimiento/ordenes', payload);
        notify.success('Orden creada');
      }
      setShowOrdenModal(false);
      loadOrdenes();
    } catch (e) {
      notify.error(e?.response?.data?.detail || 'Error guardando orden');
    } finally {
      setSaving(false);
    }
  }

  async function handleIniciarOrden(orden) {
    const ok = await confirm(`¿Iniciar la orden "${orden.Titulo}"?`, 'Mantenimiento', 'Iniciar', 'Cancelar');
    if (!ok) return;
    try {
      await api.post(`/mantenimiento/ordenes/${orden.Orden_Id}/iniciar`);
      notify.success('Orden iniciada');
      loadOrdenes();
      if (tab === 'equipos') loadEquipos();
    } catch (e) {
      notify.error(e?.response?.data?.detail || 'Error iniciando orden');
    }
  }

  function openCompletarOrden(orden) {
    setCompletarOrden(orden);
    setCompletarCosto(orden.Costo ?? '');
    setShowCompletarModal(true);
  }

  async function handleCompletarOrden() {
    if (!completarOrden) return;
    setSaving(true);
    try {
      await api.post(`/mantenimiento/ordenes/${completarOrden.Orden_Id}/completar`, {
        costo: completarCosto !== '' ? Number(completarCosto) : null,
      });
      notify.success('Orden completada');
      setShowCompletarModal(false);
      setCompletarOrden(null);
      loadOrdenes();
      loadEquipos();
    } catch (e) {
      notify.error(e?.response?.data?.detail || 'Error completando orden');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOrden(orden) {
    const ok = await confirm(`¿Eliminar la orden "${orden.Titulo}"?`, 'Orden', 'Eliminar', 'Cancelar');
    if (!ok) return;
    try {
      await api.delete(`/mantenimiento/ordenes/${orden.Orden_Id}`);
      notify.success('Orden eliminada');
      loadOrdenes();
    } catch (e) {
      notify.error(e?.response?.data?.detail || 'Error eliminando orden');
    }
  }

  const filteredEquipos = equipos.filter((e) => {
    if (!search.trim()) return true;
    return [e.Nombre, e.Categoria, e.Ubicacion, e.NumeroSerie, e.ResponsableNombre]
      .join(' ').toLowerCase().includes(search.toLowerCase());
  });

  const filteredOrdenes = ordenes.filter((o) => {
    if (!search.trim()) return true;
    return [o.Titulo, o.EquipoNombre, o.TecnicoNombre, o.Tipo]
      .join(' ').toLowerCase().includes(search.toLowerCase());
  });

  const equiposOperativos = equipos.filter((e) => e.Estatus === 'OPERATIVO').length;
  const equiposEnMante = equipos.filter((e) => e.Estatus === 'EN_MANTENIMIENTO').length;
  const ordenesPendientes = ordenes.filter((o) => o.Estatus === 'PENDIENTE').length;
  const ordenesEnProceso = ordenes.filter((o) => o.Estatus === 'EN_PROCESO').length;

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Producción</p>
          <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Mantenimiento</h1>
          <p className="text-sm text-slate-500">Gestión de equipos y órdenes de mantenimiento preventivo/correctivo.</p>
        </div>
        <div className="flex gap-2">
          {tab === 'equipos'
            ? <button onClick={openCreateEquipo} className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition">+ Nuevo equipo</button>
            : <button onClick={() => openCreateOrden(null)} className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition">+ Nueva orden</button>
          }
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Operativos</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{equiposOperativos}</p>
        </div>
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700">En Mantenimiento</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{equiposEnMante}</p>
        </div>
        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-700">Órdenes Pendientes</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{ordenesPendientes}</p>
        </div>
        <div className="rounded-[20px] border border-sky-200 bg-sky-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-700">En Proceso</p>
          <p className="mt-1 text-2xl font-bold text-sky-900">{ordenesEnProceso}</p>
        </div>
      </div>

      {/* Filtros + Tabs */}
      <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] px-5 py-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)] space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresa</label>
            <select className={inputClass()} value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}>
              <option value="">Seleccionar...</option>
              {companies.map((c) => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Estatus</label>
            <select className={inputClass()} value={filterEstatus} onChange={(e) => setFilterEstatus(e.target.value)}>
              <option value="">Todos</option>
              {(tab === 'equipos' ? ESTATUS_EQUIPO : ESTATUS_ORDEN).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {tab === 'ordenes' && (
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Tipo</label>
              <select className={inputClass()} value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
                <option value="">Todos</option>
                {TIPOS_ORDEN.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          <div className={tab === 'ordenes' ? '' : 'md:col-span-2'}>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Buscar</label>
            <input className={inputClass()} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, equipo, técnico..." />
          </div>
        </div>

        {/* Pill tabs */}
        <div className="flex gap-1 rounded-[16px] border border-[#dce4f0] bg-white/80 p-1 shadow-[0_2px_8px_rgba(15,45,93,0.05)] w-fit">
          {[['equipos', 'Equipos'], ['ordenes', 'Órdenes']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setFilterEstatus(''); setSearch(''); }}
              className={`rounded-[12px] px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.25)]' : 'text-slate-600 hover:bg-white/80'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla Equipos */}
      {tab === 'equipos' && (
        loading ? (
          <div className="flex items-center justify-center py-16"><div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" /></div>
        ) : filteredEquipos.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No hay equipos registrados.</p>
        ) : (
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["Equipo","Categoría","Ubicación","Responsable","Estatus","Órdenes","Acciones"].map((col, i) => (
                      <th key={col} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i === 5 ? 'text-right' : i === 6 ? 'text-right' : ''}`}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEquipos.map((equipo) => (
                    <tr key={equipo.Equipo_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="px-4 py-3 pl-6">
                        <div className="text-sm font-medium text-slate-800">{equipo.Nombre}</div>
                        {equipo.NumeroSerie && <div className="text-xs text-slate-500">S/N: {equipo.NumeroSerie}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{equipo.Categoria || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{equipo.Ubicacion || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{equipo.ResponsableNombre || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTATUS_EQUIPO_STYLE[equipo.Estatus] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                          {equipo.Estatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-slate-800">{equipo.TotalOrdenes}</span>
                        {equipo.OrdenesActivas > 0 && <span className="ml-1 text-xs text-amber-600">({equipo.OrdenesActivas} activas)</span>}
                      </td>
                      <td className="px-4 py-3 pr-6">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setTab('ordenes'); openCreateOrden(equipo); }} className="rounded-[9px] border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition">+ Orden</button>
                          <button onClick={() => openEditEquipo(equipo)} className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2.5 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition">Editar</button>
                          <button onClick={() => handleDeleteEquipo(equipo)} className="rounded-[9px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">Quitar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Tabla Órdenes */}
      {tab === 'ordenes' && (
        loading ? (
          <div className="flex items-center justify-center py-16"><div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" /></div>
        ) : filteredOrdenes.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No hay órdenes registradas.</p>
        ) : (
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["Orden","Equipo","Técnico","Tipo","Programada","Estatus","Costo","Acciones"].map((col, i) => (
                      <th key={col} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i === 6 ? 'text-right' : i === 7 ? 'text-right' : ''}`}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrdenes.map((orden) => (
                    <tr key={orden.Orden_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="px-4 py-3 pl-6">
                        <div className="text-sm font-medium text-slate-800">{orden.Titulo}</div>
                        {orden.Descripcion && <div className="text-xs text-slate-500 truncate max-w-xs">{orden.Descripcion}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-700">{orden.EquipoNombre}</div>
                        {orden.EquipoCategoria && <div className="text-xs text-slate-500">{orden.EquipoCategoria}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{orden.TecnicoNombre || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIPO_STYLE[orden.Tipo] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>{orden.Tipo}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{toDate(orden.FechaProgramada)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTATUS_ORDEN_STYLE[orden.Estatus] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>{orden.Estatus}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700">{orden.Costo != null ? toCurrency(orden.Costo) : '—'}</td>
                      <td className="px-4 py-3 pr-6">
                        <div className="flex justify-end gap-2">
                          {orden.Estatus === 'PENDIENTE' && (
                            <button onClick={() => handleIniciarOrden(orden)} className="rounded-[9px] border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition">Iniciar</button>
                          )}
                          {(orden.Estatus === 'PENDIENTE' || orden.Estatus === 'EN_PROCESO') && (
                            <button onClick={() => openCompletarOrden(orden)} className="rounded-[9px] border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">Completar</button>
                          )}
                          {orden.Estatus !== 'COMPLETADO' && (
                            <button onClick={() => openEditOrden(orden)} className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2.5 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition">Editar</button>
                          )}
                          {orden.Estatus !== 'COMPLETADO' && (
                            <button onClick={() => handleDeleteOrden(orden)} className="rounded-[9px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">Quitar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Modal Equipo */}
      {showEquipoModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">{editingEquipo ? 'Editar equipo' : 'Nuevo equipo'}</h3>
              <button onClick={() => setShowEquipoModal(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white">
            <form onSubmit={handleSaveEquipo} className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Empresa</label>
                <select className={inputClass()} value={formEquipo.Company_Id} onChange={(e) => setFormEquipo((p) => ({ ...p, Company_Id: e.target.value }))} required>
                  <option value="">Seleccionar...</option>
                  {companies.map((c) => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estatus</label>
                <select className={inputClass()} value={formEquipo.Estatus} onChange={(e) => setFormEquipo((p) => ({ ...p, Estatus: e.target.value }))}>
                  {ESTATUS_EQUIPO.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input className={inputClass()} value={formEquipo.Nombre} onChange={(e) => setFormEquipo((p) => ({ ...p, Nombre: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                <select className={inputClass()} value={formEquipo.Categoria} onChange={(e) => setFormEquipo((p) => ({ ...p, Categoria: e.target.value }))}>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Número de Serie</label>
                <input className={inputClass()} value={formEquipo.NumeroSerie} onChange={(e) => setFormEquipo((p) => ({ ...p, NumeroSerie: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ubicación</label>
                <input className={inputClass()} value={formEquipo.Ubicacion} onChange={(e) => setFormEquipo((p) => ({ ...p, Ubicacion: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Responsable</label>
                <select className={inputClass()} value={formEquipo.Responsable_Id} onChange={(e) => setFormEquipo((p) => ({ ...p, Responsable_Id: e.target.value }))}>
                  <option value="">Sin responsable</option>
                  {users.map((u) => <option key={u.User_Id} value={u.User_Id}>{`${u.Name || ''} ${u.Lastname || ''}`.trim() || u.Username}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Instalación</label>
                <input type="date" className={inputClass()} value={formEquipo.FechaInstalacion} onChange={(e) => setFormEquipo((p) => ({ ...p, FechaInstalacion: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                <textarea rows={3} className={`${inputClass()} resize-none`} value={formEquipo.Notas} onChange={(e) => setFormEquipo((p) => ({ ...p, Notas: e.target.value }))} />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowEquipoModal(false)} className="rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition">{saving ? 'Guardando...' : (editingEquipo ? 'Guardar' : 'Crear')}</button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Orden */}
      {showOrdenModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">{editingOrden ? 'Editar orden' : 'Nueva orden de mantenimiento'}</h3>
              <button onClick={() => setShowOrdenModal(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white">
            <form onSubmit={handleSaveOrden} className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select className={inputClass()} value={formOrden.Tipo} onChange={(e) => setFormOrden((p) => ({ ...p, Tipo: e.target.value }))}>
                  {TIPOS_ORDEN.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Equipo *</label>
                <select className={inputClass()} value={formOrden.Equipo_Id} onChange={(e) => setFormOrden((p) => ({ ...p, Equipo_Id: e.target.value }))} required>
                  <option value="">Seleccionar...</option>
                  {equipos.map((e) => <option key={e.Equipo_Id} value={e.Equipo_Id}>{e.Nombre}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
                <input className={inputClass()} value={formOrden.Titulo} onChange={(e) => setFormOrden((p) => ({ ...p, Titulo: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Técnico</label>
                <select className={inputClass()} value={formOrden.Tecnico_Id} onChange={(e) => setFormOrden((p) => ({ ...p, Tecnico_Id: e.target.value }))}>
                  <option value="">Sin asignar</option>
                  {users.map((u) => <option key={u.User_Id} value={u.User_Id}>{`${u.Name || ''} ${u.Lastname || ''}`.trim() || u.Username}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Programada</label>
                <input type="date" className={inputClass()} value={formOrden.FechaProgramada} onChange={(e) => setFormOrden((p) => ({ ...p, FechaProgramada: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Costo estimado</label>
                <input type="number" min="0" step="0.01" className={inputClass()} value={formOrden.Costo} onChange={(e) => setFormOrden((p) => ({ ...p, Costo: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <textarea rows={3} className={`${inputClass()} resize-none`} value={formOrden.Descripcion} onChange={(e) => setFormOrden((p) => ({ ...p, Descripcion: e.target.value }))} />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowOrdenModal(false)} className="rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition">{saving ? 'Guardando...' : (editingOrden ? 'Guardar' : 'Crear')}</button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Completar */}
      {showCompletarModal && completarOrden && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Completar orden</h3>
                <p className="text-xs text-blue-200">"{completarOrden.Titulo}"</p>
              </div>
              <button onClick={() => setShowCompletarModal(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white p-6">
              <div className="mb-4">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Costo final (opcional)</label>
                <input type="number" min="0" step="0.01" className={inputClass()} value={completarCosto} onChange={(e) => setCompletarCosto(e.target.value)} placeholder="0.00" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCompletarOrden} disabled={saving} className="flex-1 rounded-[12px] bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(5,150,105,0.25)] disabled:opacity-50 transition">{saving ? 'Guardando...' : 'Completar'}</button>
                <button onClick={() => setShowCompletarModal(false)} className="flex-1 rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
