import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaShoppingCart } from "react-icons/fa";
import { ventaService } from "../services/ventaService";
import { notify } from "../services/notify";
import StatusBadge from "./ventas/StatusBadge";
import { socket } from "../services/socket";
import ModalEditarVenta from "../components/ModalEditarVenta";

function ListaVentas() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ventaEditando, setVentaEditando] = useState(null);
  const navigate = useNavigate();

  const cargarVentas = async () => {
    setLoading(true);
    try {
      const res = await ventaService.getVentas();
      const data = res?.data || res?.ventas || res;
      setVentas(Array.isArray(data) ? data : []);
    } catch (error) {
      notify(error.response?.data?.message || "Error al cargar ventas", "error");
      setVentas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarVentas(); }, []);

  useEffect(() => {
    const handler = () => cargarVentas();
    socket.on("venta:changed", handler);
    return () => socket.off("venta:changed", handler);
  }, []);

  const handleEliminar = async (ventaId, e) => {
    e.stopPropagation();
    if (!confirm("¿Está seguro de eliminar esta venta?")) return;
    try {
      await ventaService.deleteVenta(ventaId);
      notify("Venta eliminada correctamente", "success");
      cargarVentas();
    } catch (error) {
      notify(error.response?.data?.message || "Error al eliminar venta", "error");
    }
  };

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
              <FaShoppingCart className="text-white text-lg" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Ventas</p>
              <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Ventas</h1>
              <p className="text-sm text-slate-500">Listado de ventas registradas en el ERP</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/ventas/nueva")}
            className="flex items-center gap-2 rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.40)] transition"
          >
            + Nueva venta
          </button>
        </div>

        {/* ── Table ── */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["ID", "Cliente", "Fecha", "Total", "Estatus", "Acciones"].map((col, i) => (
                      <th
                        key={col}
                        className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i === 3 ? "text-right" : i === 5 ? "text-center" : ""}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ventas.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                        No hay ventas registradas.
                      </td>
                    </tr>
                  )}
                  {ventas.map((v) => (
                    <tr
                      key={v.Venta_Id}
                      className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60 cursor-pointer"
                      onClick={() => navigate(`/ventas/${v.Venta_Id}`)}
                    >
                      <td className="py-3 pl-6 pr-4 font-mono text-sm font-semibold text-[#1b3d86]">{v.Venta_Id}</td>
                      <td className="py-3 pr-4 text-sm text-slate-800">{v.ClienteNombre}</td>
                      <td className="py-3 pr-4 text-sm text-slate-600">
                        {v.FechaVenta ? new Date(v.FechaVenta).toLocaleString("es-MX") : "—"}
                      </td>
                      <td className="py-3 pr-4 text-sm font-semibold text-right text-slate-800">
                        {typeof v.Total === "number" ? v.Total.toFixed(2) : v.Total}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge statusId={v.Status_Id} statusNombre={v.StatusNombre || v.Status} />
                      </td>
                      <td className="py-3 pr-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              if (v.Status_Id === 1) setVentaEditando(v.Venta_Id);
                              else navigate(`/ventas/${v.Venta_Id}`);
                            }}
                            className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition"
                          >
                            {v.Status_Id === 1 ? "Editar" : "Ver"}
                          </button>
                          {v.Status_Id !== 3 && (
                            <button
                              onClick={(e) => handleEliminar(v.Venta_Id, e)}
                              className="rounded-[9px] border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                            >
                              Eliminar
                            </button>
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

      <ModalEditarVenta
        ventaId={ventaEditando}
        isOpen={!!ventaEditando}
        onClose={() => setVentaEditando(null)}
        onSuccess={cargarVentas}
      />
    </div>
  );
}

export default ListaVentas;
