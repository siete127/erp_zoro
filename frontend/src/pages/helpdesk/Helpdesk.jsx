import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { notify } from "../../services/notify";

const PRIORIDADES = ["", "baja", "media", "alta", "critica"];
const ESTADOS = ["", "abierto", "en_progreso", "resuelto", "cerrado"];

const PRIO_BADGE = {
  critica: "border-rose-300 bg-rose-100 text-rose-900",
  alta:    "border-rose-200 bg-rose-50 text-rose-700",
  media:   "border-amber-200 bg-amber-50 text-amber-700",
  baja:    "border-emerald-200 bg-emerald-50 text-emerald-700",
};
const ESTADO_BADGE = {
  cerrado:     "border-emerald-200 bg-emerald-50 text-emerald-700",
  resuelto:    "border-emerald-200 bg-emerald-50 text-emerald-700",
  en_progreso: "border-blue-200 bg-blue-50 text-blue-700",
  abierto:     "border-slate-200 bg-slate-50 text-slate-600",
};

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

export default function Helpdesk() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [modalNuevo, setModalNuevo] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState({ Titulo: "", Descripcion: "", Prioridad: "media", Categoria: "", Client_Id: "" });
  const [creando, setCreando] = useState(false);
  const navigate = useNavigate();

  const cargar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.append("estado", filtroEstado);
      if (filtroPrioridad) params.append("prioridad", filtroPrioridad);
      const res = await api.get(`/helpdesk?${params}`);
      setTickets(res.data.items || []);
    } catch {
      notify("Error al cargar tickets", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [filtroEstado, filtroPrioridad]);
  useEffect(() => { api.get("/clients").then(r => setClientes(r.data.data || [])).catch(() => {}); }, []);

  const handleCrear = async (e) => {
    e.preventDefault();
    setCreando(true);
    try {
      await api.post("/helpdesk", { ...form, Client_Id: form.Client_Id ? Number(form.Client_Id) : null });
      notify("Ticket creado", "success");
      setModalNuevo(false);
      setForm({ Titulo: "", Descripcion: "", Prioridad: "media", Categoria: "", Client_Id: "" });
      cargar();
    } catch {
      notify("Error al crear ticket", "error");
    } finally {
      setCreando(false);
    }
  };

  const abiertos = tickets.filter(t => t.Estado === "abierto").length;
  const enProgreso = tickets.filter(t => t.Estado === "en_progreso").length;

  const FilterPill = ({ active, onClick, label }) => (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active
          ? "border-[#1b3d86] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.20)]"
          : "border-[#dce4f0] bg-white text-slate-600 hover:border-[#3b6fd4]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Soporte</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Helpdesk</h1>
            <p className="text-sm text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
              Gestión de tickets de soporte al cliente
              {abiertos > 0 && (
                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                  {abiertos} abierto{abiertos > 1 ? "s" : ""}
                </span>
              )}
              {enProgreso > 0 && (
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {enProgreso} en progreso
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setModalNuevo(true)}
            className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition"
          >
            + Nuevo ticket
          </button>
        </div>

        {/* Filtros */}
        <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] px-5 py-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)] space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96] w-16">Estado:</span>
            {ESTADOS.map(e => (
              <FilterPill key={e || "todos-e"} active={filtroEstado === e} onClick={() => setFiltroEstado(e)} label={e || "Todos"} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96] w-16">Prioridad:</span>
            {PRIORIDADES.map(p => (
              <FilterPill key={p || "todos-p"} active={filtroPrioridad === p} onClick={() => setFiltroPrioridad(p)} label={p || "Todos"} />
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">No hay tickets registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["#","Título","Cliente","Categoría","Prioridad","Estado","Asignado","Fecha"].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr
                      key={t.Ticket_Id}
                      onClick={() => navigate(`/helpdesk/${t.Ticket_Id}`)}
                      className="border-t border-[#eaf0fa] cursor-pointer transition hover:bg-[#f4f7ff]/60"
                    >
                      <td className="px-4 py-3 pl-6 text-sm text-slate-400">#{t.Ticket_Id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-xs">
                        <p className="truncate">{t.Titulo}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{t.ClienteNombre || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{t.Categoria || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${PRIO_BADGE[t.Prioridad] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                          {t.Prioridad}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTADO_BADGE[t.Estado] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                          {t.Estado?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{t.AsignadoNombre || "Sin asignar"}</td>
                      <td className="px-4 py-3 pr-6 text-sm text-slate-500">
                        {t.FechaCreacion ? new Date(t.FechaCreacion).toLocaleDateString("es-MX") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modal nuevo ticket */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Nuevo ticket de soporte</h3>
              <button onClick={() => setModalNuevo(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white p-6">
              <form onSubmit={handleCrear} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Título *</label>
                  <input required value={form.Titulo} onChange={e => setForm({...form, Titulo: e.target.value})}
                    className={premiumField} placeholder="Describe brevemente el problema" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Prioridad</label>
                    <select value={form.Prioridad} onChange={e => setForm({...form, Prioridad: e.target.value})} className={premiumField}>
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="critica">Crítica</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Categoría</label>
                    <input value={form.Categoria} onChange={e => setForm({...form, Categoria: e.target.value})}
                      className={premiumField} placeholder="Ej. Facturación, Envíos..." />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Cliente</label>
                  <select value={form.Client_Id} onChange={e => setForm({...form, Client_Id: e.target.value})} className={premiumField}>
                    <option value="">Sin cliente</option>
                    {clientes.map(c => <option key={c.Client_Id} value={c.Client_Id}>{c.LegalName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Descripción</label>
                  <textarea value={form.Descripcion} onChange={e => setForm({...form, Descripcion: e.target.value})}
                    rows={3} className={premiumField} placeholder="Describe el problema con más detalle..." />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={creando}
                    className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition">
                    {creando ? "Creando..." : "Crear ticket"}
                  </button>
                  <button type="button" onClick={() => setModalNuevo(false)}
                    className="flex-1 rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
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
