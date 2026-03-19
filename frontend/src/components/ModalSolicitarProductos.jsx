import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { notify } from '../services/notify';

export default function ModalSolicitarProductos({ isOpen, onClose, onConfirm }) {
  const [productos, setProductos] = useState([]);
  const [productosCatalogo, setProductosCatalogo] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      cargarProductos();
    }
  }, [isOpen]);

  const cargarProductos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/productos');
      setProductosCatalogo(res.data?.data || res.data || []);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      setLoading(false);
    }
  };

  const agregarProducto = (producto) => {
    const existe = productos.find(p => p.Producto_Id === producto.Producto_Id);
    if (existe) {
      setProductos(productos.map(p => 
        p.Producto_Id === producto.Producto_Id 
          ? { ...p, Cantidad: p.Cantidad + 1 }
          : p
      ));
    } else {
      setProductos([...productos, { 
        Producto_Id: producto.Producto_Id, 
        Nombre: producto.Nombre,
        SKU: producto.SKU,
        Cantidad: 1 
      }]);
    }
  };

  const actualizarCantidad = (productoId, cantidad) => {
    if (cantidad <= 0) {
      setProductos(productos.filter(p => p.Producto_Id !== productoId));
    } else {
      setProductos(productos.map(p => 
        p.Producto_Id === productoId ? { ...p, Cantidad: cantidad } : p
      ));
    }
  };

  const handleConfirmar = () => {
    if (productos.length === 0) {
      notify('Agrega al menos un producto', 'error');
      return;
    }
    onConfirm(productos);
    setProductos([]);
    onClose();
  };

  const productosFiltrados = productosCatalogo.filter(p => 
    p.Nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.SKU?.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">Solicitar productos</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Catálogo de productos */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Catálogo de productos</h3>
              <input
                type="text"
                placeholder="Buscar por nombre o SKU..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-sm"
              />
              <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                {loading ? (
                  <p className="p-4 text-sm text-gray-600">Cargando productos...</p>
                ) : productosFiltrados.length === 0 ? (
                  <p className="p-4 text-sm text-gray-600">No se encontraron productos</p>
                ) : (
                  productosFiltrados.map(producto => (
                    <div
                      key={producto.Producto_Id}
                      className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                      onClick={() => agregarProducto(producto)}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{producto.Nombre}</p>
                        <p className="text-xs text-gray-600">SKU: {producto.SKU}</p>
                      </div>
                      <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs">
                        + Agregar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Productos seleccionados */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Productos solicitados ({productos.length})
              </h3>
              <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                {productos.length === 0 ? (
                  <p className="p-4 text-sm text-gray-600">
                    No has agregado productos. Haz clic en "Agregar" del catálogo.
                  </p>
                ) : (
                  productos.map(producto => (
                    <div
                      key={producto.Producto_Id}
                      className="p-3 border-b border-gray-100 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{producto.Nombre}</p>
                        <p className="text-xs text-gray-600">SKU: {producto.SKU}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => actualizarCantidad(producto.Producto_Id, producto.Cantidad - 1)}
                          className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={producto.Cantidad}
                          onChange={(e) => actualizarCantidad(producto.Producto_Id, parseInt(e.target.value) || 0)}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm"
                          min="1"
                        />
                        <button
                          onClick={() => actualizarCantidad(producto.Producto_Id, producto.Cantidad + 1)}
                          className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                        >
                          +
                        </button>
                        <button
                          onClick={() => actualizarCantidad(producto.Producto_Id, 0)}
                          className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={productos.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            Confirmar solicitud ({productos.length} productos)
          </button>
        </div>
      </div>
    </div>
  );
}
