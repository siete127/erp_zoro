import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { notify } from '../services/notify';
import confirm from '../services/confirm';

export default function ClientRecurringProducts({ clientId, onClose }) {
  const [recurringProducts, setRecurringProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRecurringProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/clients/${clientId}/recurring-products`);
      setRecurringProducts(res.data?.data || []);
    } catch (err) {
      console.error('Error cargando productos recurrentes', err);
      notify('Error cargando productos recurrentes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProducts = async () => {
    try {
      const res = await api.get('/productos?activo=true');
      setAllProducts(res.data?.data || []);
    } catch (err) {
      console.error('Error cargando catálogo de productos', err);
      notify('Error cargando catálogo de productos', 'error');
    }
  };

  useEffect(() => {
    fetchRecurringProducts();
  }, [clientId]);

  const handleAddProduct = async (productoId) => {
    try {
      await api.post(`/clients/${clientId}/recurring-products`, { Producto_Id: productoId });
      notify('Producto agregado a recurrentes', 'success');
      await fetchRecurringProducts();
      setShowAddModal(false);
      setSearchQuery('');
    } catch (err) {
      console.error('Error agregando producto recurrente', err);
      const msg = err.response?.data?.msg || 'Error agregando producto';
      notify(msg, 'error');
    }
  };

  const handleRemoveProduct = async (productoId) => {
    const ok = await confirm('¿Eliminar este producto de la lista de recurrentes?', 'Confirmar', 'Eliminar', 'Cancelar');
    if (!ok) return;
    
    try {
      await api.delete(`/clients/${clientId}/recurring-products/${productoId}`);
      notify('Producto eliminado de recurrentes', 'success');
      await fetchRecurringProducts();
    } catch (err) {
      console.error('Error eliminando producto recurrente', err);
      notify('Error eliminando producto', 'error');
    }
  };

  const openAddModal = () => {
    fetchAllProducts();
    setShowAddModal(true);
  };

  const filteredProducts = allProducts.filter(p => {
    const q = searchQuery.toLowerCase();
    const isAlreadyRecurring = recurringProducts.some(rp => rp.Producto_Id === p.Producto_Id);
    if (isAlreadyRecurring) return false;
    return (p.SKU || '').toLowerCase().includes(q) || 
           (p.Nombre || '').toLowerCase().includes(q) || 
           (p.Descripcion || '').toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-[#092052] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Productos Recurrentes</h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full p-2">
            <span className="text-2xl">×</span>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">Productos que este cliente compra frecuentemente</p>
            <button onClick={openAddModal} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Agregar Producto
            </button>
          </div>

          {loading ? (
            <p className="text-gray-600">Cargando...</p>
          ) : recurringProducts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-2">No hay productos recurrentes configurados</p>
              <p className="text-sm text-gray-500">Agrega productos que este cliente compra frecuentemente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recurringProducts.map(rp => (
                <div key={rp.RecurringProduct_Id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-500">{rp.SKU}</span>
                      <span className="text-sm font-bold text-gray-900">{rp.Nombre}</span>
                    </div>
                    {rp.Descripcion && (
                      <p className="text-xs text-gray-600 mb-2">{rp.Descripcion}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>Precio: ${parseFloat(rp.Precio || 0).toFixed(2)} {rp.TipoMoneda || ''}</span>
                      <span>IVA: {rp.ImpuestoIVA}%</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveProduct(rp.Producto_Id)}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal para agregar producto */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-[#092052] px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Catálogo de Productos</h3>
              <button onClick={() => { setShowAddModal(false); setSearchQuery(''); }} className="text-white hover:bg-white/20 rounded-full p-2">
                <span className="text-2xl">×</span>
              </button>
            </div>

            <div className="p-4 border-b border-gray-200">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por SKU, nombre o descripción..."
                className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 placeholder-gray-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredProducts.length === 0 ? (
                <p className="text-center text-gray-600 py-8">
                  {searchQuery ? 'No se encontraron productos' : 'No hay productos disponibles'}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map(p => (
                    <div key={p.Producto_Id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center justify-between hover:bg-gray-100">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-500">{p.SKU}</span>
                          <span className="text-sm font-bold text-gray-900">{p.Nombre}</span>
                        </div>
                        {p.Descripcion && (
                          <p className="text-xs text-gray-600 mb-1">{p.Descripcion}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <span>Precio: ${parseFloat(p.Precio || 0).toFixed(2)} {p.TipoMoneda || ''}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAddProduct(p.Producto_Id)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Agregar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
