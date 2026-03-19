import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';

export default function CatalogoPrecios() {
  const [productos, setProductos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalSolicitud, setModalSolicitud] = useState(false);
  const [modalAprobacion, setModalAprobacion] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [precioNuevo, setPrecioNuevo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [solicitudAprobacion, setSolicitudAprobacion] = useState(null);
  const [codigoAprobacion, setCodigoAprobacion] = useState('');
  const [enviando, setEnviando] = useState(false);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/productos?limit=1000');
      setProductos(res.data?.data || []);
    } catch (err) {
      notify('Error cargando productos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSolicitudes = async () => {
    try {
      const res = await api.get('/precios/solicitudes');
      setSolicitudes(res.data || []);
    } catch (err) {
      notify('Error cargando solicitudes', 'error');
    }
  };

  useEffect(() => {
    fetchProductos();
    fetchSolicitudes();
  }, []);

  const abrirSolicitud = (producto) => {
    setProductoSeleccionado(producto);
    setPrecioNuevo(producto.Precio);
    setMotivo('');
    setModalSolicitud(true);
  };

  const enviarSolicitud = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post('/precios/solicitar', {
        Producto_Id: productoSeleccionado.Producto_Id,
        PrecioNuevo: parseFloat(precioNuevo),
        Motivo: motivo
      });
      notify('Solicitud enviada. Revise su correo para el código de aprobación.', 'success');
      setModalSolicitud(false);
      fetchSolicitudes();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al enviar solicitud', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const abrirAprobacion = (solicitud) => {
    setSolicitudAprobacion(solicitud);
    setCodigoAprobacion('');
    setModalAprobacion(true);
  };

  const aprobarCambio = async (e) => {
    e.preventDefault();
    try {
      await api.post('/precios/aprobar', {
        Solicitud_Id: solicitudAprobacion.Solicitud_Id,
        CodigoAprobacion: codigoAprobacion
      });
      notify('Cambio de precio aprobado', 'success');
      setModalAprobacion(false);
      fetchSolicitudes();
      fetchProductos();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al aprobar cambio', 'error');
    }
  };

  const eliminarSolicitud = async (solicitudId) => {
    try {
      await api.delete(`/precios/solicitudes/${solicitudId}`);
      notify('Solicitud eliminada', 'success');
      fetchSolicitudes();
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al eliminar solicitud', 'error');
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Catálogo de Precios</h2>
          <p className="text-sm text-gray-600">Gestión de precios con aprobación</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Solicitudes Pendientes</h3>
        <div className="overflow-auto max-h-48 border rounded">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-600 bg-gray-50">
                <th className="py-2 px-4">Producto</th>
                <th className="py-2 px-4">Precio Actual</th>
                <th className="py-2 px-4">Precio Nuevo</th>
                <th className="py-2 px-4">Estado</th>
                <th className="py-2 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.filter(s => s.Estado === 'PENDIENTE').map(s => (
                <tr key={s.Solicitud_Id} className="border-t">
                  <td className="py-2 px-4 text-sm">{s.Nombre}</td>
                  <td className="py-2 px-4 text-sm">${s.PrecioActual}</td>
                  <td className="py-2 px-4 text-sm">${s.PrecioNuevo}</td>
                  <td className="py-2 px-4 text-sm">{s.Estado}</td>
                  <td className="py-2 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirAprobacion(s)}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => eliminarSolicitud(s.Solicitud_Id)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
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

      {loading ? (
        <p className="text-gray-900">Cargando productos...</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-600">
                <th className="py-2 pl-4 pr-4">SKU</th>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4 text-right">Precio Actual</th>
                <th className="py-2 pr-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(p => (
                <tr key={p.Producto_Id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="py-3 pl-4 pr-4 text-sm">{p.SKU}</td>
                  <td className="py-3 pr-4 text-sm">{p.Nombre}</td>
                  <td className="py-3 pr-4 text-sm text-right">${p.Precio}</td>
                  <td className="py-3 pr-4 text-center">
                    <button
                      onClick={() => abrirSolicitud(p)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Solicitar Cambio
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalSolicitud && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Solicitar Cambio de Precio</h3>
            <form onSubmit={enviarSolicitud} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Producto</label>
                <input
                  type="text"
                  value={productoSeleccionado?.Nombre}
                  disabled
                  className="w-full px-3 py-2 border rounded bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Precio Actual</label>
                <input
                  type="text"
                  value={`$${productoSeleccionado?.Precio}`}
                  disabled
                  className="w-full px-3 py-2 border rounded bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Precio Nuevo *</label>
                <input
                  type="number"
                  step="0.01"
                  value={precioNuevo}
                  onChange={(e) => setPrecioNuevo(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Motivo</label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  type="submit" 
                  disabled={enviando}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {enviando ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalSolicitud(false)}
                  disabled={enviando}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalAprobacion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Aprobar Cambio de Precio</h3>
            <form onSubmit={aprobarCambio} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Producto</label>
                <input
                  type="text"
                  value={solicitudAprobacion?.Nombre}
                  disabled
                  className="w-full px-3 py-2 border rounded bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Código de Aprobación *</label>
                <input
                  type="text"
                  value={codigoAprobacion}
                  onChange={(e) => setCodigoAprobacion(e.target.value.toUpperCase())}
                  required
                  placeholder="Ingrese el código recibido por correo"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">
                  Aprobar
                </button>
                <button
                  type="button"
                  onClick={() => setModalAprobacion(false)}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
