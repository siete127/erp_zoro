import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ventaService } from "../services/ventaService";
import { notify } from "../services/notify";
import TablaProductos from "./ventas/TablaProductos";
import ModalFacturacion from "./ventas/ModalFacturacion";
import StatusBadge from "./ventas/StatusBadge";
import confirm from "../services/confirm";
import Modal from "../components/Modal";
import ModalEnviarProduccion from "../components/ModalEnviarProduccion";

function DetalleVenta() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [venta, setVenta] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [solicitudesPrecio, setSolicitudesPrecio] = useState([]);
  const [loading, setLoading] = useState(false);
  const [facturando, setFacturando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [showProduccionModal, setShowProduccionModal] = useState(false);
  const [productosConFaltante, setProductosConFaltante] = useState([]);

  const cargarDetalle = async () => {
    setLoading(true);
    try {
      const res = await ventaService.getVentaDetalle(id);
      const data = res?.data || res;
      setVenta(data.venta || data.Venta || null);
      setDetalle(data.detalle || data.Detalle || []);
      setSolicitudesPrecio(data.solicitudesPrecio || []);
    } catch (error) {
      console.error("Error al obtener venta", error);
      notify(error.response?.data?.message || "Error al obtener venta", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) cargarDetalle();
  }, [id]);

  const handleFacturar = async (cfdiData) => {
    if (!venta) return;
    setFacturando(true);
    try {
      await ventaService.facturarVenta(venta.Venta_Id, cfdiData);
      notify("Venta facturada correctamente", "success");
      setShowFacturaModal(false);
      await cargarDetalle();
    } catch (error) {
      console.error("Error al facturar venta", error);
      const errorData = error.response?.data;
      
      // Si requiere producción, mostrar modal
      if (errorData?.requiereProduccion && errorData?.productos) {
        setProductosConFaltante(errorData.productos);
        setShowProduccionModal(true);
        notify(errorData.message || "Inventario insuficiente", "warning");
      } else {
        notify(errorData?.message || "Error al facturar venta", "error");
      }
    } finally {
      setFacturando(false);
    }
  };

  const handleCancelar = async () => {
    if (!venta) return;
    const ok = await confirm(
      "¿Deseas cancelar esta venta? Si ya está facturada, no se permitirá cancelar.",
      "Cancelar venta",
      "Cancelar venta",
      "Cerrar"
    );
    if (!ok) return;
    setCancelando(true);
    try {
      await ventaService.cancelarVenta(venta.Venta_Id);
      notify("Venta cancelada correctamente", "success");
      await cargarDetalle();
    } catch (error) {
      console.error("Error al cancelar venta", error);
      notify(error.response?.data?.message || "Error al cancelar venta", "error");
    } finally {
      setCancelando(false);
    }
  };

  const handleDescargarPDF = async () => {
    if (!venta) return;
    try {
      const response = await ventaService.descargarFacturaPDF(venta.Venta_Id);
      if (response.success && response.pdfUrl) {
        window.open(response.pdfUrl, '_blank');
        notify("Abriendo vista previa de la factura", "success");
      } else {
        notify("No se pudo obtener la URL del PDF", "error");
      }
    } catch (error) {
      console.error("Error al obtener PDF", error);
      notify(error.response?.data?.message || "Error al obtener PDF", "error");
    }
  };

  const productosTabla = detalle.map((d) => ({
    ...d,
    Nombre: d.ProductoNombre,
    Codigo: d.ProductoCodigo,
  }));

  const puedeFacturar = venta && venta.Status_Id === 2; // Completada
  const estaFacturada = venta && venta.Status_Id === 3;
  const tieneSolicitudesPendientes = solicitudesPrecio.some(s => s.Estado === 'pending');
  const todasSolicitudesAprobadas = solicitudesPrecio.length > 0 && solicitudesPrecio.every(s => s.Estado === 'completed');

  return (
    <>
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 overflow-auto">
      <div className="min-h-screen flex items-start sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full max-w-6xl sm:my-4 flex flex-col min-h-screen sm:min-h-0 sm:max-h-[95vh]">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b flex-shrink-0 bg-white sticky top-0 z-10">
            <div>
              <h2 className="text-base sm:text-2xl font-bold text-gray-900">Detalle de venta #{id}</h2>
              {venta && (
                <p className="text-xs sm:text-sm text-gray-600">
                  Cliente: <span className="font-medium">{venta.ClienteNombre}</span>
                </p>
              )}
            </div>
            <button
              onClick={() => navigate("/ventas")}
              className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm flex-shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">

      {loading && <p className="text-gray-900">Cargando detalle de la venta...</p>}

      {!loading && venta && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Información general</h3>
              <p><span className="text-gray-600">Cliente:</span> {venta.ClienteNombre}</p>
              <p><span className="text-gray-600">RFC:</span> {venta.ClienteRFC}</p>
              <p>
                <span className="text-gray-600">Fecha:</span>{" "}
                {venta.FechaVenta ? new Date(venta.FechaVenta).toLocaleString() : "-"}
              </p>
              <p><span className="text-gray-600">Moneda:</span> {venta.Moneda}</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Importes</h3>
              <p>
                <span className="text-gray-600">Subtotal:</span>{" "}
                {typeof venta.Subtotal === "number" ? venta.Subtotal.toFixed(2) : venta.Subtotal}
              </p>
              <p>
                <span className="text-gray-600">IVA:</span>{" "}
                {typeof venta.IVA === "number" ? venta.IVA.toFixed(2) : venta.IVA}
              </p>
              <p className="font-bold text-gray-900">
                <span className="text-gray-600 font-normal">Total:</span>{" "}
                {typeof venta.Total === "number" ? venta.Total.toFixed(2) : venta.Total}
              </p>
            </div>
          </div>

          {/* Sección de Estatus y Solicitudes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Estatus de Venta</h3>
              <StatusBadge statusId={venta.Status_Id} statusNombre={venta.StatusNombre || venta.Status} />
              {estaFacturada && (
                <p className="text-xs text-green-700 mt-2">
                  ✓ Esta venta ya está facturada.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={!puedeFacturar || facturando}
                  onClick={() => setShowFacturaModal(true)}
                  className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
                >
                  {facturando ? "Facturando..." : "Facturar venta"}
                </button>
                {estaFacturada && (
                  <button
                    onClick={handleDescargarPDF}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    📄 Ver Factura
                  </button>
                )}
                <button
                  disabled={estaFacturada || cancelando}
                  onClick={handleCancelar}
                  className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 text-sm"
                >
                  {cancelando ? "Cancelando..." : "Cancelar venta"}
                </button>
              </div>
            </div>

            {/* Solicitudes de Cambio de Precio */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Solicitudes de Precio</h3>
              {solicitudesPrecio.length === 0 ? (
                <p className="text-sm text-gray-500">No hay solicitudes de cambio de precio</p>
              ) : (
                <div className="space-y-4">
                  {solicitudesPrecio.map((sol) => (
                    <div key={sol.Solicitud_Id} className="border-l-4 pl-4 py-3 bg-white rounded" style={{
                      borderColor: sol.Estado === 'completed' ? '#10b981' : sol.Estado === 'rejected' ? '#ef4444' : '#f59e0b'
                    }}>
                      {/* Header con estado */}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-xs font-semibold text-gray-700">Solicitud #{sol.Solicitud_Id}</span>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(sol.FechaCreacion).toLocaleDateString('es-ES', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          sol.Estado === 'completed' ? 'bg-green-100 text-green-800' : 
                          sol.Estado === 'rejected' ? 'bg-red-100 text-red-800' : 
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {sol.Estado === 'completed' ? '✓ Aprobada' : sol.Estado === 'rejected' ? '✗ Rechazada' : '⏳ Pendiente'}
                        </span>
                      </div>

                      {/* Productos con cambios de precio */}
                      {sol.detalles && sol.detalles.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-700 mb-2">Cambios de Precio:</p>
                          <div className="space-y-2">
                            {sol.detalles.map((detalle, idx) => (
                              <div key={idx} className="bg-gray-100 p-2 rounded text-xs">
                                <p className="font-medium text-gray-900">{detalle.ProductoNombre}</p>
                                <div className="grid grid-cols-3 gap-2 mt-1 text-gray-700">
                                  <div>
                                    <span className="text-gray-500">Precio Anterior:</span>
                                    <p className="font-semibold">${parseFloat(detalle.PrecioActual || 0).toFixed(2)}</p>
                                  </div>
                                  <div className="flex items-center justify-center">
                                    <span className="text-gray-400">→</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Precio Nuevo:</span>
                                    <p className="font-semibold text-blue-600">${parseFloat(detalle.PrecioNuevo).toFixed(2)}</p>
                                  </div>
                                </div>
                                {detalle.PrecioActual && (
                                  <p className={`mt-1 text-xs font-semibold ${
                                    detalle.PrecioNuevo > detalle.PrecioActual ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {detalle.PrecioNuevo > detalle.PrecioActual ? '+' : ''}
                                    {((detalle.PrecioNuevo - detalle.PrecioActual) / detalle.PrecioActual * 100).toFixed(1)}%
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Estados de aprobadores */}
                      <div className="grid grid-cols-2 gap-2 text-xs mb-2 pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            sol.EstadoAprobador1 === 'approved' ? 'bg-green-500' : 
                            sol.EstadoAprobador1 === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'
                          }`}></span>
                          <span className="text-gray-600">Aprobador 1</span>
                          <span className="text-gray-500">({sol.EstadoAprobador1 || 'pendiente'})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            sol.EstadoAprobador2 === 'approved' ? 'bg-green-500' : 
                            sol.EstadoAprobador2 === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'
                          }`}></span>
                          <span className="text-gray-600">Aprobador 2</span>
                          <span className="text-gray-500">({sol.EstadoAprobador2 || 'pendiente'})</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {tieneSolicitudesPendientes && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-xs text-yellow-800 font-semibold">
                        ⚠️ Esperando aprobaciones para completar la venta
                      </p>
                    </div>
                  )}
                  {todasSolicitudesAprobadas && (
                    <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-xs text-green-800 font-semibold">
                        ✓ Todas las solicitudes aprobadas - Puede completar la venta
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-3">Productos de la venta</h3>
          <TablaProductos productos={productosTabla} editable={false} />
        </>
      )}

          {!loading && !venta && (
            <p className="text-gray-900">No se encontró la venta solicitada.</p>
          )}
          </div>
        </div>
      </div>

      <ModalFacturacion
        isOpen={showFacturaModal}
        onClose={() => setShowFacturaModal(false)}
        onFacturar={handleFacturar}
      />

      <Modal
        isOpen={showProduccionModal}
        onClose={() => setShowProduccionModal(false)}
        title="Enviar a Producción"
        size="lg"
      >
        <ModalEnviarProduccion
          venta={venta}
          productosConFaltante={productosConFaltante}
          onClose={() => setShowProduccionModal(false)}
          onSuccess={() => {
            setShowProduccionModal(false);
            cargarDetalle();
          }}
        />
      </Modal>
    </div>
    </>
  );
}

export default DetalleVenta;
