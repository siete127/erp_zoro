import React, { useState, useEffect } from "react";
import { ventaService } from "../services/ventaService";
import { notify } from "../services/notify";
import ProductoBuscador from "../pages/ventas/ProductoBuscador";
import TablaProductos from "../pages/ventas/TablaProductos";
import axios from "axios";
import io from "socket.io-client";
import { getSocketUrl } from "../services/socketConfig";

function ModalEditarVenta({ ventaId, isOpen, onClose, onSuccess }) {
  const [cliente, setCliente] = useState({ Client_Id: null, ClienteRFC: "", ClienteNombre: "" });
  const [productos, setProductos] = useState([]);
  const [originalPrices, setOriginalPrices] = useState({});
  const [priceChangeRequest, setPriceChangeRequest] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && ventaId) {
      cargarVenta();
    }
  }, [isOpen, ventaId]);

  useEffect(() => {
    const socketConnection = io(getSocketUrl());
    setSocket(socketConnection);
    
    socketConnection.on('priceRequestUpdate', (data) => {
      if (priceChangeRequest && data.requestId === priceChangeRequest.requestId) {
        setPriceChangeRequest(prev => ({
          ...prev,
          approver1Status: data.approver1Status,
          approver2Status: data.approver2Status,
          status: data.status
        }));
        
        if (data.status === 'completed') {
          notify('✓ Solicitud aprobada! Puedes completar la venta.', 'success');
        }
      }
    });
    
    return () => socketConnection.disconnect();
  }, [priceChangeRequest]);

  const cargarVenta = async () => {
    setLoading(true);
    try {
      const res = await ventaService.getVentaDetalle(ventaId);
      const { venta, detalle, solicitudesPrecio } = res.data;
      
      setCliente({
        Client_Id: venta.Client_Id,
        ClienteRFC: venta.ClienteRFC,
        ClienteNombre: venta.ClienteNombre
      });
      
      const productosFormateados = detalle.map(d => ({
        Producto_Id: d.Producto_Id,
        Nombre: d.ProductoNombre,
        Codigo: d.ProductoCodigo,
        Cantidad: d.Cantidad,
        PrecioUnitario: d.PrecioUnitario
      }));
      
      setProductos(productosFormateados);
      
      const prices = {};
      productosFormateados.forEach(p => {
        prices[p.Producto_Id] = p.PrecioUnitario;
      });
      setOriginalPrices(prices);
      
      if (solicitudesPrecio && solicitudesPrecio.length > 0) {
        const solicitud = solicitudesPrecio[0];
        setPriceChangeRequest({
          requestId: solicitud.Solicitud_Id,
          productos: productosFormateados.map(p => p.Producto_Id),
          status: solicitud.Estado,
          approver1Status: solicitud.EstadoAprobador1,
          approver2Status: solicitud.EstadoAprobador2,
          cantidadProductos: solicitud.CantidadProductos
        });
      }
    } catch (error) {
      notify('Error al cargar venta', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCompletarVenta = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/ventas/${ventaId}`, 
        { Status_Id: 2 },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      notify('Venta completada exitosamente', 'success');
      onSuccess();
      onClose();
    } catch (error) {
      notify('Error al completar venta', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 overflow-auto">
      <div className="min-h-screen flex items-start sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full max-w-6xl sm:my-4 flex flex-col min-h-screen sm:min-h-0 sm:max-h-[95vh]">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b flex-shrink-0 bg-white sticky top-0 z-10">
            <div>
              <h2 className="text-base sm:text-2xl font-bold text-gray-900">Editar Venta Pendiente #{ventaId}</h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Revisa el estado de las aprobaciones de precio
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {loading ? (
              <p className="text-gray-900">Cargando...</p>
            ) : (
              <>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Cliente</h3>
                  <p className="text-sm"><span className="text-gray-600">Nombre:</span> {cliente.ClienteNombre}</p>
                  <p className="text-sm"><span className="text-gray-600">RFC:</span> {cliente.ClienteRFC}</p>
                </div>

                {priceChangeRequest && (
                  <div className="bg-white border-2 rounded-lg p-5 mb-4" style={{
                    borderColor: priceChangeRequest.status === 'completed' ? '#10b981' : 
                                priceChangeRequest.status === 'rejected' ? '#ef4444' : '#f59e0b'
                  }}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 mb-1">Solicitud de Cambio de Precio</h3>
                        <p className="text-sm text-gray-600">ID: {priceChangeRequest.requestId} • {priceChangeRequest.cantidadProductos || priceChangeRequest.productos.length} producto(s)</p>
                      </div>
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                        priceChangeRequest.status === 'completed' ? 'bg-green-100 text-green-800' :
                        priceChangeRequest.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {priceChangeRequest.status === 'completed' ? '✓ Aprobada' : 
                         priceChangeRequest.status === 'rejected' ? '✗ Rechazada' : 
                         '⏳ Pendiente'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-3 h-3 rounded-full ${
                            priceChangeRequest.approver1Status === 'approved' ? 'bg-green-500' :
                            priceChangeRequest.approver1Status === 'rejected' ? 'bg-red-500' :
                            'bg-yellow-500'
                          }`}></span>
                          <span className="text-sm font-semibold text-gray-700">Aprobador 1</span>
                        </div>
                        <p className={`text-sm font-medium ${
                          priceChangeRequest.approver1Status === 'approved' ? 'text-green-700' :
                          priceChangeRequest.approver1Status === 'rejected' ? 'text-red-700' :
                          'text-yellow-700'
                        }`}>
                          {priceChangeRequest.approver1Status === 'approved' ? '✓ Aprobado' :
                           priceChangeRequest.approver1Status === 'rejected' ? '✗ Rechazado' :
                           '⏳ Pendiente'}
                        </p>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-3 h-3 rounded-full ${
                            priceChangeRequest.approver2Status === 'approved' ? 'bg-green-500' :
                            priceChangeRequest.approver2Status === 'rejected' ? 'bg-red-500' :
                            'bg-yellow-500'
                          }`}></span>
                          <span className="text-sm font-semibold text-gray-700">Aprobador 2</span>
                        </div>
                        <p className={`text-sm font-medium ${
                          priceChangeRequest.approver2Status === 'approved' ? 'text-green-700' :
                          priceChangeRequest.approver2Status === 'rejected' ? 'text-red-700' :
                          'text-yellow-700'
                        }`}>
                          {priceChangeRequest.approver2Status === 'approved' ? '✓ Aprobado' :
                           priceChangeRequest.approver2Status === 'rejected' ? '✗ Rechazado' :
                           '⏳ Pendiente'}
                        </p>
                      </div>
                    </div>
                    
                    {priceChangeRequest.status === 'pending' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-800 font-medium">
                          ⏳ Esperando aprobaciones. La venta se completará cuando ambos aprobadores confirmen.
                        </p>
                      </div>
                    )}
                    {priceChangeRequest.status === 'completed' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm text-green-800 font-medium">
                          ✓ Solicitud aprobada. Puedes completar la venta ahora.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <h3 className="text-sm font-semibold text-gray-900 mb-2">Productos de la venta</h3>
                <TablaProductos productos={productos} editable={false} />
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 sm:px-6 sm:py-4 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
            >
              Cerrar
            </button>
            {priceChangeRequest?.status === 'completed' && (
              <button
                onClick={handleCompletarVenta}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              >
                Completar Venta
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModalEditarVenta;
