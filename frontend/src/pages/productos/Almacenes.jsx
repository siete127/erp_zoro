import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';
import {
  operationContainerClass,
  operationFieldClass,
  operationPageClass,
  operationPrimaryButtonClass,
  operationSectionClass,
  operationTableShellClass,
  OperationHeader,
  OperationSectionTitle,
  OperationStat,
} from '../../components/operation/OperationUI';

const premiumFieldClass = operationFieldClass;

const premiumSectionClass =
  "rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,253,0.96))] p-5 shadow-[0_8px_24px_rgba(15,45,93,0.07)]";

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

export default function Almacenes() {
  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ Nombre: '', Codigo: '', Direccion: '', Activo: true, Company_Id: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [viewDetail, setViewDetail] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubForm, setUbForm] = useState({ pasillo: '', estante: '', posicion: '', codigo: '' });
  const [editingUb, setEditingUb] = useState(null);
  const [showUbForm, setShowUbForm] = useState(false);
  const [savingUb, setSavingUb] = useState(false);

  const fetchUbicaciones = async (almacenId) => {
    try {
      const res = await api.get(`/almacenes/${almacenId}/ubicaciones`);
      setUbicaciones(res.data?.data || []);
    } catch {
      setUbicaciones([]);
    }
  };

  const openViewDetail = (a) => {
    setViewDetail(a);
    setShowUbForm(false);
    setEditingUb(null);
    setUbForm({ pasillo: '', estante: '', posicion: '', codigo: '' });
    fetchUbicaciones(a.Almacen_Id);
  };

  const handleUbSubmit = async (e) => {
    e.preventDefault();
    setSavingUb(true);
    try {
      if (editingUb) {
        await api.put(`/almacenes/ubicaciones/${editingUb.Ubicacion_Id}`, ubForm);
        notify('Ubicacion actualizada', 'success');
      } else {
        await api.post(`/almacenes/${viewDetail.Almacen_Id}/ubicaciones`, ubForm);
        notify('Ubicacion creada', 'success');
      }
      setShowUbForm(false);
      setEditingUb(null);
      setUbForm({ pasillo: '', estante: '', posicion: '', codigo: '' });
      await fetchUbicaciones(viewDetail.Almacen_Id);
    } catch (err) {
      notify(err?.response?.data?.detail || 'Error al guardar ubicacion', 'error');
    } finally {
      setSavingUb(false);
    }
  };

  const handleEditUb = (u) => {
    setEditingUb(u);
    setUbForm({ pasillo: u.Pasillo || '', estante: u.Estante || '', posicion: u.Posicion || '', codigo: u.Codigo || '' });
    setShowUbForm(true);
  };

  const handleDeleteUb = async (ubId) => {
    const ok = await confirm('Eliminar esta ubicacion?', 'Eliminar', 'Eliminar', 'Cancelar');
    if (!ok) return;
    try {
      await api.delete(`/almacenes/ubicaciones/${ubId}`);
      notify('Ubicacion eliminada', 'success');
      await fetchUbicaciones(viewDetail.Almacen_Id);
    } catch {
      notify('Error al eliminar ubicacion', 'error');
    }
  };

  const fetchAlmacenes = async () => {
    setLoading(true);
    try {
      const url = selectedCompany === 'all' ? '/almacenes' : `/almacenes?company_id=${selectedCompany}`;
      const res = await api.get(url);
      setAlmacenes(res.data || []);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error cargando almacenes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlmacenes(); }, [selectedCompany]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await api.get('/companies/');
        setCompanies(res.data || []);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setUserRole(user.RolId);
      } catch { /* ignore */ }
    };
    fetchCompanies();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData({ Nombre: '', Codigo: '', Direccion: '', Activo: true, Company_Id: '' });
    setModalOpen(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setFormData({
      Nombre: a.Nombre || '', Codigo: a.Codigo || '', Direccion: a.Direccion || '',
      Activo: a.Activo === false ? false : true, Company_Id: a.Company_Id || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing?.Almacen_Id) {
        await api.put(`/almacenes/${editing.Almacen_Id}`, formData);
        notify('Almacen actualizado', 'success');
      } else {
        await api.post('/almacenes', formData);
        notify('Almacen creado', 'success');
      }
      setModalOpen(false);
      setEditing(null);
      await fetchAlmacenes();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al guardar almacen', 'error');
    }
  };

  const removeAlmacen = async (a) => {
    const ok = await confirm(
      `Eliminar permanentemente el almacen ${a.Nombre}? Esta accion no se puede deshacer.`,
      'Eliminar almacen', 'Eliminar', 'Cancelar'
    );
    if (!ok) return;
    try {
      await api.delete(`/almacenes/${a.Almacen_Id}`);
      notify('Almacen eliminado', 'success');
      await fetchAlmacenes();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al eliminar almacen', 'error');
    }
  };

  const filtered = almacenes.filter((a) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (a.Nombre || '').toLowerCase().includes(q) || (a.Codigo || '').toLowerCase().includes(q);
  });

  const tinyField = "w-full rounded-[10px] border border-[#dce4f0] bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/15";

  return (
    <div className={operationPageClass}>
      <div className={operationContainerClass}>
        <OperationHeader
          eyebrow="Operacion"
          title="Almacenes"
          description="Gestion de bodegas, sucursales y ubicaciones internas del flujo operativo."
          actions={<button onClick={openCreate} className={operationPrimaryButtonClass}>Nuevo almacen</button>}
          stats={
            <>
              <OperationStat label="Almacenes visibles" value={filtered.length} tone="blue" />
              <OperationStat label="Empresa filtro" value={selectedCompany === 'all' ? 'Todas' : String(selectedCompany)} tone="slate" />
            </>
          }
        />

        {/* Filter bar */}
        <div className={operationSectionClass}>
          <OperationSectionTitle eyebrow="Busqueda" title="Filtrar almacenes" description="Consulta por empresa, nombre o codigo." />
          <div className="flex flex-col sm:flex-row gap-3">
            {(userRole === 1 || userRole === 2) && (
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className={`sm:w-56 ${premiumFieldClass}`}
              >
                <option value="all">Todas las empresas</option>
                {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
              </select>
            )}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o codigo..."
              className={`flex-1 ${premiumFieldClass}`}
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-[22px] bg-slate-200/60" />
            ))}
          </div>
        ) : (
          <div className={operationTableShellClass}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    <th className="py-3 pl-5 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96]">Nombre</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-32">Codigo</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96]">Direccion</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-24 text-center">Activo</th>
                    <th className="py-3 pr-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-48 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 px-5 text-sm text-slate-400 text-center">
                        No hay almacenes registrados.
                      </td>
                    </tr>
                  )}
                  {filtered.map((a) => (
                    <tr key={a.Almacen_Id} className="border-t border-[#eaf0fa] hover:bg-[#f5f8fe] transition-colors">
                      <td className="py-3.5 pl-5 pr-4 text-slate-800 font-medium text-sm">{a.Nombre}</td>
                      <td className="py-3.5 pr-4 text-slate-500 text-xs font-mono">{a.Codigo}</td>
                      <td className="py-3.5 pr-4 text-slate-600 text-sm">{a.Direccion || '-'}</td>
                      <td className="py-3.5 pr-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${a.Activo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                          {a.Activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-3.5 pr-5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => openViewDetail(a)} className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                            Ver
                          </button>
                          <button onClick={() => openEdit(a)} className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors">
                            Editar
                          </button>
                          <button onClick={() => removeAlmacen(a)} className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {viewDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] shadow-[0_32px_80px_rgba(15,45,93,0.28)]">
            <div className="shrink-0 bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-200/80">Inventario</p>
                  <h3 className="mt-0.5 text-xl font-bold text-white">{viewDetail.Nombre}</h3>
                  <p className="mt-1 text-sm text-blue-100/70">{viewDetail.Codigo}</p>
                </div>
                <button onClick={() => setViewDetail(null)} className="ml-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-lg leading-none">
                  {"\u00d7"}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#f4f7fc] p-5 space-y-4">
              <div className={premiumSectionClass}>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96] mb-3">Datos</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Empresa</p><p className="text-slate-800 font-medium">{viewDetail.NameCompany || '-'}</p></div>
                  <div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Activo</p><p className="text-slate-800 font-medium">{viewDetail.Activo ? 'Si' : 'No'}</p></div>
                  <div className="col-span-2"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Direccion</p><p className="text-slate-800 font-medium">{viewDetail.Direccion || '-'}</p></div>
                  <div className="col-span-2"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Fecha de creacion</p><p className="text-slate-800 font-medium">{viewDetail.FechaCreacion ? new Date(viewDetail.FechaCreacion).toLocaleString('es-MX') : '-'}</p></div>
                </div>
              </div>

              {/* Ubicaciones */}
              <div className={premiumSectionClass}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Ubicaciones (pasillos / estantes)</p>
                  <button
                    onClick={() => { setEditingUb(null); setUbForm({ pasillo: '', estante: '', posicion: '', codigo: '' }); setShowUbForm(v => !v); }}
                    className="px-3 py-1.5 rounded-[10px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white text-xs font-semibold shadow-[0_2px_8px_rgba(27,61,134,0.2)] hover:shadow-[0_4px_14px_rgba(27,61,134,0.3)] transition-shadow"
                  >
                    + Nueva
                  </button>
                </div>

                {showUbForm && (
                  <form onSubmit={handleUbSubmit} className="mb-4 rounded-[18px] border border-[#dce4f0] bg-[#f8fafc] p-4 grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Pasillo</label>
                      <input className={tinyField} value={ubForm.pasillo} onChange={e => setUbForm(f => ({ ...f, pasillo: e.target.value }))} placeholder="Ej. A" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Estante</label>
                      <input className={tinyField} value={ubForm.estante} onChange={e => setUbForm(f => ({ ...f, estante: e.target.value }))} placeholder="Ej. 01" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Posicion</label>
                      <input className={tinyField} value={ubForm.posicion} onChange={e => setUbForm(f => ({ ...f, posicion: e.target.value }))} placeholder="Ej. P3" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Codigo</label>
                      <input className={tinyField} value={ubForm.codigo} onChange={e => setUbForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ej. A-01-P3" />
                    </div>
                    <div className="col-span-2 flex gap-2 justify-end">
                      <button type="button" onClick={() => setShowUbForm(false)} className="px-3 py-1.5 rounded-[10px] border border-[#dce4f0] bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                      <button type="submit" disabled={savingUb} className="px-3 py-1.5 rounded-[10px] bg-[#1b3d86] text-white text-xs font-semibold disabled:opacity-50 transition-colors">
                        {savingUb ? 'Guardando...' : editingUb ? 'Actualizar' : 'Crear'}
                      </button>
                    </div>
                  </form>
                )}

                {ubicaciones.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin ubicaciones registradas.</p>
                ) : (
                  <div className="overflow-x-auto rounded-[16px] border border-[#eaf0fa] overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#eaf0fa] bg-[#f8fafc]">
                          <th className="py-2 px-3 text-left font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Pasillo</th>
                          <th className="py-2 px-3 text-left font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Estante</th>
                          <th className="py-2 px-3 text-left font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Posicion</th>
                          <th className="py-2 px-3 text-left font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Codigo</th>
                          <th className="py-2 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ubicaciones.map(u => (
                          <tr key={u.Ubicacion_Id} className="border-t border-[#eaf0fa] hover:bg-[#f5f8fe] transition-colors">
                            <td className="py-2 px-3 text-slate-700 font-medium">{u.Pasillo}</td>
                            <td className="py-2 px-3 text-slate-700">{u.Estante}</td>
                            <td className="py-2 px-3 text-slate-500">{u.Posicion || '-'}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{u.Codigo || '-'}</td>
                            <td className="py-2 px-3 flex gap-2">
                              <button onClick={() => handleEditUb(u)} className="text-blue-600 hover:underline text-xs font-medium">Editar</button>
                              <button onClick={() => handleDeleteUb(u.Ubicacion_Id)} className="text-red-600 hover:underline text-xs font-medium">Eliminar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 border-t border-[#eaf0fa] bg-white px-5 py-3.5 flex justify-end gap-2">
              <button onClick={() => { setViewDetail(null); openEdit(viewDetail); }} className="px-4 py-2 rounded-[12px] border border-[#dce4f0] bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors">
                Editar
              </button>
              <button onClick={() => setViewDetail(null)} className="px-4 py-2 rounded-[12px] bg-[#1b3d86] text-white text-sm font-semibold hover:bg-[#2a5fc4] transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] shadow-[0_32px_80px_rgba(15,45,93,0.28)]">
            <div className="shrink-0 bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-200/80">Inventario</p>
                  <h3 className="mt-0.5 text-xl font-bold text-white">{editing ? 'Editar almacen' : 'Nuevo almacen'}</h3>
                </div>
                <button onClick={() => { setModalOpen(false); setEditing(null); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-lg leading-none">
                  {"\u00d7"}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#f4f7fc] p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Nombre *">
                  <input type="text" value={formData.Nombre} onChange={(e) => setFormData({ ...formData, Nombre: e.target.value })} required className={premiumFieldClass} />
                </Field>
                <Field label="Codigo *">
                  <input type="text" value={formData.Codigo} onChange={(e) => setFormData({ ...formData, Codigo: e.target.value })} required className={premiumFieldClass} />
                </Field>
                <Field label="Direccion">
                  <textarea value={formData.Direccion} onChange={(e) => setFormData({ ...formData, Direccion: e.target.value })} rows={2} className={`${premiumFieldClass} resize-none`} />
                </Field>
                <Field label="Empresa">
                  <select value={formData.Company_Id} onChange={(e) => setFormData({ ...formData, Company_Id: e.target.value })} className={premiumFieldClass}>
                    <option value="">Seleccionar empresa</option>
                    {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                  </select>
                </Field>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="activoCheck" checked={formData.Activo} onChange={(e) => setFormData({ ...formData, Activo: e.target.checked })} className="h-4 w-4 rounded accent-[#1b3d86]" />
                  <label htmlFor="activoCheck" className="text-sm font-medium text-slate-700">Activo</label>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 py-2.5 rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white text-sm font-semibold shadow-[0_4px_14px_rgba(27,61,134,0.3)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.4)] transition-shadow">
                    Guardar
                  </button>
                  <button type="button" onClick={() => { setModalOpen(false); setEditing(null); }} className="flex-1 py-2.5 rounded-[14px] border border-[#dce4f0] bg-white text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
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
