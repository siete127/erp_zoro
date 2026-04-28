import React, { useEffect, useState, useCallback } from "react";
import { FaRecycle, FaPlus, FaTrash, FaTimes, FaBan, FaRedo } from "react-icons/fa";
import { getApiBase } from "../../services/runtimeConfig";

const api = () => getApiBase();
const tok = () => localStorage.getItem("token");
const hdr = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${tok()}` });

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

const ESTADO_BADGE = {
  activa:    "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelada: "border-rose-200 bg-rose-50 text-rose-700",
  vencida:   "border-slate-200 bg-slate-50 text-slate-600",
};

const CICLO_BADGE = {
  mensual: "border-blue-200 bg-blue-50 text-blue-700",
  anual:   "border-violet-200 bg-violet-50 text-violet-700",
};

export default function Suscripciones() {
  const [tab, setTab] = useState("suscripciones");
  const [suscripciones, setSuscripciones] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [selId, setSelId] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSuscripciones = useCallback(async () => {
    const q = estadoFiltro ? `?estado=${estadoFiltro}` : "";
    const r = await fetch(`${api()}/suscripciones${q}`, { headers: hdr() });
    const d = await r.json();
    setSuscripciones(d.items || []);
  }, [estadoFiltro]);

  const fetchPlanes = useCallback(async () => {
    const r = await fetch(`${api()}/suscripciones/planes`, { headers: hdr() });
    const d = await r.json();
    setPlanes(d.items || []);
  }, []);

  const fetchClientes = useCallback(async () => {
    const r = await fetch(`${api()}/clients`, { headers: hdr() });
    const d = await r.json();
    setClientes(d.clients || d.items || []);
  }, []);

  useEffect(() => { fetchSuscripciones(); fetchPlanes(); fetchClientes(); }, [fetchSuscripciones, fetchPlanes, fetchClientes]);

  const submit = async () => {
    setLoading(true);
    try {
      if (modal === "plan") {
        await fetch(`${api()}/suscripciones/planes`, { method: "POST", headers: hdr(), body: JSON.stringify({ ...form, PrecioMensual: Number(form.PrecioMensual), PrecioAnual: form.PrecioAnual ? Number(form.PrecioAnual) : undefined }) });
        fetchPlanes();
      } else if (modal === "suscripcion") {
        await fetch(`${api()}/suscripciones`, { method: "POST", headers: hdr(), body: JSON.stringify({ ...form, Client_Id: Number(form.Client_Id), Plan_Id: Number(form.Plan_Id) }) });
        fetchSuscripciones();
      } else if (modal === "renovar") {
        await fetch(`${api()}/suscripciones/${selId}/renovar`, { method: "PATCH", headers: hdr(), body: JSON.stringify({ FechaInicio: form.FechaInicio }) });
        fetchSuscripciones();
      }
      setModal(null); setForm({}); setSelId(null);
    } finally { setLoading(false); }
  };

  const cancelar = async (id) => {
    if (!window.confirm("¿Cancelar esta suscripción?")) return;
    await fetch(`${api()}/suscripciones/${id}/cancelar`, { method: "PATCH", headers: hdr() });
    fetchSuscripciones();
  };

  const deletePlan = async (id) => {
    if (!window.confirm("¿Desactivar este plan?")) return;
    await fetch(`${api()}/suscripciones/planes/${id}`, { method: "DELETE", headers: hdr() });
    fetchPlanes();
  };

  const diasRestantes = (fecha) => {
    const hoy = new Date();
    const venc = new Date(fecha);
    return Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
  };

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Comercial</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c] flex items-center gap-2">
              <FaRecycle className="text-[#3b6fd4]" /> Suscripciones
            </h1>
            <p className="text-sm text-slate-500">Gestión de planes y suscripciones de clientes</p>
          </div>
          <div className="flex gap-2">
            {tab === "suscripciones" && (
              <button
                onClick={() => { setModal("suscripcion"); setForm({ Ciclo: "mensual", FechaInicio: new Date().toISOString().slice(0, 10) }); }}
                className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition flex items-center gap-1.5"
              >
                <FaPlus className="text-xs" /> Nueva
              </button>
            )}
            {tab === "planes" && (
              <button
                onClick={() => { setModal("plan"); setForm({ Moneda: "MXN" }); }}
                className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition flex items-center gap-1.5"
              >
                <FaPlus className="text-xs" /> Nuevo Plan
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-[16px] border border-[#dce4f0] bg-white/80 p-1 inline-flex gap-1">
          {[{ key: "suscripciones", label: "Suscripciones" }, { key: "planes", label: "Planes" }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-[12px] px-4 py-1.5 text-sm font-semibold transition ${
                tab === key
                  ? "bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.20)]"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "suscripciones" && (
          <div className="space-y-4">
            {/* Estado filter pills */}
            <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] px-5 py-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96] w-16">Estado:</span>
                {["", "activa", "cancelada", "vencida"].map(e => (
                  <button
                    key={e}
                    onClick={() => setEstadoFiltro(e)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      estadoFiltro === e
                        ? "border-[#1b3d86] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.20)]"
                        : "border-[#dce4f0] bg-white text-slate-600 hover:border-[#3b6fd4]"
                    }`}
                  >
                    {e || "Todas"}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#eaf0fa]">
                      {["Cliente", "Plan", "Ciclo", "Estado", "Monto", "Vencimiento", "Acciones"].map(col => (
                        <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {suscripciones.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">Sin suscripciones</td></tr>
                    ) : suscripciones.map(s => {
                      const dias = diasRestantes(s.FechaVencimiento);
                      return (
                        <tr key={s.Suscripcion_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                          <td className="px-4 py-3 pl-6 text-sm font-semibold text-slate-800">{s.ClienteNombre}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{s.PlanNombre}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CICLO_BADGE[s.Ciclo] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                              {s.Ciclo}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTADO_BADGE[s.Estado] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                              {s.Estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                            ${Number(s.MontoProximo || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">{s.Moneda}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-slate-600">{s.FechaVencimiento?.slice(0, 10)}</div>
                            {s.Estado === "activa" && dias <= 30 && (
                              <div className={`text-xs font-semibold ${dias <= 7 ? "text-rose-600" : "text-amber-600"}`}>
                                {dias > 0 ? `${dias}d` : "Vencida"}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 pr-6">
                            {s.Estado !== "cancelada" && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => { setModal("renovar"); setSelId(s.Suscripcion_Id); setForm({ FechaInicio: new Date().toISOString().slice(0, 10) }); }}
                                  className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition flex items-center gap-1"
                                >
                                  <FaRedo className="text-[10px]" /> Renovar
                                </button>
                                <button
                                  onClick={() => cancelar(s.Suscripcion_Id)}
                                  className="rounded-[9px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition flex items-center gap-1"
                                >
                                  <FaBan className="text-[10px]" /> Cancelar
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "planes" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {planes.length === 0 ? (
              <div className="col-span-3 rounded-[24px] border border-white/70 bg-white p-12 text-center text-slate-400 text-sm">
                Sin planes. Crea el primero.
              </div>
            ) : planes.map(p => (
              <div key={p.Plan_Id} className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)] space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-slate-800">{p.Nombre}</h3>
                  <button
                    onClick={() => deletePlan(p.Plan_Id)}
                    className="rounded-[8px] border border-rose-200 bg-rose-50 p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-100 transition"
                  >
                    <FaTrash className="text-xs" />
                  </button>
                </div>
                {p.Descripcion && <p className="text-sm text-slate-500">{p.Descripcion}</p>}
                <div className="text-2xl font-bold text-[#1b3d86]">
                  ${Number(p.PrecioMensual).toLocaleString()}
                  <span className="text-sm font-normal text-slate-400"> /{p.Moneda}/mes</span>
                </div>
                {p.PrecioAnual && (
                  <div className="text-sm font-semibold text-violet-600">
                    ${Number(p.PrecioAnual).toLocaleString()} anual
                  </div>
                )}
                {p.Caracteristicas && (
                  <div className="text-xs text-slate-400 border-t border-[#eaf0fa] pt-3 mt-2">{p.Caracteristicas}</div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {modal === "plan" ? "Nuevo Plan" : modal === "suscripcion" ? "Nueva Suscripción" : "Renovar Suscripción"}
              </h3>
              <button onClick={() => { setModal(null); setForm({}); }} className="text-white/70 hover:text-white">
                <FaTimes />
              </button>
            </div>
            <div className="bg-white p-6 space-y-3">

              {modal === "plan" && <>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Nombre *</label>
                  <input className={premiumField} placeholder="Nombre del plan" value={form.Nombre || ""} onChange={e => setForm({ ...form, Nombre: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Descripción</label>
                  <input className={premiumField} placeholder="Descripción breve" value={form.Descripcion || ""} onChange={e => setForm({ ...form, Descripcion: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Precio mensual *</label>
                    <input className={premiumField} type="number" step="0.01" value={form.PrecioMensual || ""} onChange={e => setForm({ ...form, PrecioMensual: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Precio anual</label>
                    <input className={premiumField} type="number" step="0.01" value={form.PrecioAnual || ""} onChange={e => setForm({ ...form, PrecioAnual: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Moneda</label>
                  <select className={premiumField} value={form.Moneda || "MXN"} onChange={e => setForm({ ...form, Moneda: e.target.value })}>
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Características</label>
                  <textarea className={premiumField} rows={2} placeholder="Características (texto libre)" value={form.Caracteristicas || ""} onChange={e => setForm({ ...form, Caracteristicas: e.target.value })} />
                </div>
              </>}

              {modal === "suscripcion" && <>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Cliente *</label>
                  <select className={premiumField} value={form.Client_Id || ""} onChange={e => setForm({ ...form, Client_Id: e.target.value })}>
                    <option value="">Seleccionar cliente</option>
                    {clientes.map(c => <option key={c.Client_Id} value={c.Client_Id}>{c.LegalName || c.Name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Plan *</label>
                  <select className={premiumField} value={form.Plan_Id || ""} onChange={e => setForm({ ...form, Plan_Id: e.target.value })}>
                    <option value="">Seleccionar plan</option>
                    {planes.map(p => <option key={p.Plan_Id} value={p.Plan_Id}>{p.Nombre} — ${Number(p.PrecioMensual).toLocaleString()}/mes</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Fecha inicio</label>
                    <input className={premiumField} type="date" value={form.FechaInicio || ""} onChange={e => setForm({ ...form, FechaInicio: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Ciclo</label>
                    <select className={premiumField} value={form.Ciclo || "mensual"} onChange={e => setForm({ ...form, Ciclo: e.target.value })}>
                      <option value="mensual">Mensual</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Notas</label>
                  <textarea className={premiumField} rows={2} value={form.Notas || ""} onChange={e => setForm({ ...form, Notas: e.target.value })} />
                </div>
              </>}

              {modal === "renovar" && (
                <div>
                  <p className="text-sm text-slate-600 mb-3">Ingresa la nueva fecha de inicio del ciclo:</p>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Fecha inicio</label>
                  <input className={premiumField} type="date" value={form.FechaInicio || ""} onChange={e => setForm({ ...form, FechaInicio: e.target.value })} />
                </div>
              )}

              <div className="flex gap-2 pt-2">
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
