import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { notify } from "../../services/notify";

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "pendiente", label: "Pendiente" },
  { value: "aprobada", label: "Aprobada" },
  { value: "rechazada", label: "Rechazada" },
];

const ESTADO_BADGE = {
  aprobada:  "border-emerald-200 bg-emerald-50 text-emerald-700",
  rechazada: "border-rose-200 bg-rose-50 text-rose-700",
  pendiente: "border-amber-200 bg-amber-50 text-amber-700",
};

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

export default function SolicitudPermisos() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [modalResolucion, setModalResolucion] = useState(null);
  const [notas, setNotas] = useState("");
  const [resolviendo, setResolviendo] = useState(false);
  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState({
    NombreEmpresa: "", NombreSolicitante: "", Email: "", Telefono: "", Descripcion: ""
  });
  const [enviando, setEnviando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const params = filtroEstado ? `?estado=${filtroEstado}` : "";
      const res = await api.get(`/superadmin/solicitudes-permisos${params}`);
      setSolicitudes(res.data.items || []);
    } catch {
      notify("Error al cargar solicitudes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [filtroEstado]);

  const handleResolver = async () => {
    if (!modalResolucion) return;
    setResolviendo(true);
    try {
      await api.patch(`/superadmin/solicitudes-permisos/${modalResolucion.id}`, {
        accion: modalResolucion.accion,
        Notas: notas,
      });
      notify(
        modalResolucion.accion === "aprobar" ? "Solicitud aprobada" : "Solicitud rechazada",
        "success"
      );
      setModalResolucion(null);
      setNotas("");
      cargar();
    } catch {
      notify("Error al procesar la solicitud", "error");
    } finally {
      setResolviendo(false);
    }
  };

  const handleNueva = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post("/superadmin/solicitudes-permisos", form);
      notify("Solicitud enviada exitosamente", "success");
      setModalNueva(false);
      setForm({ NombreEmpresa: "", NombreSolicitante: "", Email: "", Telefono: "", Descripcion: "" });
      cargar();
    } catch {
      notify("Error al enviar la solicitud", "error");
    } finally {
      setEnviando(false);
    }
  };

  const pendientes = solicitudes.filter(s => s.Estado === "pendiente").length;

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Superadmin</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">
              Solicitud de Permisos
              {pendientes > 0 && (
                <span className="ml-3 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  {pendientes} pendiente{pendientes > 1 ? "s" : ""}
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500">Solicitudes de acceso al sistema pendientes de revisión</p>
          </div>
          <button
            onClick={() => setModalNueva(true)}
            className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition"
          >
            + Nueva solicitud
          </button>
        </div>

        {/* Filtros */}
        <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] px-5 py-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96] w-16">Estado:</span>
            {ESTADOS.map(e => (
              <button
                key={e.value}
                onClick={() => setFiltroEstado(e.value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  filtroEstado === e.value
                    ? "border-[#1b3d86] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.20)]"
                    : "border-[#dce4f0] bg-white text-slate-600 hover:border-[#3b6fd4]"
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-slate-400 text-sm">No hay solicitudes</p>
              <p className="text-slate-300 text-xs mt-1">Las solicitudes de acceso de nuevas empresas aparecerán aquí</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["#", "Empresa", "Solicitante", "Email", "Fecha", "Estado", "Notas", "Acciones"].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {solicitudes.map((s) => (
                    <tr key={s.Solicitud_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="px-4 py-3 pl-6 text-sm text-slate-400">#{s.Solicitud_Id}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{s.NombreEmpresa}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-700">{s.NombreSolicitante}</div>
                        {s.Telefono && <div className="text-xs text-slate-400">{s.Telefono}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.Email}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {s.FechaSolicitud ? new Date(s.FechaSolicitud).toLocaleDateString("es-MX") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${ESTADO_BADGE[s.Estado] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                          {s.Estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">{s.Notas || s.Descripcion || "—"}</td>
                      <td className="px-4 py-3 pr-6">
                        {s.Estado === "pendiente" ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setModalResolucion({ id: s.Solicitud_Id, accion: "aprobar" }); setNotas(""); }}
                              className="rounded-[9px] border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => { setModalResolucion({ id: s.Solicitud_Id, accion: "rechazar" }); setNotas(""); }}
                              className="rounded-[9px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {s.FechaResolucion ? new Date(s.FechaResolucion).toLocaleDateString("es-MX") : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modal resolución */}
      {modalResolucion && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className={`px-6 py-4 flex items-center justify-between ${
              modalResolucion.accion === "aprobar"
                ? "bg-gradient-to-r from-emerald-600 to-emerald-500"
                : "bg-gradient-to-r from-rose-600 to-rose-500"
            }`}>
              <h3 className="text-base font-bold text-white">
                {modalResolucion.accion === "aprobar" ? "Aprobar solicitud" : "Rechazar solicitud"}
              </h3>
              <button onClick={() => setModalResolucion(null)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Notas (opcional)</label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  rows={3}
                  className={premiumField}
                  placeholder="Motivo o instrucciones adicionales..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleResolver}
                  disabled={resolviendo}
                  className={`flex-1 rounded-[12px] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition ${
                    modalResolucion.accion === "aprobar"
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-[0_4px_10px_rgba(5,150,105,0.25)]"
                      : "bg-gradient-to-r from-rose-600 to-rose-500 shadow-[0_4px_10px_rgba(220,38,38,0.25)]"
                  }`}
                >
                  {resolviendo ? "Procesando..." : modalResolucion.accion === "aprobar" ? "Confirmar aprobación" : "Confirmar rechazo"}
                </button>
                <button
                  onClick={() => setModalResolucion(null)}
                  className="flex-1 rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva solicitud */}
      {modalNueva && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Nueva solicitud de acceso</h3>
              <button onClick={() => setModalNueva(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white p-6">
              <form onSubmit={handleNueva} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresa *</label>
                    <input required value={form.NombreEmpresa} onChange={e => setForm({...form, NombreEmpresa: e.target.value})}
                      className={premiumField} placeholder="Nombre de la empresa" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Nombre solicitante *</label>
                    <input required value={form.NombreSolicitante} onChange={e => setForm({...form, NombreSolicitante: e.target.value})}
                      className={premiumField} placeholder="Nombre completo" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Email *</label>
                    <input required type="email" value={form.Email} onChange={e => setForm({...form, Email: e.target.value})}
                      className={premiumField} placeholder="correo@empresa.com" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Teléfono</label>
                    <input value={form.Telefono} onChange={e => setForm({...form, Telefono: e.target.value})}
                      className={premiumField} placeholder="55 1234 5678" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Descripción / Motivo</label>
                  <textarea value={form.Descripcion} onChange={e => setForm({...form, Descripcion: e.target.value})}
                    rows={3} className={premiumField}
                    placeholder="Describe brevemente para qué necesita acceso al sistema..." />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={enviando}
                    className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition">
                    {enviando ? "Enviando..." : "Enviar solicitud"}
                  </button>
                  <button type="button" onClick={() => setModalNueva(false)}
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
