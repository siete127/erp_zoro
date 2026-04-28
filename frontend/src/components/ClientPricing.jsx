import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { notify } from '../services/notify';

const ClientPricing = ({ clientId }) => {
  const [products, setProducts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState({
    newPrice: '',
    approver1Email: '',
    approver2Email: '',
    reason: ''
  });

  useEffect(() => {
    loadClientPrices();
    loadPendingRequests();
  }, [clientId]);

  const loadClientPrices = async () => {
    try {
      const res = await api.get(`/client-pricing/client/${clientId}/prices`);
      setProducts(res.data.data);
    } catch {
      console.error('Error al cargar precios');
    }
  };

  const loadPendingRequests = async () => {
    try {
      const res = await api.get('/client-pricing/price-change-requests/pending');
      setPendingRequests(res.data.data);
    } catch {
      console.error('Error al cargar solicitudes');
    }
  };

  const handleRequestPriceChange = (product) => {
    setSelectedProduct(product);
    setFormData({
      newPrice: product.CustomPrice || product.BasePrice || '',
      approver1Email: '',
      approver2Email: '',
      reason: ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/client-pricing/price-change-request', {
        clientId,
        productId: selectedProduct.Product_Id,
        newPrice: parseFloat(formData.newPrice),
        approver1Email: formData.approver1Email,
        approver2Email: formData.approver2Email,
        reason: formData.reason
      });
      notify('Solicitud enviada. Se requiere aprobación de ambos correos.', 'success');
      setShowModal(false);
      loadPendingRequests();
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      notify('Error al crear solicitud', 'error');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Precios Personalizados</h2>
      
      {/* Tabla de productos */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio Base</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio Personalizado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.map((product) => (
              <tr key={product.Product_Id}>
                <td className="px-6 py-4">{product.ProductName}</td>
                <td className="px-6 py-4">${product.BasePrice?.toFixed(2)}</td>
                <td className="px-6 py-4">
                  {product.CustomPrice ? (
                    <span className="text-green-600 font-semibold">${product.CustomPrice.toFixed(2)}</span>
                  ) : (
                    <span className="text-gray-400">Sin precio personalizado</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleRequestPriceChange(product)}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Solicitar Cambio
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Solicitudes pendientes */}
      {pendingRequests.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">Solicitudes Pendientes</h3>
          <div className="space-y-4">
            {pendingRequests.map((req) => (
              <div key={req.Request_Id} className="border rounded p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{req.ClientName} - {req.ProductName}</p>
                    <p className="text-sm text-gray-600">Nuevo precio: ${req.NewPrice}</p>
                    <p className="text-sm text-gray-600">Solicitado por: {req.RequestedByName}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        req.Approver1_Status === 'approved' ? 'bg-green-100 text-green-800' :
                        req.Approver1_Status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        Aprobador 1: {req.Approver1_Status}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        req.Approver2_Status === 'approved' ? 'bg-green-100 text-green-800' :
                        req.Approver2_Status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        Aprobador 2: {req.Approver2_Status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{new Date(req.CreatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de solicitud */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Solicitar Cambio de Precio</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Producto</label>
                <input
                  type="text"
                  value={selectedProduct?.ProductName}
                  disabled
                  className="w-full px-3 py-2 border rounded bg-gray-100"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Nuevo Precio</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.newPrice}
                  onChange={(e) => setFormData({...formData, newPrice: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Email Aprobador 1</label>
                <input
                  type="email"
                  value={formData.approver1Email}
                  onChange={(e) => setFormData({...formData, approver1Email: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Email Aprobador 2</label>
                <input
                  type="email"
                  value={formData.approver2Email}
                  onChange={(e) => setFormData({...formData, approver2Email: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Razón del cambio</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  rows="3"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Enviar Solicitud
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
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
};

export default ClientPricing;
