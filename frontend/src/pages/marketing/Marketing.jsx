import React, { useEffect, useState, useCallback } from "react";
import { FaEnvelope, FaList, FaPaperPlane, FaPlus, FaTrash, FaUsers } from "react-icons/fa";
import { getApiBase } from "../../services/runtimeConfig";

const apiBase = () => getApiBase();
const tok = () => localStorage.getItem("token");
const hdr = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${tok()}` });

const ESTADO_BADGE = {
  borrador: 'border-slate-200 bg-slate-50 text-slate-600',
  enviando: 'border-amber-200 bg-amber-50 text-amber-700',
  enviada:  'border-emerald-200 bg-emerald-50 text-emerald-700',
  error:    'border-rose-200 bg-rose-50 text-rose-700',
};

const fieldCls = 'w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20';
const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]';

export default function Marketing() {
  const [tab, setTab] = useState("listas");
  const [listas, setListas] = useState([]);
  const [campanas, setCampanas] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [listaActiva, setListaActiva] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState("");

  const fetchListas = useCallback(async () => {
    const r = await fetch(`${apiBase()}/marketing/listas`, { headers: hdr() });
    const d = await r.json();
    setListas(d.items || []);
  }, []);

  const fetchCampanas = useCallback(async () => {
    const r = await fetch(`${apiBase()}/marketing/campanas`, { headers: hdr() });
    const d = await r.json();
    setCampanas(d.items || []);
  }, []);

  const fetchContactos = useCallback(async (lid) => {
    const r = await fetch(`${apiBase()}/marketing/listas/${lid}/contactos`, { headers: hdr() });
    const d = await r.json();
    setContactos(d.items || []);
  }, []);

  useEffect(() => { fetchListas(); fetchCampanas(); }, [fetchListas, fetchCampanas]);
  useEffect(() => { if (listaActiva) fetchContactos(listaActiva.Lista_Id); }, [listaActiva, fetchContactos]);

  const openLista = (l) => { setListaActiva(l); setTab("contactos"); };

  const deleteLista = async (id) => {
    if (!window.confirm("¿Eliminar lista y todos sus contactos?")) return;
    await fetch(`${apiBase()}/marketing/listas/${id}`, { method: "DELETE", headers: hdr() });
    fetchListas();
    if (listaActiva?.Lista_Id === id) { setListaActiva(null); setTab("listas"); }
  };

  const deleteCampana = async (id) => {
    if (!window.confirm("¿Eliminar campaña?")) return;
    await fetch(`${apiBase()}/marketing/campanas/${id}`, { method: "DELETE", headers: hdr() });
    fetchCampanas();
  };

  const enviarCampana = async (id) => {
    if (!window.confirm("¿Iniciar envío de la campaña?")) return;
    setMsg("");
    const r = await fetch(`${apiBase()}/marketing/campanas/${id}/enviar`, { method: "POST", headers: hdr() });
    const d = await r.json();
    setMsg(d.message || d.error || "");
    fetchCampanas();
  };

  const removeContacto = async (cid) => {
    await fetch(`${apiBase()}/marketing/listas/${listaActiva.Lista_Id}/contactos/${cid}`, { method: "DELETE", headers: hdr() });
    fetchContactos(listaActiva.Lista_Id);
    fetchListas();
  };

  const submit = async () => {
    setLoading(true);
    try {
      if (modal === "lista") {
        await fetch(`${apiBase()}/marketing/listas`, { method: "POST", headers: hdr(), body: JSON.stringify(form) });
        fetchListas();
      } else if (modal === "campana") {
        await fetch(`${apiBase()}/marketing/campanas`, { method: "POST", headers: hdr(), body: JSON.stringify(form) });
        fetchCampanas();
      } else if (modal === "contacto") {
        await fetch(`${apiBase()}/marketing/listas/${listaActiva.Lista_Id}/contactos`, { method: "POST", headers: hdr(), body: JSON.stringify(form) });
        fetchContactos(listaActiva.Lista_Id);
        fetchListas();
      }
      setModal(null); setForm({});
    } finally { setLoading(false); }
  };

  const TABS = [
    { key: "listas",   label: "Listas",   icon: <FaList className="shrink-0" /> },
    { key: "campanas", label: "Campañas", icon: <FaPaperPlane className="shrink-0" /> },
    ...(listaActiva ? [{ key: "contactos", label: listaActiva.Nombre, icon: <FaUsers className="shrink-0" /> }] : []),
  ];

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Módulo</p>
            <h1 className="flex items-center gap-2 text-xl font-bold text-[#0d1f3c]">
              <FaEnvelope className="text-[#3b6fd4]" /> Email Marketing
            </h1>
          </div>
          <div className="flex gap-2">
            {tab === "listas" && (
              <button
                onClick={() => { setModal("lista"); setForm({}); }}
                className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] hover:shadow-[0_6px_18px_rgba(27,61,134,0.38)] transition flex items-center gap-1.5"
              >
                <FaPlus className="text-xs" /> Nueva lista
              </button>
            )}
            {tab === "campanas" && (
              <button
                onClick={() => { setModal("campana"); setForm({}); }}
                className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] hover:shadow-[0_6px_18px_rgba(27,61,134,0.38)] transition flex items-center gap-1.5"
              >
                <FaPlus className="text-xs" /> Nueva campaña
              </button>
            )}
            {tab === "contactos" && (
              <button
                onClick={() => { setModal("contacto"); setForm({}); }}
                className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] hover:shadow-[0_6px_18px_rgba(27,61,134,0.38)] transition flex items-center gap-1.5"
              >
                <FaPlus className="text-xs" /> Agregar contacto
              </button>
            )}
          </div>
        </div>

        {/* Alert msg */}
        {msg && (
          <div className="rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {msg}
          </div>
        )}

        {/* Tab pills */}
        <div className="flex items-center gap-2 rounded-[16px] border border-[#dce4f0] bg-white p-1.5 shadow-[0_2px_8px_rgba(15,45,93,0.06)] w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-[12px] px-4 py-1.5 text-xs font-semibold transition ${
                tab === t.key
                  ? 'bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.20)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* LISTAS */}
        {tab === "listas" && (
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#eaf0fa]">
              <h3 className="text-base font-bold text-[#0d1f3c]">Listas de contactos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["Nombre", "Descripción", "Contactos", "Creada", ""].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listas.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">Sin listas</td></tr>
                  )}
                  {listas.map(l => (
                    <tr key={l.Lista_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td
                        className="px-4 py-3 pl-6 text-sm font-semibold text-[#1b3d86] cursor-pointer hover:underline"
                        onClick={() => openLista(l)}
                      >
                        {l.Nombre}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{l.Descripcion || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          <FaUsers className="text-[10px]" />{l.TotalContactos}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{l.FechaCreacion?.slice(0, 10) || '—'}</td>
                      <td className="px-4 py-3 pr-6 text-right">
                        <button onClick={() => deleteLista(l.Lista_Id)} className="rounded-[9px] border border-rose-200 bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100 transition">
                          <FaTrash className="text-xs" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTACTOS */}
        {tab === "contactos" && listaActiva && (
          <div className="space-y-3">
            <button
              onClick={() => { setTab("listas"); setListaActiva(null); }}
              className="text-[#3b6fd4] text-sm font-medium hover:underline"
            >
              ← Volver a listas
            </button>
            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#eaf0fa]">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Lista</p>
                <h3 className="text-base font-bold text-[#0d1f3c]">{listaActiva.Nombre}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#eaf0fa]">
                      {["Nombre", "Email", "Teléfono", "Empresa", ""].map(col => (
                        <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contactos.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">Sin contactos</td></tr>
                    )}
                    {contactos.map(c => (
                      <tr key={c.Contacto_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                        <td className="px-4 py-3 pl-6 text-sm font-semibold text-slate-800">{c.Nombre}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{c.Email}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{c.Telefono || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{c.Empresa || '—'}</td>
                        <td className="px-4 py-3 pr-6 text-right">
                          <button onClick={() => removeContacto(c.Contacto_Id)} className="rounded-[9px] border border-rose-200 bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100 transition">
                            <FaTrash className="text-xs" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CAMPAÑAS */}
        {tab === "campanas" && (
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#eaf0fa]">
              <h3 className="text-base font-bold text-[#0d1f3c]">Campañas de email</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["Nombre", "Asunto", "Lista", "Estado", "Enviados", "Errores", ""].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campanas.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">Sin campañas</td></tr>
                  )}
                  {campanas.map(c => (
                    <tr key={c.Campana_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="px-4 py-3 pl-6 text-sm font-semibold text-slate-800">{c.Nombre}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{c.Asunto}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{c.ListaNombre || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${ESTADO_BADGE[c.Estado] || ESTADO_BADGE.borrador}`}>
                          {c.Estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-700">{c.TotalEnviados}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-rose-600">{c.TotalErrores}</td>
                      <td className="px-4 py-3 pr-6">
                        <div className="flex items-center justify-end gap-2">
                          {(c.Estado === "borrador" || c.Estado === "error") && (
                            <button
                              onClick={() => enviarCampana(c.Campana_Id)}
                              className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2.5 py-1.5 text-[11px] font-semibold text-[#1b3d86] hover:bg-[#e4ecff] flex items-center gap-1 transition"
                            >
                              <FaPaperPlane className="text-[10px]" /> Enviar
                            </button>
                          )}
                          <button onClick={() => deleteCampana(c.Campana_Id)} className="rounded-[9px] border border-rose-200 bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100 transition">
                            <FaTrash className="text-xs" />
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

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {modal === "lista" ? "Nueva lista" : modal === "campana" ? "Nueva campaña" : "Agregar contacto"}
              </h3>
              <button onClick={() => { setModal(null); setForm({}); }} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white p-6 space-y-4">

              {modal === "lista" && (
                <>
                  <div><label className={labelCls}>Nombre *</label><input className={fieldCls} placeholder="Nombre de la lista" value={form.Nombre || ""} onChange={e => setForm({ ...form, Nombre: e.target.value })} /></div>
                  <div><label className={labelCls}>Descripción</label><input className={fieldCls} placeholder="Descripción (opcional)" value={form.Descripcion || ""} onChange={e => setForm({ ...form, Descripcion: e.target.value })} /></div>
                </>
              )}

              {modal === "campana" && (
                <>
                  <div><label className={labelCls}>Nombre *</label><input className={fieldCls} placeholder="Nombre de la campaña" value={form.Nombre || ""} onChange={e => setForm({ ...form, Nombre: e.target.value })} /></div>
                  <div><label className={labelCls}>Asunto *</label><input className={fieldCls} placeholder="Asunto del correo" value={form.Asunto || ""} onChange={e => setForm({ ...form, Asunto: e.target.value })} /></div>
                  <div>
                    <label className={labelCls}>Lista *</label>
                    <select className={fieldCls} value={form.Lista_Id || ""} onChange={e => setForm({ ...form, Lista_Id: Number(e.target.value) })}>
                      <option value="">Seleccionar lista...</option>
                      {listas.map(l => <option key={l.Lista_Id} value={l.Lista_Id}>{l.Nombre} ({l.TotalContactos} contactos)</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Cuerpo del correo *</label><textarea className={`${fieldCls} min-h-[120px] resize-none`} placeholder="HTML permitido..." value={form.Cuerpo || ""} onChange={e => setForm({ ...form, Cuerpo: e.target.value })} /></div>
                </>
              )}

              {modal === "contacto" && (
                <>
                  <div><label className={labelCls}>Nombre *</label><input className={fieldCls} placeholder="Nombre" value={form.Nombre || ""} onChange={e => setForm({ ...form, Nombre: e.target.value })} /></div>
                  <div><label className={labelCls}>Email *</label><input type="email" className={fieldCls} placeholder="correo@ejemplo.com" value={form.Email || ""} onChange={e => setForm({ ...form, Email: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Teléfono</label><input className={fieldCls} placeholder="Teléfono" value={form.Telefono || ""} onChange={e => setForm({ ...form, Telefono: e.target.value })} /></div>
                    <div><label className={labelCls}>Empresa</label><input className={fieldCls} placeholder="Empresa" value={form.Empresa || ""} onChange={e => setForm({ ...form, Empresa: e.target.value })} /></div>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={submit}
                  disabled={loading}
                  className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition"
                >
                  {loading ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={() => { setModal(null); setForm({}); }}
                  className="flex-1 rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
