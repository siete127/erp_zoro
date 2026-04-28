import React, { useEffect, useState, useCallback } from "react";
import { FaCar, FaPlus, FaTools, FaTrash, FaEdit, FaTimes } from "react-icons/fa";
import { getApiBase } from "../../services/runtimeConfig";

const api = () => getApiBase();
const tok = () => localStorage.getItem("token");
const hdr = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${tok()}` });

const ESTADOS = ["activo", "mantenimiento", "baja"];
const TIPOS = ["camion", "auto", "moto", "otro"];
const TIPOS_SERVICIO = ["mantenimiento", "revision", "combustible", "seguro", "otro"];

const ESTADO_BADGE = {
  activo:        "border-emerald-200 bg-emerald-50 text-emerald-700",
  mantenimiento: "border-amber-200 bg-amber-50 text-amber-700",
  baja:          "border-rose-200 bg-rose-50 text-rose-700",
};
const SERV_BADGE = {
  mantenimiento: "border-orange-200 bg-orange-50 text-orange-700",
  revision:      "border-blue-200 bg-blue-50 text-blue-700",
  combustible:   "border-amber-200 bg-amber-50 text-amber-700",
  seguro:        "border-violet-200 bg-violet-50 text-violet-700",
  otro:          "border-slate-200 bg-slate-50 text-slate-600",
};

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

export default function Flotilla() {
  const [tab, setTab] = useState("vehiculos");
  const [vehiculos, setVehiculos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchVehiculos = useCallback(async () => {
    const q = estadoFiltro ? `?estado=${estadoFiltro}` : "";
    const r = await fetch(`${api()}/flotilla/vehiculos${q}`, { headers: hdr() });
    const d = await r.json();
    setVehiculos(d.items || []);
  }, [estadoFiltro]);

  const fetchServicios = useCallback(async () => {
    const r = await fetch(`${api()}/flotilla/servicios`, { headers: hdr() });
    const d = await r.json();
    setServicios(d.items || []);
  }, []);

  const fetchDetalle = useCallback(async (id) => {
    const r = await fetch(`${api()}/flotilla/vehiculos/${id}`, { headers: hdr() });
    const d = await r.json();
    setDetalle(d);
  }, []);

  useEffect(() => { fetchVehiculos(); fetchServicios(); }, [fetchVehiculos, fetchServicios]);

  const submit = async () => {
    setLoading(true);
    try {
      if (modal === "vehiculo") {
        await fetch(`${api()}/flotilla/vehiculos`, { method: "POST", headers: hdr(), body: JSON.stringify({ ...form, Anio: form.Anio ? Number(form.Anio) : null }) });
        fetchVehiculos();
      } else if (modal === "editar") {
        await fetch(`${api()}/flotilla/vehiculos/${form.Vehiculo_Id}`, { method: "PUT", headers: hdr(), body: JSON.stringify({ ...form, Anio: form.Anio ? Number(form.Anio) : null }) });
        fetchVehiculos();
        if (detalle?.Vehiculo_Id === form.Vehiculo_Id) fetchDetalle(form.Vehiculo_Id);
      } else if (modal === "servicio") {
        await fetch(`${api()}/flotilla/servicios`, { method: "POST", headers: hdr(), body: JSON.stringify({ ...form, Vehiculo_Id: Number(form.Vehiculo_Id), Costo: form.Costo ? Number(form.Costo) : null, KilometrajeActual: form.KilometrajeActual ? Number(form.KilometrajeActual) : null }) });
        fetchServicios();
        if (detalle) fetchDetalle(detalle.Vehiculo_Id);
      }
      setModal(null); setForm({});
    } finally { setLoading(false); }
  };

  const deleteVehiculo = async (id) => {
    if (!window.confirm("¿Eliminar vehículo y su historial?")) return;
    await fetch(`${api()}/flotilla/vehiculos/${id}`, { method: "DELETE", headers: hdr() });
    fetchVehiculos();
    if (detalle?.Vehiculo_Id === id) setDetalle(null);
  };

  const deleteServicio = async (id) => {
    await fetch(`${api()}/flotilla/servicios/${id}`, { method: "DELETE", headers: hdr() });
    fetchServicios();
    if (detalle) fetchDetalle(detalle.Vehiculo_Id);
  };

  const TABS = [["vehiculos", "Vehículos"], ["servicios", "Servicios"]];
  const modalTitle = modal === "vehiculo" ? "Registrar Vehículo" : modal === "editar" ? "Editar Vehículo" : "Registrar Servicio";

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Operaciones</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Flotilla Vehicular</h1>
            <p className="text-sm text-slate-500">Control de vehículos, servicios e historial de mantenimiento.</p>
          </div>
          <div className="flex gap-2">
            {tab === "vehiculos" && (
              <button
                onClick={() => { setModal("vehiculo"); setForm({ Estado: "activo", Tipo: "camion" }); }}
                className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition"
              >
                + Registrar vehículo
              </button>
            )}
            {tab === "servicios" && (
              <button
                onClick={() => { setModal("servicio"); setForm({ TipoServicio: "mantenimiento", FechaServicio: new Date().toISOString().slice(0, 10) }); }}
                className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition"
              >
                + Agregar servicio
              </button>
            )}
          </div>
        </div>

        {/* Pill tabs */}
        <div className="flex gap-1 rounded-[16px] border border-[#dce4f0] bg-white/80 p-1 shadow-[0_2px_8px_rgba(15,45,93,0.05)] w-fit">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-[12px] px-4 py-2 text-sm font-semibold transition ${
                tab === key
                  ? "bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.25)]"
                  : "text-slate-600 hover:bg-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ===== TAB: Vehículos ===== */}
        {tab === "vehiculos" && (
          <div className="flex gap-5 flex-wrap lg:flex-nowrap">

            {/* Lista */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Estado filter pills */}
              <div className="flex gap-2 flex-wrap">
                {["", ...ESTADOS].map(e => (
                  <button
                    key={e}
                    onClick={() => setEstadoFiltro(e)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      estadoFiltro === e
                        ? "border-[#1b3d86] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.20)]"
                        : "border-[#dce4f0] bg-white text-slate-600 hover:border-[#3b6fd4]"
                    }`}
                  >
                    {e || "Todos"}
                  </button>
                ))}
              </div>

              <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#eaf0fa]">
                        {["Placa","Vehículo","Estado","Km",""].map((col, i) => (
                          <th key={i} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 ${i === 2 ? 'text-center' : i === 3 ? 'text-right' : ''}`}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vehiculos.length === 0 && (
                        <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">Sin vehículos registrados</td></tr>
                      )}
                      {vehiculos.map(v => (
                        <tr
                          key={v.Vehiculo_Id}
                          className={`border-t border-[#eaf0fa] cursor-pointer transition hover:bg-[#f4f7ff]/60 ${detalle?.Vehiculo_Id === v.Vehiculo_Id ? "bg-[#eef3ff]" : ""}`}
                          onClick={() => fetchDetalle(v.Vehiculo_Id)}
                        >
                          <td className="px-4 py-3 pl-6 font-mono text-sm font-bold text-[#1b3d86]">{v.Placa}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="font-medium text-slate-800">{v.Marca} {v.Modelo}</div>
                            <div className="text-xs text-slate-500">{v.Anio} · {v.Color} · {v.Tipo}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTADO_BADGE[v.Estado] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                              {v.Estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-600">{v.KilometrajeActual?.toLocaleString()}</td>
                          <td className="px-4 py-3 pr-6" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => { setModal("editar"); setForm({ ...v }); }}
                                className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2.5 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition"
                              >
                                <FaEdit className="inline" />
                              </button>
                              <button
                                onClick={() => deleteVehiculo(v.Vehiculo_Id)}
                                className="rounded-[9px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition"
                              >
                                <FaTrash className="inline" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Detalle panel */}
            {detalle && (
              <div className="w-80 shrink-0 rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-[#0d1f3c] font-mono">{detalle.Placa}</h3>
                  <button onClick={() => setDetalle(null)} className="text-slate-400 hover:text-slate-600 transition"><FaTimes /></button>
                </div>

                <div className="space-y-1.5 text-sm text-slate-600">
                  <div><span className="font-semibold text-slate-800">Marca:</span> {detalle.Marca} {detalle.Modelo}</div>
                  <div><span className="font-semibold text-slate-800">Año:</span> {detalle.Anio}</div>
                  <div><span className="font-semibold text-slate-800">Color:</span> {detalle.Color}</div>
                  <div><span className="font-semibold text-slate-800">Tipo:</span> {detalle.Tipo}</div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">Estado:</span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${ESTADO_BADGE[detalle.Estado] || ""}`}>{detalle.Estado}</span>
                  </div>
                  <div><span className="font-semibold text-slate-800">Km actual:</span> {detalle.KilometrajeActual?.toLocaleString()}</div>
                  {detalle.ConductorNombre && <div><span className="font-semibold text-slate-800">Conductor:</span> {detalle.ConductorNombre}</div>}
                  {detalle.Notas && <div className="text-slate-500 italic">{detalle.Notas}</div>}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] flex items-center gap-1"><FaTools className="inline" /> Historial de servicios</p>
                    <button
                      onClick={() => { setModal("servicio"); setForm({ TipoServicio: "mantenimiento", FechaServicio: new Date().toISOString().slice(0, 10), Vehiculo_Id: detalle.Vehiculo_Id }); }}
                      className="text-[11px] font-semibold text-[#3b6fd4] hover:underline"
                    >
                      + Agregar
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {(detalle.servicios || []).length === 0 && <div className="text-xs text-slate-400">Sin registros</div>}
                    {(detalle.servicios || []).map(s => (
                      <div key={s.Servicio_Id} className="rounded-[12px] border border-[#eaf0fa] bg-[#f8faff] p-2.5 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${SERV_BADGE[s.TipoServicio] || "border-slate-200 bg-slate-50 text-slate-600"}`}>{s.TipoServicio}</span>
                          <button onClick={() => deleteServicio(s.Servicio_Id)} className="text-rose-300 hover:text-rose-500 transition"><FaTrash /></button>
                        </div>
                        {s.Descripcion && <div className="text-slate-600 mb-1">{s.Descripcion}</div>}
                        <div className="flex justify-between text-slate-400">
                          <span>{s.FechaServicio?.slice(0, 10)}</span>
                          {s.Costo && <span className="font-semibold text-slate-600">${Number(s.Costo).toLocaleString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: Servicios ===== */}
        {tab === "servicios" && (
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["Vehículo","Tipo","Descripción","Costo","Fecha","Km",""].map((col, i) => (
                      <th key={i} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i === 3 ? 'text-right' : i === 4 ? 'text-center' : i === 5 ? 'text-right' : ''}`}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {servicios.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">Sin registros de servicio</td></tr>
                  )}
                  {servicios.map(s => (
                    <tr key={s.Servicio_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="px-4 py-3 pl-6">
                        <div className="font-mono text-sm font-bold text-[#1b3d86]">{s.Placa}</div>
                        <div className="text-xs text-slate-500">{s.Marca} {s.Modelo}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SERV_BADGE[s.TipoServicio] || "border-slate-200 bg-slate-50 text-slate-600"}`}>{s.TipoServicio}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.Descripcion}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{s.Costo ? `$${Number(s.Costo).toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-3 text-center text-sm text-slate-500">{s.FechaServicio?.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-500">{s.KilometrajeActual?.toLocaleString()}</td>
                      <td className="px-4 py-3 pr-6 text-right">
                        <button onClick={() => deleteServicio(s.Servicio_Id)} className="rounded-[9px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-100 transition">
                          <FaTrash className="inline" />
                        </button>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">{modalTitle}</h2>
              <button onClick={() => { setModal(null); setForm({}); }} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white p-6 space-y-3">

              {(modal === "vehiculo" || modal === "editar") && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <input className={premiumField} placeholder="Placa *" value={form.Placa || ""} onChange={e => setForm({ ...form, Placa: e.target.value })} />
                    <input className={premiumField} placeholder="Marca *" value={form.Marca || ""} onChange={e => setForm({ ...form, Marca: e.target.value })} />
                    <input className={premiumField} placeholder="Modelo *" value={form.Modelo || ""} onChange={e => setForm({ ...form, Modelo: e.target.value })} />
                    <input className={premiumField} placeholder="Año" type="number" value={form.Anio || ""} onChange={e => setForm({ ...form, Anio: e.target.value })} />
                    <input className={premiumField} placeholder="Color" value={form.Color || ""} onChange={e => setForm({ ...form, Color: e.target.value })} />
                  </div>
                  <select className={premiumField} value={form.Tipo || "camion"} onChange={e => setForm({ ...form, Tipo: e.target.value })}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select className={premiumField} value={form.Estado || "activo"} onChange={e => setForm({ ...form, Estado: e.target.value })}>
                    {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <textarea className={premiumField} placeholder="Notas" rows={2} value={form.Notas || ""} onChange={e => setForm({ ...form, Notas: e.target.value })} />
                </>
              )}

              {modal === "servicio" && (
                <>
                  <select className={premiumField} value={form.Vehiculo_Id || ""} onChange={e => setForm({ ...form, Vehiculo_Id: e.target.value })}>
                    <option value="">Seleccionar vehículo *</option>
                    {vehiculos.map(v => <option key={v.Vehiculo_Id} value={v.Vehiculo_Id}>{v.Placa} — {v.Marca} {v.Modelo}</option>)}
                  </select>
                  <select className={premiumField} value={form.TipoServicio || "mantenimiento"} onChange={e => setForm({ ...form, TipoServicio: e.target.value })}>
                    {TIPOS_SERVICIO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className={premiumField} placeholder="Descripción" value={form.Descripcion || ""} onChange={e => setForm({ ...form, Descripcion: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <input className={premiumField} placeholder="Costo ($)" type="number" step="0.01" value={form.Costo || ""} onChange={e => setForm({ ...form, Costo: e.target.value })} />
                    <input className={premiumField} placeholder="Proveedor" value={form.Proveedor || ""} onChange={e => setForm({ ...form, Proveedor: e.target.value })} />
                    <input className={premiumField} type="date" value={form.FechaServicio || ""} onChange={e => setForm({ ...form, FechaServicio: e.target.value })} />
                    <input className={premiumField} placeholder="Kilometraje" type="number" value={form.KilometrajeActual || ""} onChange={e => setForm({ ...form, KilometrajeActual: e.target.value })} />
                  </div>
                </>
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
