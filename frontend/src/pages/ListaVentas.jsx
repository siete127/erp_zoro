import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
      console.error("Error al cargar ventas", error);
      notify(error.response?.data?.message || "Error al cargar ventas", "error");
      setVentas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarVentas();
  }, []);

  useEffect(() => {
    const handler = () => {
      cargarVentas();
    };

    socket.on("venta:changed", handler);

    return () => {
      socket.off("venta:changed", handler);
    };
  }, []);

  const handleEliminar = async (ventaId, e) => {
    e.stopPropagation();
    if (!confirm('¿Está seguro de eliminar esta venta?')) return;

    try {
      await ventaService.deleteVenta(ventaId);
      notify('Venta eliminada correctamente', 'success');
      cargarVentas();
    } catch (error) {
      notify(error.response?.data?.message || 'Error al eliminar venta', 'error');
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ventas</h2>
          <p className="text-sm text-gray-600">Listado de ventas registradas en el ERP</p>
        </div>
        <button
          onClick={() => navigate("/ventas/nueva")}
          className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
        >
          + Nueva venta
        </button>
      </div>

      {loading ? (
        <p className="text-gray-900">Cargando ventas...</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-600">
                <th className="py-2 pl-4 pr-4 w-24">ID</th>
                <th className="py-2 pr-4">Cliente</th>
                <th className="py-2 pr-4 w-40">Fecha</th>
                <th className="py-2 pr-4 w-24 text-right">Total</th>
                <th className="py-2 pr-4 w-32">Estatus</th>
                <th className="py-2 pr-4 w-32 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ventas.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 px-4 text-sm text-gray-600">
                    No hay ventas registradas.
                  </td>
                </tr>
              )}
              {ventas.map((v) => (
                <tr
                  key={v.Venta_Id}
                  className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/ventas/${v.Venta_Id}`)}
                >
                  <td className="py-3 pl-4 pr-4 text-gray-900 text-sm">{v.Venta_Id}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm">{v.ClienteNombre}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm">
                    {v.FechaVenta ? new Date(v.FechaVenta).toLocaleString() : "-"}
                  </td>
                  <td className="py-3 pr-4 text-gray-900 text-sm text-right">
                    {typeof v.Total === "number" ? v.Total.toFixed(2) : v.Total}
                  </td>
                  <td className="py-3 pr-4 text-gray-900 text-sm">
                    <StatusBadge statusId={v.Status_Id} statusNombre={v.StatusNombre || v.Status} />
                  </td>
                  <td
                    className="py-3 pr-4 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex gap-2 justify-center">
                      <button 
                        onClick={() => {
                          if (v.Status_Id === 1) {
                            setVentaEditando(v.Venta_Id);
                          } else {
                            navigate(`/ventas/${v.Venta_Id}`);
                          }
                        }}
                        className="px-3 py-1 text-sm bg-[#092052] text-white rounded hover:bg-[#0d3a7a]"
                      >
                        {v.Status_Id === 1 ? 'Editar' : 'Ver'}
                      </button>
                      {v.Status_Id !== 3 && (
                        <button 
                          onClick={(e) => handleEliminar(v.Venta_Id, e)}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
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
