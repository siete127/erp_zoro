import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { notify } from "../../services/notify";

const CATEGORIAS = ["viaje", "alimentacion", "hospedaje", "papeleria", "transporte", "otro"];
const ESTADOS = ["", "borrador", "enviado", "aprobado", "rechazado"];

const ESTADO_BADGE = {
  aprobado:  "border-emerald-200 bg-emerald-50 text-emerald-700",
  rechazado: "border-rose-200 bg-rose-50 text-rose-700",
  enviado:   "border-blue-200 bg-blue-50 text-blue-700",
};
const estadoBadge = (e) => ESTADO_BADGE[e] || "border-slate-200 bg-slate-50 text-slate-600";

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

export default function Gastos() {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [modalNuevo, setModalNuevo] = useState(false);
  const [form, setForm] = useState({
    Categoria: "viaje", Descripcion: "", Monto: "",
    FechaGasto: new Date().toISOString().slice(0, 10), Notas: ""
  });
  const [creando, setCreando] = useState(false);
  const [procesando, setProcesando] = useState(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const params = filtroEstado ? `?estado=${filtroEstado}` : "";
      const res = await api.get(`/gastos${params}`);
      setGastos(res.data.items || []);
    } catch {
      notify("Error al cargar gastos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [filtroEstado]);

  const handleCrear = async (e) => {
    e.preventDefault();
    setCreando(true);
    try {
      await api.post("/gastos", { ...form, Monto: parseFloat(form.Monto) });
      notify("Gasto registrado", "success");
      setModalNuevo(false);
      setForm({ Categoria: "viaje", Descripcion: "", Monto: "", FechaGasto: new Date().toISOString().slice(0, 10), Notas: "" });
      cargar();
    } catch {
      notify("Error al registrar gasto", "error");
    } finally {
      setCreando(false);
    }
  };

  const handleEnviar = async (gastoId) => {
    setProcesando(gastoId);
    try {
      await api.patch(`/gastos/${gastoId}/enviar`);
      notify("Gasto enviado para aprobación", "success");
      cargar();
    } catch {
      notify("Error al enviar gasto", "error");
    } finally {
      setProcesando(null);
    }
  };

  const handleAprobar = async (gastoId, accion) => {
    setProcesando(gastoId);
    try {
      await api.patch(`/gastos/${gastoId}/aprobar`, { accion });
      notify(accion === "aprobar" ? "Gasto aprobado" : "Gasto rechazado", "success");
      cargar();
    } catch {
      notify("Error al procesar gasto", "error");
    } finally {
      setProcesando(null);
    }
  };

  const totalAprobados = gastos.filter(g => g.Estado === "aprobado").reduce((s, g) => s + Number(g.Monto || 0), 0);
  const totalPendientes = gastos.filter(g => g.Estado === "enviado").reduce((s, g) => s + Number(g.Monto || 0), 0);

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">RH</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Gastos</h1>
            <p className="text-sm text-slate-500">Gestión de gastos de empleados</p>
          </div>
          <button
            onClick={() => setModalNuevo(true)}
            className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition"
          >
            + Registrar gasto
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Total aprobados</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">${totalAprobados.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700">Pendientes</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">${totalPendientes.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-[20px] border border-blue-200 bg-blue-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700">Total registros</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">{gastos.length}</p>
          </div>
        </div>

        {/* Estado filter pills */}
        <div className="flex gap-2 flex-wrap">
          {ESTADOS.map(e => (
            <button
              key={e || "todos"}
              onClick={() => setFiltroEstado(e)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                filtroEstado === e
                  ? "border-[#1b3d86] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.25)]"
                  : "border-[#dce4f0] bg-white text-slate-600 hover:border-[#3b6fd4]"
              }`}
            >
              {e || "Todos"}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : gastos.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">No hay gastos registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["#","Empleado","Categoría","Descripción","Monto","Fecha","Estado","Acciones"].map((col, i) => (
                      <th key={col} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i === 4 ? 'text-right' : i === 7 ? 'text-center' : ''}`}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gastos.map((g) => (
                    <tr key={g.Gasto_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="px-4 py-3 text-sm text-slate-400 first:pl-6">{g.Gasto_Id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{g.UsuarioNombre || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 capitalize">{g.Categoria}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{g.Descripcion || "—"}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">
                        ${Number(g.Monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {g.FechaGasto ? new Date(g.FechaGasto).toLocaleDateString("es-MX") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${estadoBadge(g.Estado)}`}>
                          {g.Estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 pr-6">
                        <div className="flex justify-center gap-1.5">
                          {g.Estado === "borrador" && (
                            <button
                              onClick={() => handleEnviar(g.Gasto_Id)}
                              disabled={procesando === g.Gasto_Id}
                              className="rounded-[9px] border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition"
                            >
                              Enviar
                            </button>
                          )}
                          {g.Estado === "enviado" && (
                            <>
                              <button
                                onClick={() => handleAprobar(g.Gasto_Id, "aprobar")}
                                disabled={procesando === g.Gasto_Id}
                                className="rounded-[9px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition"
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={() => handleAprobar(g.Gasto_Id, "rechazar")}
                                disabled={procesando === g.Gasto_Id}
                                className="rounded-[9px] border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modal nuevo gasto */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Registrar gasto</h3>
              <button onClick={() => setModalNuevo(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white p-6">
              <form onSubmit={handleCrear} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Categoría *</label>
                    <select required value={form.Categoria} onChange={e => setForm({...form, Categoria: e.target.value})} className={premiumField}>
                      {CATEGORIAS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Monto *</label>
                    <input required type="number" step="0.01" min="0" value={form.Monto}
                      onChange={e => setForm({...form, Monto: e.target.value})}
                      className={premiumField} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Fecha del gasto *</label>
                  <input required type="date" value={form.FechaGasto}
                    onChange={e => setForm({...form, FechaGasto: e.target.value})}
                    className={premiumField} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Descripción</label>
                  <input value={form.Descripcion} onChange={e => setForm({...form, Descripcion: e.target.value})}
                    className={premiumField} placeholder="¿Para qué fue el gasto?" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Notas adicionales</label>
                  <textarea value={form.Notas} onChange={e => setForm({...form, Notas: e.target.value})}
                    rows={2} className={premiumField} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={creando}
                    className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition"
                  >
                    {creando ? "Guardando..." : "Registrar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalNuevo(false)}
                    className="flex-1 rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
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
