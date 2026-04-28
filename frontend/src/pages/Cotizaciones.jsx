import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaFileAlt } from "react-icons/fa";
import { cotizacionService } from "../services/cotizacionService";
import { notify } from "../services/notify";
import { socket } from "../services/socket";

const STATUS_BADGES = {
  BORRADOR:              "border border-slate-200 bg-slate-50 text-slate-600",
  PENDIENTE_APROBACION:  "border border-amber-200 bg-amber-50 text-amber-800",
  APROBADA:              "border border-emerald-200 bg-emerald-50 text-emerald-700",
  RECHAZADA:             "border border-rose-200 bg-rose-50 text-rose-700",
  CONVERTIDA:            "border border-blue-200 bg-blue-50 text-blue-700",
};

function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const cargarCotizaciones = async () => {
    setLoading(true);
    try {
      const res = await cotizacionService.listCotizaciones();
      const data = res?.data || res?.cotizaciones || res;
      setCotizaciones(Array.isArray(data) ? data : []);
    } catch (error) {
      notify(error.response?.data?.message || "Error al cargar cotizaciones", "error");
      setCotizaciones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarCotizaciones(); }, []);

  useEffect(() => {
    const handler = () => cargarCotizaciones();
    socket.on("cotizacion:changed", handler);
    return () => socket.off("cotizacion:changed", handler);
  }, []);

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6"
      style={{
        background:
          "radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#1b3d86] to-[#2a5fc4] shadow-[0_4px_14px_rgba(27,61,134,0.35)]">
              <FaFileAlt className="text-white text-lg" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Ventas</p>
              <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Cotizaciones</h1>
              <p className="text-sm text-slate-500">Listado de cotizaciones y acceso al flujo comercial</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate("/aprobaciones")}
              className="flex items-center gap-2 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
            >
              Ver aprobaciones
            </button>
            <button
              onClick={() => navigate("/cotizaciones/nueva")}
              className="flex items-center gap-2 rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.40)] transition"
            >
              + Nueva cotización
            </button>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["ID", "Cliente", "CRM", "Empresa", "Subtotal", "Total", "Margen %", "Status", "Vigencia", "Acciones"].map((col, i) => (
                      <th
                        key={col}
                        className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i >= 4 && i <= 6 ? "text-right" : i === 9 ? "text-center" : ""}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cotizaciones.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-10 text-center text-sm text-slate-400">
                        No hay cotizaciones registradas.
                      </td>
                    </tr>
                  )}
                  {cotizaciones.map((cotizacion) => {
                    const status = String(cotizacion.Status || "BORRADOR").toUpperCase();
                    return (
                      <tr
                        key={cotizacion.ID_COTIZACION}
                        className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60 cursor-pointer"
                        onClick={() => navigate(`/cotizaciones/${cotizacion.ID_COTIZACION}`)}
                      >
                        <td className="py-3 pl-6 pr-4 font-mono text-sm font-semibold text-[#1b3d86]">{cotizacion.ID_COTIZACION}</td>
                        <td className="py-3 pr-4 text-sm text-slate-800">
                          {cotizacion.ClienteNombre || cotizacion.ClientLegalName || cotizacion.ClientCommercialName || "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {cotizacion.Oportunidad_Id ? (
                            <button
                              className="text-xs font-semibold text-[#3b6fd4] underline underline-offset-2 hover:text-[#1b3d86]"
                              onClick={(e) => { e.stopPropagation(); navigate(`/crm/oportunidades/${cotizacion.Oportunidad_Id}`); }}
                            >
                              Opp #{cotizacion.Oportunidad_Id}
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-sm text-slate-700">{cotizacion.EmpresaCodigo}</td>
                        <td className="py-3 pr-4 text-sm text-right text-slate-700">
                          {typeof cotizacion.Subtotal === "number" ? cotizacion.Subtotal.toFixed(2) : cotizacion.Subtotal}
                        </td>
                        <td className="py-3 pr-4 text-sm font-semibold text-right text-slate-800">
                          {typeof cotizacion.TOTAL === "number" ? cotizacion.TOTAL.toFixed(2) : cotizacion.TOTAL}
                        </td>
                        <td className="py-3 pr-4 text-sm text-right text-slate-700">
                          {cotizacion.MargenPorc != null ? `${Number(cotizacion.MargenPorc).toFixed(2)}%` : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGES[status] || "border border-slate-200 bg-slate-50 text-slate-600"}`}>
                            {status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-sm text-slate-600">
                          {cotizacion.FechaVigencia ? new Date(cotizacion.FechaVigencia).toLocaleDateString("es-MX") : "—"}
                        </td>
                        <td className="py-3 pr-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <button
                              className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition"
                              onClick={(e) => { e.stopPropagation(); navigate(`/cotizaciones/${cotizacion.ID_COTIZACION}`); }}
                            >
                              Ver
                            </button>
                            {status === "PENDIENTE_APROBACION" && (
                              <button
                                className="rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
                                onClick={(e) => { e.stopPropagation(); navigate("/aprobaciones"); }}
                              >
                                Aprobaciones
                              </button>
                            )}
                            {cotizacion.Venta_Id && (
                              <button
                                className="rounded-[9px] border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                                onClick={(e) => { e.stopPropagation(); navigate(`/ventas/${cotizacion.Venta_Id}`); }}
                              >
                                Ver venta
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Cotizaciones;
