import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { crmService } from "../../services/crmService";
import { notify } from "../../services/notify";
import confirm from "../../services/confirm";
import api from "../../services/api";
import { socket } from "../../services/socket";
import { getDefaultCompanyId } from "../../utils/tokenHelper";
import { FaList, FaThLarge } from "react-icons/fa";

const ETAPA_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];

const premiumFieldClass =
  "w-full rounded-[14px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

function KanbanColumn({ etapa, oportunidades, onCardClick, colorIdx }) {
  const color = ETAPA_COLORS[colorIdx % ETAPA_COLORS.length];
  const total = oportunidades.reduce((s, o) => s + Number(o.MontoEstimado || 0), 0);
  return (
    <div
      className="flex-shrink-0 w-64 flex flex-col rounded-[22px] overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${color}10 0%, ${color}06 100%)`, border: `1.5px solid ${color}30` }}
    >
      <div className="px-3.5 py-3 flex items-center justify-between" style={{ borderBottom: `1.5px solid ${color}25` }}>
        <span className="text-sm font-bold" style={{ color }}>{etapa.Nombre}</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/80 shadow-sm" style={{ color }}>
          {oportunidades.length}
        </span>
      </div>
      <div className="text-xs px-3.5 py-1.5 font-medium" style={{ color, borderBottom: `1px solid ${color}20` }}>
        ${total.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
      </div>
      <div className="flex-1 p-2.5 space-y-2 overflow-y-auto" style={{ maxHeight: 500 }}>
        {oportunidades.map(op => (
          <div
            key={op.Oportunidad_Id}
            onClick={() => onCardClick(op.Oportunidad_Id)}
            className="bg-white rounded-[16px] border border-white/80 shadow-[0_4px_14px_rgba(15,45,93,0.08)] p-3 cursor-pointer hover:shadow-[0_6px_20px_rgba(15,45,93,0.13)] transition-shadow"
          >
            <p className="text-xs font-semibold text-slate-800 leading-tight mb-1">{op.NombreOportunidad}</p>
            {op.ClienteNombre && <p className="text-xs text-slate-500 truncate mb-1">{op.ClienteNombre}</p>}
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs font-bold text-slate-700">
                ${Number(op.MontoEstimado || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
              </span>
              {op.Probabilidad != null && (
                <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">{op.Probabilidad}%</span>
              )}
            </div>
          </div>
        ))}
        {oportunidades.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">Sin oportunidades</p>
        )}
      </div>
    </div>
  );
}

function Oportunidades() {
  const [oportunidades, setOportunidades] = useState([]);
  const [etapas, setEtapas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [forecast, setForecast] = useState([]);
  const [showForecast, setShowForecast] = useState(false);
  const [vistaKanban, setVistaKanban] = useState(false);
  const [defaultCompanyId, setDefaultCompanyId] = useState(1);
  const [form, setForm] = useState({
    NombreOportunidad: "",
    Company_Id: 1,
    MontoEstimado: "",
    Probabilidad: "",
    Client_Id: "",
  });

  const navigate = useNavigate();

  useEffect(() => {
    const companyId = getDefaultCompanyId();
    setDefaultCompanyId(companyId);
    setForm(prev => ({ ...prev, Company_Id: companyId }));
  }, []);

  const cargarForecast = async () => {
    try {
      const res = await api.get('/crm/forecast');
      setForecast(res.data?.data || []);
    } catch {
      setForecast([]);
    }
  };

  const cargarEtapas = async () => {
    try {
      const res = await crmService.getEtapas();
      const data = res?.data || res;
      setEtapas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar etapas CRM", error);
    }
  };

  const cargarOportunidades = async () => {
    setLoading(true);
    try {
      const res = await crmService.getOportunidades();
      const data = res?.data || res?.oportunidades || res;
      setOportunidades(Array.isArray(data) ? data : []);
    } catch (error) {
      notify(error.response?.data?.message || "Error al cargar oportunidades", "error");
      setOportunidades([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarClientes = async () => {
    try {
      const res = await api.get("/clients");
      const data = res?.data?.data || res?.data || res;
      setClientes(Array.isArray(data) ? data : []);
    } catch {
      setClientes([]);
    }
  };

  useEffect(() => {
    cargarEtapas();
    cargarOportunidades();
    cargarClientes();
    cargarForecast();
  }, []);

  useEffect(() => {
    const handler = () => cargarOportunidades();
    socket.on("crm:oportunidad:changed", handler);
    return () => socket.off("crm:oportunidad:changed", handler);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCrearOportunidad = async (e) => {
    e.preventDefault();
    if (!form.NombreOportunidad) {
      notify("Captura un nombre para la oportunidad", "error");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        Company_Id: Number(form.Company_Id) || defaultCompanyId,
        NombreOportunidad: form.NombreOportunidad,
        MontoEstimado: form.MontoEstimado ? Number(form.MontoEstimado) : null,
        Probabilidad: form.Probabilidad !== "" ? Number(form.Probabilidad) : null,
        Client_Id: form.Client_Id ? Number(form.Client_Id) : null,
      };
      await crmService.createOportunidad(payload);
      notify("Oportunidad creada", "success");
      setForm({ ...form, NombreOportunidad: "", MontoEstimado: "", Probabilidad: "", Client_Id: "" });
      await cargarOportunidades();
    } catch (error) {
      notify(error.response?.data?.message || "Error al crear oportunidad", "error");
    } finally {
      setCreating(false);
    }
  };

  const getEtapaNombre = (etapaId) => {
    const etapa = etapas.find((e) => e.Etapa_Id === etapaId);
    return etapa ? etapa.Nombre : "-";
  };

  const handleEliminar = async (op) => {
    const ok = await confirm(
      "¿Seguro que deseas eliminar esta oportunidad? Esta acción no se puede deshacer.",
      "Eliminar oportunidad",
      "Eliminar",
      "Cancelar"
    );
    if (!ok) return;
    try {
      await crmService.deleteOportunidad(op.Oportunidad_Id);
      notify("Oportunidad eliminada", "success");
      await cargarOportunidades();
    } catch (error) {
      notify(error.response?.data?.message || "Error al eliminar oportunidad", "error");
    }
  };

  return (
    <div
      className="w-full min-h-screen overflow-auto"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, transparent 60%), radial-gradient(ellipse at 0% 80%, rgba(99,55,197,0.05) 0%, transparent 50%), #f4f7fc' }}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#6b7a96]">Pipeline comercial</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1d2430]">Oportunidades</h1>
            <p className="mt-1 text-sm text-slate-500">Administracion de oportunidades y pipeline de ventas.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-[14px] border border-[#dce4f0] overflow-hidden shadow-[0_2px_8px_rgba(15,45,93,0.06)]">
              <button
                onClick={() => setVistaKanban(false)}
                title="Vista lista"
                className={`px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors ${!vistaKanban ? 'bg-[#1b3d86] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <FaList className="text-[10px]" /> Lista
              </button>
              <button
                onClick={() => setVistaKanban(true)}
                title="Vista Kanban"
                className={`px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-l border-[#dce4f0] ${vistaKanban ? 'bg-[#1b3d86] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <FaThLarge className="text-[10px]" /> Kanban
              </button>
            </div>
            <button
              onClick={() => setShowForecast(v => !v)}
              className="px-4 py-2 rounded-[14px] bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-semibold shadow-[0_4px_14px_rgba(79,79,220,0.3)] hover:shadow-[0_6px_20px_rgba(79,79,220,0.4)] transition-shadow"
            >
              {showForecast ? 'Ocultar forecast' : 'Ver forecast'}
            </button>
          </div>
        </div>

        {/* Forecast panel */}
        {showForecast && (
          <div className="rounded-[24px] border border-indigo-200/80 bg-[linear-gradient(180deg,rgba(238,242,255,0.95),rgba(245,247,255,0.92))] p-5 shadow-[0_12px_32px_rgba(79,79,220,0.08)]">
            <h3 className="font-semibold text-indigo-900 mb-4 text-sm">Forecast de ventas por etapa del pipeline</h3>
            {forecast.length === 0 ? (
              <p className="text-sm text-indigo-600">Sin datos de forecast disponibles.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-indigo-700">
                      <th className="text-left py-2.5 px-4 font-semibold border-b border-indigo-200/60">Etapa</th>
                      <th className="text-right py-2.5 px-4 font-semibold border-b border-indigo-200/60">Oportunidades</th>
                      <th className="text-right py-2.5 px-4 font-semibold border-b border-indigo-200/60">Valor total</th>
                      <th className="text-right py-2.5 px-4 font-semibold border-b border-indigo-200/60">Prob. promedio</th>
                      <th className="text-right py-2.5 px-4 font-semibold border-b border-indigo-200/60">Valor ponderado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.map((f, i) => (
                      <tr key={i} className="hover:bg-indigo-50/60 transition-colors">
                        <td className="py-2.5 px-4 text-indigo-900 font-medium border-b border-indigo-100/60">{f.Etapa}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600 border-b border-indigo-100/60">{f.TotalOportunidades}</td>
                        <td className="py-2.5 px-4 text-right text-slate-700 border-b border-indigo-100/60">${Number(f.ValorTotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600 border-b border-indigo-100/60">{Number(f.ProbabilidadPromedio || 0).toFixed(0)}%</td>
                        <td className="py-2.5 px-4 text-right text-indigo-800 font-bold border-b border-indigo-100/60">${Number(f.ValorPonderado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-100/70 font-semibold">
                      <td className="py-2.5 px-4 text-indigo-900 rounded-bl-xl">Total</td>
                      <td className="py-2.5 px-4 text-right text-slate-800">{forecast.reduce((s, f) => s + Number(f.TotalOportunidades || 0), 0)}</td>
                      <td className="py-2.5 px-4 text-right text-slate-800">${forecast.reduce((s, f) => s + Number(f.ValorTotal || 0), 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                      <td></td>
                      <td className="py-2.5 px-4 text-right text-indigo-900 rounded-br-xl">${forecast.reduce((s, f) => s + Number(f.ValorPonderado || 0), 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create form */}
        <div className="rounded-[26px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,253,0.96))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Registro</p>
          <h3 className="mb-4 text-base font-semibold text-slate-900">Nueva oportunidad</h3>
          <form onSubmit={handleCrearOportunidad} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Nombre de la oportunidad</label>
              <input
                type="text"
                name="NombreOportunidad"
                value={form.NombreOportunidad}
                onChange={handleChange}
                className={premiumFieldClass}
                placeholder="Ej. Proyecto cajas para Cliente XYZ"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Monto estimado</label>
              <input
                type="number"
                name="MontoEstimado"
                value={form.MontoEstimado}
                onChange={handleChange}
                className={premiumFieldClass}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Probabilidad (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                name="Probabilidad"
                value={form.Probabilidad}
                onChange={handleChange}
                className={premiumFieldClass}
                placeholder="0 - 100"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Cliente (opcional)</label>
              <select
                name="Client_Id"
                value={form.Client_Id}
                onChange={handleChange}
                className={premiumFieldClass}
              >
                <option value="">Sin asignar</option>
                {clientes.map((c) => (
                  <option key={c.Client_Id} value={c.Client_Id}>
                    {c.LegalName || c.CommercialName} ({c.RFC})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-5 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2.5 rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white text-sm font-semibold shadow-[0_4px_14px_rgba(27,61,134,0.3)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.4)] transition-shadow disabled:opacity-50"
              >
                {creating ? "Creando..." : "+ Nueva oportunidad"}
              </button>
            </div>
          </form>
        </div>

        {/* List / Kanban */}
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-[22px] bg-slate-200/60" />
            ))}
          </div>
        ) : vistaKanban ? (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4" style={{ minWidth: etapas.length * 276 }}>
              {etapas.map((etapa, idx) => (
                <KanbanColumn
                  key={etapa.Etapa_Id}
                  etapa={etapa}
                  colorIdx={idx}
                  oportunidades={oportunidades.filter(o => o.Etapa_Id === etapa.Etapa_Id || o.EtapaNombre === etapa.Nombre)}
                  onCardClick={(id) => navigate(`/crm/oportunidades/${id}`)}
                />
              ))}
              {etapas.length === 0 && (
                <p className="text-slate-500 text-sm">No hay etapas configuradas.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] shadow-[0_18px_40px_rgba(15,45,93,0.08)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    <th className="py-3 pl-5 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-20">ID</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96]">Oportunidad</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-40">Etapa</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-32 text-right">Monto</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-32">Status</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-40">Fecha creacion</th>
                    <th className="py-3 pr-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] w-32 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {oportunidades.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 px-5 text-sm text-slate-400 text-center">
                        No hay oportunidades registradas.
                      </td>
                    </tr>
                  )}
                  {oportunidades.map((op) => (
                    <tr
                      key={op.Oportunidad_Id}
                      className="border-t border-[#eaf0fa] hover:bg-[#f5f8fe] cursor-pointer transition-colors"
                      onClick={() => navigate(`/crm/oportunidades/${op.Oportunidad_Id}`)}
                    >
                      <td className="py-3.5 pl-5 pr-4 text-slate-500 text-xs font-mono">{op.Oportunidad_Id}</td>
                      <td className="py-3.5 pr-4 text-slate-800 font-medium">{op.NombreOportunidad}</td>
                      <td className="py-3.5 pr-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                          {op.EtapaNombre || getEtapaNombre(op.Etapa_Id)}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-slate-800 font-semibold text-right">
                        ${typeof op.MontoEstimado === "number" ? op.MontoEstimado.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : (op.MontoEstimado || '0.00')}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                          {op.Status || "Abierta"}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-slate-500 text-xs">
                        {op.FechaCreacion ? new Date(op.FechaCreacion).toLocaleDateString('es-MX') : "-"}
                      </td>
                      <td className="py-3.5 pr-5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/crm/oportunidades/${op.Oportunidad_Id}`); }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            Ver
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEliminar(op); }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                          >
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
    </div>
  );
}

export default Oportunidades;
