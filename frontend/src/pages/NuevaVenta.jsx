import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ventaService } from "../services/ventaService";
import { notify } from "../services/notify";
import { getDefaultCompanyId } from "../utils/tokenHelper";
import ClienteSelector from "./ventas/ClienteSelector";
import ProductoBuscador from "./ventas/ProductoBuscador";
import TablaProductos from "./ventas/TablaProductos";
import MultiProductPriceChangeModal from "../components/MultiProductPriceChangeModal";
import axios from "axios";
import io from "socket.io-client";
import { getSocketUrl } from "../services/socketConfig";

function NuevaVenta() {
  const { ventaId } = useParams(); // Para modo edición
  const [cliente, setCliente] = useState({ Client_Id: null, ClienteRFC: "", ClienteNombre: "" });
  const [productos, setProductos] = useState([]);
  const [originalPrices, setOriginalPrices] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceChangeRequest, setPriceChangeRequest] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [ventaData, setVentaData] = useState(null);
  const [recurringProducts, setRecurringProducts] = useState([]);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [userCompanyId, setUserCompanyId] = useState(1);
  const navigate = useNavigate();

  // Extraer empresas del usuario desde el token
  useEffect(() => {
    const companyId = getDefaultCompanyId();
    setUserCompanyId(companyId);
  }, []);

  // Cargar venta existente si estamos en modo edición
  useEffect(() => {
    if (ventaId) {
      cargarVenta(ventaId);
    }
  }, [ventaId]);

  const cargarVenta = async (id) => {
    try {
      const res = await ventaService.getVentaDetalle(id);
      const { venta, detalle, solicitudesPrecio } = res.data;
      
      setIsEditMode(true);
      setVentaData(venta);
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
      
      // Establecer precios originales
      const prices = {};
      productosFormateados.forEach(p => {
        prices[p.Producto_Id] = p.PrecioUnitario;
      });
      setOriginalPrices(prices);
      
      // Cargar solicitudes de precio si existen
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
      console.error('Error al cargar venta:', error);
      notify('Error al cargar venta', 'error');
    }
  };

  const verificarSolicitudesPendientes = async (ventaId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/client-pricing/price-change-requests/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allPending = res.data.data;
      
      // Buscar solicitudes relacionadas con esta venta
      const ventaPending = allPending.find(p => p.Venta_Id === parseInt(ventaId));
      
      if (ventaPending) {
        setPriceChangeRequest({
          requestId: ventaPending.Request_Id,
          productos: [], // Cargar desde detalle si es necesario
          status: ventaPending.Status,
          approver1Status: ventaPending.Approver1_Status,
          approver2Status: ventaPending.Approver2_Status
        });
      }
    } catch (error) {
      console.error('Error al verificar solicitudes:', error);
    }
  };

  useEffect(() => {
    // Si hay una solicitud pendiente, hacer polling del estado cada 3 segundos
    if (!priceChangeRequest || priceChangeRequest.status !== 'pending') {
      return;
    }

    console.log('📋 Iniciando polling del estado de la solicitud...');
    const pollInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `/api/client-pricing/price-change-request/${priceChangeRequest.requestId}/status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          const data = response.data.data;
          console.log('📨 Polling result:', data);
          
          const isApprover1Approved = data.approver1Status === 'approved' || data.approver1Status === 'aprobado';
          const isApprover2Approved = data.approver2Status === 'approved' || data.approver2Status === 'aprobado';
          const isRejected = (data.approver1Status === 'rejected' || data.approver1Status === 'rechazado') || 
                            (data.approver2Status === 'rejected' || data.approver2Status === 'rechazado');
          const isCompleted = isApprover1Approved && isApprover2Approved;
          
          const newStatus = isRejected ? 'rejected' : (isCompleted ? 'approved' : 'pending');
          
          // Solo actualizar si hay cambio
          if (newStatus !== priceChangeRequest.status || 
              data.approver1Status !== priceChangeRequest.approver1Status ||
              data.approver2Status !== priceChangeRequest.approver2Status) {
            
            console.log('✅ Cambio detectado via polling');
            setPriceChangeRequest(prev => ({
              ...prev,
              approver1Status: data.approver1Status,
              approver2Status: data.approver2Status,
              status: newStatus
            }));
            
            if (isCompleted) {
              notify('✓ ¡Ambos aprobadores aprobaron! Ahora puedes guardar la venta.', 'success');
              clearInterval(pollInterval);
            } else if (isRejected) {
              notify('✗ Solicitud rechazada. Ajusta los precios.', 'error');
              clearInterval(pollInterval);
            }
          }
        }
      } catch (error) {
        console.error('Error en polling:', error);
      }
    }, 3000); // Polling cada 3 segundos

    return () => clearInterval(pollInterval);
  }, [priceChangeRequest?.requestId, priceChangeRequest?.status]);

  // Socket.io para actualizaciones en tiempo real
  useEffect(() => {
    if (!priceChangeRequest) return;
    
    const socketConnection = io(getSocketUrl());
    setSocket(socketConnection);
    
    socketConnection.on('connect', () => {
      console.log('✅ Socket.io CONECTADO:', socketConnection.id);
    });

    socketConnection.on('priceRequestUpdate', (data) => {
      console.log('🔔 Actualización en tiempo real recibida:', data);
      
      if (priceChangeRequest && data.requestId === priceChangeRequest.requestId) {
        console.log('✓ Coincide con el requestId actual');
        const isApprover1Approved = data.approver1Status === 'approved' || data.approver1Status === 'aprobado';
        const isApprover2Approved = data.approver2Status === 'approved' || data.approver2Status === 'aprobado';
        const isRejected = (data.approver1Status === 'rejected' || data.approver1Status === 'rechazado') || 
                          (data.approver2Status === 'rejected' || data.approver2Status === 'rechazado');
        const isCompleted = isApprover1Approved && isApprover2Approved;
        
        const newStatus = isRejected ? 'rejected' : (isCompleted ? 'approved' : 'pending');
        
        console.log('Estados:', { isApprover1Approved, isApprover2Approved, isRejected, isCompleted, newStatus });
        
        setPriceChangeRequest(prev => ({
          ...prev,
          approver1Status: data.approver1Status,
          approver2Status: data.approver2Status,
          status: newStatus
        }));
        
        if (isCompleted) {
          notify('✓ ¡Ambos aprobadores aprobaron! Ahora puedes guardar la venta.', 'success');
        } else if (isRejected) {
          notify('✗ Solicitud rechazada. Ajusta los precios.', 'error');
        }
      } else {
        console.log('✗ No coincide con el requestId actual');
      }
    });

    socketConnection.on('disconnect', () => {
      console.log('❌ Socket.io desconectado');
    });
    
    return () => {
      socketConnection.disconnect();
    };
  }, [priceChangeRequest]);

  const checkPendingRequest = async () => {
    if (!priceChangeRequest) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/client-pricing/price-change-requests/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allPending = res.data.data;
      const updated = allPending.find(p => p.Request_Id === priceChangeRequest.requestId);
      
      if (updated) {
        setPriceChangeRequest(prev => ({
          ...prev,
          status: updated.Status,
          approver1Status: updated.Approver1_Status,
          approver2Status: updated.Approver2_Status
        }));
      }
    } catch (error) {
      console.error('Error al verificar solicitud:', error);
    }
  };

  const handleClienteSelect = (data) => {
    setCliente(data);
    if (data.Client_Id) {
      fetchRecurringProducts(data.Client_Id);
    }
  };

  const fetchRecurringProducts = async (clientId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/clients/${clientId}/recurring-products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecurringProducts(res.data?.data || []);
    } catch (error) {
      console.error('Error al cargar productos recurrentes:', error);
      setRecurringProducts([]);
    }
  };

  const handleAgregarProducto = (producto) => {
    setProductos((prev) => {
      const idx = prev.findIndex((p) => p.Producto_Id === producto.Producto_Id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          Cantidad: Number(copy[idx].Cantidad || 0) + 1,
        };
        return copy;
      }
      
      const precioOriginal = Number(producto.Precio || producto.PrecioVenta || 0);
      setOriginalPrices(prev => ({ ...prev, [producto.Producto_Id]: precioOriginal }));
      
      return [
        ...prev,
        {
          Producto_Id: producto.Producto_Id,
          Nombre: producto.Nombre,
          Codigo: producto.SKU,
          Cantidad: 1,
          PrecioUnitario: precioOriginal,
        },
      ];
    });
  };

  const handleAddToRecurring = async (productoId) => {
    if (!cliente.Client_Id) {
      notify('Selecciona un cliente primero', 'error');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/clients/${cliente.Client_Id}/recurring-products`, 
        { Producto_Id: productoId },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      notify('Producto agregado a recurrentes', 'success');
      await fetchRecurringProducts(cliente.Client_Id);
    } catch (error) {
      const msg = error.response?.data?.msg || 'Error al agregar a recurrentes';
      notify(msg, 'error');
    }
  };

  const handleActualizarProducto = (index, field, value) => {
    setProductos((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: field === "Cantidad" || field === "PrecioUnitario" ? Number(value) : value,
      };
      return copy;
    });
  };

  const handleEliminarProducto = (index) => {
    setProductos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRequestPriceChanges = () => {
    if (!cliente.Client_Id) {
      notify("Debe seleccionar un cliente primero", "error");
      return;
    }
    
    const productosConCambio = productos.filter(p => {
      const precioOriginal = originalPrices[p.Producto_Id];
      return precioOriginal && p.PrecioUnitario !== precioOriginal;
    }).map(p => ({
      ...p,
      originalPrice: originalPrices[p.Producto_Id]
    }));
    
    if (productosConCambio.length === 0) {
      notify("No hay productos con cambios de precio", "info");
      return;
    }
    
    setShowPriceModal(true);
  };

  const handlePriceRequestCreated = (requestId, productos) => {
    setPriceChangeRequest({
      requestId,
      productos: productos.map(p => p.Producto_Id),
      status: 'pending',
      approver1Status: 'pending',
      approver2Status: 'pending'
    });
    notify('Solicitud de cambio de precio enviada. Esperando aprobaciones.', 'info');
  };

  const handleGuardarVenta = async () => {
    if (!cliente.Client_Id) {
      notify("Debe seleccionar un cliente", "error");
      return;
    }
    if (productos.length === 0) {
      notify("Debe agregar al menos un producto", "error");
      return;
    }

    // Verificar si hay cambios de precio
    const hasPriceChanges = productos.some(p => {
      const precioOriginal = originalPrices[p.Producto_Id];
      return precioOriginal && p.PrecioUnitario !== precioOriginal;
    });

    const pendingRequest = priceChangeRequest?.status === 'pending';
    const approvedRequest = priceChangeRequest?.status === 'approved';
    const rejectedRequest = priceChangeRequest?.status === 'rejected';
    
    if (rejectedRequest) {
      notify("La solicitud de precio fue rechazada. Por favor ajuste los precios o elimine los productos.", "error");
      return;
    }

    setGuardando(true);
    try {
      // Si NO hay cambios de precio, crear como Completada (Status_Id = 2)
      // Si hay cambios pendientes, crear como Pendiente (Status_Id = 1)
      // Si hay cambios aprobados, crear como Completada (Status_Id = 2)
      const statusId = (!hasPriceChanges || approvedRequest) ? 2 : 1;
      
      const ventaRes = await ventaService.createVenta({
        Company_Id: userCompanyId,
        Client_Id: cliente.Client_Id,
        Moneda: "MXN",
        Status_Id: statusId,
      });
      const ventaData = ventaRes?.data || ventaRes;
      const ventaId = ventaData.Venta_Id;

      await ventaService.addProductos(ventaId, productos);
      
      if (pendingRequest) {
        notify("Venta guardada como PENDIENTE. Aprobar solicitud de precio para completarla.", "info");
      } else if (approvedRequest) {
        notify("Venta guardada como COMPLETADA. Cambios de precio aprobados.", "success");
      } else {
        notify("Venta guardada correctamente", "success");
      }
      
      navigate(`/ventas/${ventaId}`);
    } catch (error) {
      console.error("Error al guardar venta", error.response?.data || error);
      const backendMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message;
      notify(backendMsg || "Error al guardar venta", "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Editar venta pendiente' : 'Nueva venta'}
          </h2>
          <p className="text-sm text-gray-600">
            {isEditMode 
              ? 'Revisa el estado de las aprobaciones de precio y completa la venta' 
              : 'Captura de cliente y productos para generar una nueva venta.'}
          </p>
        </div>
      </div>

      <ClienteSelector onClienteSelect={handleClienteSelect} clienteData={cliente} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Productos</h3>
            {recurringProducts.length > 0 && (
              <button
                onClick={() => setShowAllProducts(!showAllProducts)}
                className="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                {showAllProducts ? 'Ver Recurrentes' : 'Ver Catálogo Completo'}
              </button>
            )}
          </div>
          
          {!cliente.Client_Id ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">Selecciona un cliente primero</p>
            </div>
          ) : showAllProducts || recurringProducts.length === 0 ? (
            <ProductoBuscador onAgregarProducto={handleAgregarProducto} />
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-96 overflow-y-auto">
              <p className="text-xs text-gray-600 mb-3">Productos recurrentes de este cliente:</p>
              <div className="space-y-2">
                {recurringProducts.map(rp => (
                  <div key={rp.Producto_Id} className="bg-gray-50 rounded p-2 flex items-center justify-between hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500">{rp.SKU}</span>
                        <span className="text-sm font-bold text-gray-900">{rp.Nombre}</span>
                      </div>
                      <p className="text-xs text-gray-600">${parseFloat(rp.Precio || 0).toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => handleAgregarProducto(rp)}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    >
                      Agregar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Productos de la venta</h3>
          <TablaProductos
            productos={productos}
            onActualizar={handleActualizarProducto}
            onEliminar={handleEliminarProducto}
            originalPrices={originalPrices}
            editable={true}
          />
          {cliente.Client_Id && productos.length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              <p className="mb-1">Agregar a productos recurrentes:</p>
              <div className="flex flex-wrap gap-1">
                {productos.filter(p => !recurringProducts.some(rp => rp.Producto_Id === p.Producto_Id)).map(p => (
                  <button
                    key={p.Producto_Id}
                    onClick={() => handleAddToRecurring(p.Producto_Id)}
                    className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                    title="Agregar a productos recurrentes"
                  >
                    + {p.Codigo}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {productos.some(p => originalPrices[p.Producto_Id] && p.PrecioUnitario !== originalPrices[p.Producto_Id]) && !priceChangeRequest && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-orange-900 mb-1">Cambios de Precio Detectados</h3>
              <p className="text-xs text-orange-700">
                Hay {productos.filter(p => originalPrices[p.Producto_Id] && p.PrecioUnitario !== originalPrices[p.Producto_Id]).length} producto(s) con precios modificados.
              </p>
            </div>
            <button
              onClick={handleRequestPriceChanges}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm font-medium"
            >
              Solicitar Aprobación
            </button>
          </div>
        </div>
      )}

      {priceChangeRequest && (
        <div className="bg-white border-2 rounded-lg p-5 mb-4" style={{
          borderColor: priceChangeRequest.status === 'approved' ? '#10b981' : 
                      priceChangeRequest.status === 'rejected' ? '#ef4444' : '#f59e0b'
        }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Solicitud de Cambio de Precio</h3>
              <p className="text-sm text-gray-600">ID: {priceChangeRequest.requestId} • {priceChangeRequest.cantidadProductos || priceChangeRequest.productos.length} producto(s)</p>
            </div>
            <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
              priceChangeRequest.status === 'approved' ? 'bg-green-100 text-green-800' :
              priceChangeRequest.status === 'rejected' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {priceChangeRequest.status === 'approved' ? '✓ Aprobada' : 
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
                ⏳ Esperando aprobaciones. La venta se completará automáticamente cuando ambos aprobadores confirmen.
              </p>
            </div>
          )}
          {priceChangeRequest.status === 'approved' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800 font-medium">
                ✓ Solicitud aprobada. Puedes completar la venta ahora.
              </p>
            </div>
          )}
          {priceChangeRequest.status === 'rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800 font-medium">
                ✗ Solicitud rechazada. Ajusta los precios o contacta al administrador.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={() => navigate("/ventas")}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
          disabled={guardando}
        >
          {isEditMode ? 'Volver' : 'Cancelar'}
        </button>
        {isEditMode && priceChangeRequest?.status === 'approved' && (
          <button
            onClick={async () => {
              try {
                const token = localStorage.getItem('token');
                await axios.put(`/api/ventas/${ventaId}`, 
                  { Status_Id: 2 },
                  { headers: { Authorization: `Bearer ${token}` }}
                );
                notify('Venta completada exitosamente', 'success');
                navigate('/ventas');
              } catch (error) {
                notify('Error al completar venta', 'error');
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Completar Venta
          </button>
        )}
        {!isEditMode && (
          <button
            onClick={handleGuardarVenta}
            disabled={guardando || (priceChangeRequest && priceChangeRequest.status === 'pending')}
            className={`px-6 py-2 rounded text-white font-medium ${
              guardando || (priceChangeRequest && priceChangeRequest.status === 'pending')
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {guardando ? 'Guardando...' : (priceChangeRequest && priceChangeRequest.status === 'pending' ? 'Esperando aprobaciones...' : 'Guardar Venta')}
          </button>
        )}
      </div>

      {showPriceModal && (
        <MultiProductPriceChangeModal
          productos={productos.filter(p => originalPrices[p.Producto_Id] && p.PrecioUnitario !== originalPrices[p.Producto_Id]).map(p => ({
            ...p,
            originalPrice: originalPrices[p.Producto_Id]
          }))}
          clientId={cliente.Client_Id}
          onClose={() => setShowPriceModal(false)}
          onRequestCreated={handlePriceRequestCreated}
        />
      )}
    </div>
  );
}

export default NuevaVenta;
