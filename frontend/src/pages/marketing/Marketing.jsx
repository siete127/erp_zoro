import React, { useEffect, useState, useCallback } from "react";
import { FaEnvelope, FaList, FaPaperPlane, FaPlus, FaTrash, FaUsers } from "react-icons/fa";
import { getApiBase } from "../../services/runtimeConfig";

const api = () => getApiBase();
const tok = () => localStorage.getItem("token");
const hdr = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${tok()}` });

export default function Marketing() {
  const [tab, setTab] = useState("listas");
  const [listas, setListas] = useState([]);
  const [campanas, setCampanas] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [listaActiva, setListaActiva] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // 'lista' | 'campana' | 'contacto'
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState("");

  const fetchListas = useCallback(async () => {
    const r = await fetch(`${api()}/marketing/listas`, { headers: hdr() });
    const d = await r.json();
    setListas(d.items || []);
  }, []);

  const fetchCampanas = useCallback(async () => {
    const r = await fetch(`${api()}/marketing/campanas`, { headers: hdr() });
    const d = await r.json();
    setCampanas(d.items || []);
  }, []);

  const fetchContactos = useCallback(async (lid) => {
    const r = await fetch(`${api()}/marketing/listas/${lid}/contactos`, { headers: hdr() });
    const d = await r.json();
    setContactos(d.items || []);
  }, []);

  useEffect(() => {
    fetchListas();
    fetchCampanas();
  }, [fetchListas, fetchCampanas]);

  useEffect(() => {
    if (listaActiva) fetchContactos(listaActiva.Lista_Id);
  }, [listaActiva, fetchContactos]);

  const openLista = (l) => { setListaActiva(l); setTab("contactos"); };

  const deleteLista = async (id) => {
    if (!window.confirm("¿Eliminar lista y todos sus contactos?")) return;
    await fetch(`${api()}/marketing/listas/${id}`, { method: "DELETE", headers: hdr() });
    fetchListas();
    if (listaActiva?.Lista_Id === id) { setListaActiva(null); setTab("listas"); }
  };

  const deleteCampana = async (id) => {
    if (!window.confirm("¿Eliminar campaña?")) return;
    await fetch(`${api()}/marketing/campanas/${id}`, { method: "DELETE", headers: hdr() });
    fetchCampanas();
  };

  const enviarCampana = async (id) => {
    if (!window.confirm("¿Iniciar envío de la campaña?")) return;
    setMsg("");
    const r = await fetch(`${api()}/marketing/campanas/${id}/enviar`, { method: "POST", headers: hdr() });
    const d = await r.json();
    setMsg(d.message || d.error || "");
    fetchCampanas();
  };

  const removeContacto = async (cid) => {
    await fetch(`${api()}/marketing/listas/${listaActiva.Lista_Id}/contactos/${cid}`, { method: "DELETE", headers: hdr() });
    fetchContactos(listaActiva.Lista_Id);
    fetchListas();
  };

  const submit = async () => {
    setLoading(true);
    try {
      if (modal === "lista") {
        const r = await fetch(`${api()}/marketing/listas`, { method: "POST", headers: hdr(), body: JSON.stringify(form) });
        await r.json();
        fetchListas();
      } else if (modal === "campana") {
        const r = await fetch(`${api()}/marketing/campanas`, { method: "POST", headers: hdr(), body: JSON.stringify(form) });
        await r.json();
        fetchCampanas();
      } else if (modal === "contacto") {
        const r = await fetch(`${api()}/marketing/listas/${listaActiva.Lista_Id}/contactos`, { method: "POST", headers: hdr(), body: JSON.stringify(form) });
        await r.json();
        fetchContactos(listaActiva.Lista_Id);
        fetchListas();
      }
      setModal(null); setForm({});
    } finally { setLoading(false); }
  };

  const estadoColor = { borrador: "bg-gray-100 text-gray-700", enviando: "bg-yellow-100 text-yellow-700", enviada: "bg-green-100 text-green-700", error: "bg-red-100 text-red-700" };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2"><FaEnvelope /> Email Marketing</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab("listas")} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === "listas" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}><FaList className="inline mr-1" />Listas</button>
          <button onClick={() => setTab("campanas")} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === "campanas" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}><FaPaperPlane className="inline mr-1" />Campañas</button>
          {tab === "listas" && <button onClick={() => { setModal("lista"); setForm({}); }} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm"><FaPlus className="inline mr-1" />Nueva Lista</button>}
          {tab === "campanas" && <button onClick={() => { setModal("campana"); setForm({}); }} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm"><FaPlus className="inline mr-1" />Nueva Campaña</button>}
          {tab === "contactos" && <button onClick={() => { setModal("contacto"); setForm({}); }} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm"><FaPlus className="inline mr-1" />Agregar Contacto</button>}
        </div>
      </div>

      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded text-sm">{msg}</div>}

      {/* LISTAS */}
      {tab === "listas" && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr><th className="px-4 py-3 text-left">Nombre</th><th className="px-4 py-3 text-left">Descripción</th><th className="px-4 py-3 text-center">Contactos</th><th className="px-4 py-3 text-center">Creada</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listas.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin listas</td></tr>}
              {listas.map(l => (
                <tr key={l.Lista_Id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-blue-600 cursor-pointer" onClick={() => openLista(l)}>{l.Nombre}</td>
                  <td className="px-4 py-3 text-gray-500">{l.Descripcion}</td>
                  <td className="px-4 py-3 text-center"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold"><FaUsers className="inline mr-1" />{l.TotalContactos}</span></td>
                  <td className="px-4 py-3 text-center text-gray-500">{l.FechaCreacion?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => deleteLista(l.Lista_Id)} className="text-red-400 hover:text-red-600"><FaTrash /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CONTACTOS */}
      {tab === "contactos" && listaActiva && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button onClick={() => { setTab("listas"); setListaActiva(null); }} className="text-blue-600 text-sm hover:underline">← Listas</button>
            <span className="text-gray-500">/</span>
            <span className="font-medium">{listaActiva.Nombre}</span>
          </div>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr><th className="px-4 py-3 text-left">Nombre</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Teléfono</th><th className="px-4 py-3 text-left">Empresa</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contactos.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin contactos</td></tr>}
                {contactos.map(c => (
                  <tr key={c.Contacto_Id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.Nombre}</td>
                    <td className="px-4 py-3">{c.Email}</td>
                    <td className="px-4 py-3 text-gray-500">{c.Telefono}</td>
                    <td className="px-4 py-3 text-gray-500">{c.Empresa}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => removeContacto(c.Contacto_Id)} className="text-red-400 hover:text-red-600"><FaTrash /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CAMPAÑAS */}
      {tab === "campanas" && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr><th className="px-4 py-3 text-left">Nombre</th><th className="px-4 py-3 text-left">Asunto</th><th className="px-4 py-3 text-left">Lista</th><th className="px-4 py-3 text-center">Estado</th><th className="px-4 py-3 text-center">Enviados</th><th className="px-4 py-3 text-center">Errores</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campanas.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Sin campañas</td></tr>}
              {campanas.map(c => (
                <tr key={c.Campana_Id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.Nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{c.Asunto}</td>
                  <td className="px-4 py-3 text-gray-500">{c.ListaNombre}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${estadoColor[c.Estado] || "bg-gray-100 text-gray-700"}`}>{c.Estado}</span></td>
                  <td className="px-4 py-3 text-center text-green-700 font-medium">{c.TotalEnviados}</td>
                  <td className="px-4 py-3 text-center text-red-600 font-medium">{c.TotalErrores}</td>
                  <td className="px-4 py-3 text-right flex gap-2 justify-end">
                    {(c.Estado === "borrador" || c.Estado === "error") && (
                      <button onClick={() => enviarCampana(c.Campana_Id)} className="text-blue-500 hover:text-blue-700 text-xs flex items-center gap-1"><FaPaperPlane />Enviar</button>
                    )}
                    <button onClick={() => deleteCampana(c.Campana_Id)} className="text-red-400 hover:text-red-600"><FaTrash /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODALES */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-lg font-bold">
              {modal === "lista" ? "Nueva Lista" : modal === "campana" ? "Nueva Campaña" : "Agregar Contacto"}
            </h2>

            {modal === "lista" && <>
              <input className="input" placeholder="Nombre de la lista *" value={form.Nombre || ""} onChange={e => setForm({ ...form, Nombre: e.target.value })} />
              <input className="input" placeholder="Descripción (opcional)" value={form.Descripcion || ""} onChange={e => setForm({ ...form, Descripcion: e.target.value })} />
            </>}

            {modal === "campana" && <>
              <input className="input" placeholder="Nombre de la campaña *" value={form.Nombre || ""} onChange={e => setForm({ ...form, Nombre: e.target.value })} />
              <input className="input" placeholder="Asunto del correo *" value={form.Asunto || ""} onChange={e => setForm({ ...form, Asunto: e.target.value })} />
              <select className="input" value={form.Lista_Id || ""} onChange={e => setForm({ ...form, Lista_Id: Number(e.target.value) })}>
                <option value="">Seleccionar lista *</option>
                {listas.map(l => <option key={l.Lista_Id} value={l.Lista_Id}>{l.Nombre} ({l.TotalContactos} contactos)</option>)}
              </select>
              <textarea className="input min-h-[120px]" placeholder="Cuerpo del correo (HTML permitido) *" value={form.Cuerpo || ""} onChange={e => setForm({ ...form, Cuerpo: e.target.value })} />
            </>}

            {modal === "contacto" && <>
              <input className="input" placeholder="Nombre *" value={form.Nombre || ""} onChange={e => setForm({ ...form, Nombre: e.target.value })} />
              <input className="input" placeholder="Email *" type="email" value={form.Email || ""} onChange={e => setForm({ ...form, Email: e.target.value })} />
              <input className="input" placeholder="Teléfono" value={form.Telefono || ""} onChange={e => setForm({ ...form, Telefono: e.target.value })} />
              <input className="input" placeholder="Empresa" value={form.Empresa || ""} onChange={e => setForm({ ...form, Empresa: e.target.value })} />
            </>}

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => { setModal(null); setForm({}); }} className="px-4 py-2 bg-gray-100 rounded text-sm">Cancelar</button>
              <button onClick={submit} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
