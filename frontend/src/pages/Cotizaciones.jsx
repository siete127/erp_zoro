import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cotizacionService } from "../services/cotizacionService";
import { notify } from "../services/notify";
import { socket } from "../services/socket";

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
      console.error("Error al cargar cotizaciones", error);
      notify(error.response?.data?.message || "Error al cargar cotizaciones", "error");
      setCotizaciones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCotizaciones();
  }, []);

  useEffect(() => {
    const handler = () => {
      cargarCotizaciones();
    };

    socket.on("cotizacion:changed", handler);

    return () => {
      socket.off("cotizacion:changed", handler);
    };
  }, []);

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cotizaciones</h2>
          <p className="text-sm text-gray-600">Listado de cotizaciones y acceso al flujo de pedido.</p>
        </div>
        <button
          onClick={() => navigate("/cotizaciones/nueva")}
          className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
        >
          + Nueva cotización
        </button>
      </div>

      {loading ? (
        <p className="text-gray-900">Cargando cotizaciones...</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-gray-600">
                <th className="py-2 pl-4 pr-4 w-20">ID</th>
                <th className="py-2 pr-4">Cliente</th>
                <th className="py-2 pr-4 w-32">Empresa</th>
                <th className="py-2 pr-4 w-24 text-right">Subtotal</th>
                <th className="py-2 pr-4 w-24 text-right">Total</th>
                <th className="py-2 pr-4 w-24 text-right">Margen %</th>
                <th className="py-2 pr-4 w-32">Status</th>
                <th className="py-2 pr-4 w-40">Vigencia</th>
                <th className="py-2 pr-4 w-32 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-4 px-4 text-gray-600">
                    No hay cotizaciones registradas.
                  </td>
                </tr>
              )}
              {cotizaciones.map((c) => (
                <tr
                  key={c.ID_COTIZACION}
                  className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/cotizaciones/${c.ID_COTIZACION}`)}
                >
                  <td className="py-3 pl-4 pr-4 text-gray-900">{c.ID_COTIZACION}</td>
                  <td className="py-3 pr-4 text-gray-900">
                    {c.ClienteNombre || c.ClientLegalName || c.ClientCommercialName || "-"}
                  </td>
                  <td className="py-3 pr-4 text-gray-900">{c.EmpresaCodigo}</td>
                  <td className="py-3 pr-4 text-gray-900 text-right">
                    {typeof c.Subtotal === "number" ? c.Subtotal.toFixed(2) : c.Subtotal}
                  </td>
                  <td className="py-3 pr-4 text-gray-900 text-right">
                    {typeof c.TOTAL === "number" ? c.TOTAL.toFixed(2) : c.TOTAL}
                  </td>
                  <td className="py-3 pr-4 text-gray-900 text-right">
                    {c.MargenPorc != null ? Number(c.MargenPorc).toFixed(2) : "-"}
                  </td>
                  <td className="py-3 pr-4 text-gray-900">{c.Status}</td>
                  <td className="py-3 pr-4 text-gray-900">
                    {c.FechaVigencia ? new Date(c.FechaVigencia).toLocaleDateString() : "-"}
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <button
                      className="px-3 py-1 text-xs bg-[#092052] text-white rounded hover:bg-[#0d3a7a]"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/cotizaciones/${c.ID_COTIZACION}`);
                      }}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Cotizaciones;
