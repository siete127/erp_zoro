import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cotizacionService } from "../services/cotizacionService";
import { notify } from "../services/notify";
import confirm from "../services/confirm";

function CotizacionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await cotizacionService.getCotizacion(id);
      const d = res?.data || res;
      setData(d);
    } catch (error) {
      console.error("Error al cargar cotización", error);
      notify(error.response?.data?.message || "Error al cargar cotización", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [id]);

  const handleAprobar = async () => {
    if (!data?.cabecera) return;
    setProcesando(true);
    try {
      await cotizacionService.aprobarCotizacion(id, {});
      notify("Cotización aprobada", "success");
      await cargar();
    } catch (error) {
      console.error("Error al aprobar cotización", error);
      notify(error.response?.data?.message || "Error al aprobar cotización", "error");
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarPedido = async () => {
    if (!data?.cabecera) return;

    const ok = await confirm(
      "¿Deseas confirmar el pedido a partir de esta cotización? Se generará una orden de venta.",
      "Confirmar pedido",
      "Confirmar",
      "Cancelar"
    );
    if (!ok) return;

    setProcesando(true);
    try {
      const res = await cotizacionService.confirmarPedido(id);
      const d = res?.data || res;
      notify("Pedido generado a partir de la cotización", "success");
      if (d?.Venta_Id) {
        navigate(`/ventas/${d.Venta_Id}`);
      }
    } catch (error) {
      console.error("Error al confirmar pedido", error);
      notify(error.response?.data?.message || "Error al confirmar pedido", "error");
    } finally {
      setProcesando(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
        <p className="text-gray-900">Cargando cotización...</p>
      </div>
    );
  }

  const { cabecera, detalles } = data;

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto text-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cotización #{cabecera.ID_COTIZACION}</h2>
          <p className="text-sm text-gray-600">
            Cliente: {cabecera.ClienteNombre || cabecera.ClientLegalName || cabecera.ClientCommercialName || "-"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/cotizaciones")}
            className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs"
          >
            Volver
          </button>
          <button
            onClick={handleAprobar}
            disabled={procesando || cabecera.Status === "APROBADA" || cabecera.Status === "CONVERTIDA"}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs disabled:bg-gray-400"
          >
            Aprobar
          </button>
          <button
            onClick={handleConfirmarPedido}
            disabled={
              procesando ||
              !(cabecera.Status === "APROBADA" || cabecera.Status === "CONVERTIDA")
            }
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-xs disabled:bg-gray-400"
          >
            Confirmar pedido
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <h3 className="font-semibold text-gray-800 mb-1">Datos generales</h3>
          <div className="text-gray-700 text-xs">
            <div>Empresa: {cabecera.EmpresaCodigo}</div>
            <div>Moneda: {cabecera.Moneda}</div>
            <div>Vendedor: {cabecera.Vendedor || "-"}</div>
            <div>
              Vigencia: {cabecera.FechaVigencia ? new Date(cabecera.FechaVigencia).toLocaleDateString() : "-"}
            </div>
            <div>Status: {cabecera.Status}</div>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 mb-1">Totales</h3>
          <div className="text-gray-700 text-xs">
            <div>Subtotal: {cabecera.Subtotal?.toFixed ? cabecera.Subtotal.toFixed(2) : cabecera.Subtotal}</div>
            <div>IVA: {cabecera.IVA?.toFixed ? cabecera.IVA.toFixed(2) : cabecera.IVA}</div>
            <div>Total: {cabecera.TOTAL?.toFixed ? cabecera.TOTAL.toFixed(2) : cabecera.TOTAL}</div>
            <div>Margen %: {cabecera.MargenPorc != null ? Number(cabecera.MargenPorc).toFixed(2) : "-"}</div>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 mb-1">Comentarios</h3>
          <div className="text-gray-700 text-xs whitespace-pre-wrap">
            {cabecera.ComentarioDescuento || "Sin comentarios"}
          </div>
        </div>
      </div>

      <h3 className="font-semibold text-gray-800 mb-2">Detalle</h3>
      <div className="border border-gray-200 rounded max-h-[60vh] overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="py-2 px-2">Tipo</th>
              <th className="py-2 px-2">Descripción</th>
              <th className="py-2 px-2 w-20 text-right">Cant.</th>
              <th className="py-2 px-2 w-24 text-right">Precio</th>
              <th className="py-2 px-2 w-24 text-right">Subtotal</th>
              <th className="py-2 px-2 w-24 text-right">Margen %</th>
            </tr>
          </thead>
          <tbody>
            {!detalles || detalles.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-3 px-2 text-gray-600">
                  Sin renglones.
                </td>
              </tr>
            ) : (
              detalles.map((r) => (
                <tr key={r.ID_DETALLE} className="border-t border-gray-200">
                  <td className="py-1 px-2 text-gray-800">{r.TipoProducto}</td>
                  <td className="py-1 px-2 text-gray-800">{r.Descripcion}</td>
                  <td className="py-1 px-2 text-right text-gray-800">
                    {r.CANTIDAD?.toFixed ? r.CANTIDAD.toFixed(2) : r.CANTIDAD}
                  </td>
                  <td className="py-1 px-2 text-right text-gray-800">
                    {r.PRECIO_UNITARIO?.toFixed
                      ? r.PRECIO_UNITARIO.toFixed(2)
                      : r.PRECIO_UNITARIO}
                  </td>
                  <td className="py-1 px-2 text-right text-gray-800">
                    {r.SUBTOTAL?.toFixed ? r.SUBTOTAL.toFixed(2) : r.SUBTOTAL}
                  </td>
                  <td className="py-1 px-2 text-right text-gray-800">
                    {r.MARGEN_PCT != null ? Number(r.MARGEN_PCT).toFixed(2) : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CotizacionDetalle;
