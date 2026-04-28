import React, { useState } from 'react';
import api from '../services/api';
import { notify } from '../services/notify';

const SalePriceChangeModal = ({ producto, clientId, onClose, onRequestCreated }) => {
  const defaultEmails = {
    approver1: import.meta.env.VITE_APPROVER1_EMAIL || 'gerente@ardabytec.com',
    approver2: import.meta.env.VITE_APPROVER2_EMAIL || 'director@ardabytec.com'
  };
  
  const [formData, setFormData] = useState({
    newPrice: producto.PrecioUnitario || '',
    approver1Email: defaultEmails.approver1,
    approver2Email: defaultEmails.approver2,
    reason: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    console.log('ClientId recibido:', clientId);
    console.log('ProductId:', producto.Producto_Id);
    
    if (!clientId) {
      notify('Error: No se ha seleccionado un cliente', 'error');
      setLoading(false);
      return;
    }
    
    try {
      const response = await api.post('/client-pricing/price-change-request', {
        clientId,
        productId: producto.Producto_Id,
        newPrice: parseFloat(formData.newPrice),
        approver1Email: formData.approver1Email,
        approver2Email: formData.approver2Email,
        reason: formData.reason,
        saleId: null
      });
      
      onRequestCreated(response.data.requestId, producto.Producto_Id, parseFloat(formData.newPrice));
      onClose();
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      notify('Error al crear solicitud de cambio de precio', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">Solicitar Cambio de Precio</h3>
        
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
          <p className="text-sm text-yellow-700">
            ⚠️ La venta no se podrá guardar hasta que ambos aprobadores confirmen el cambio de precio.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Producto</label>
            <input
              type="text"
              value={producto.Nombre}
              disabled
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Precio Actual</label>
            <input
              type="text"
              value={`$${producto.PrecioUnitario?.toFixed(2)}`}
              disabled
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Nuevo Precio *</label>
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
            <label className="block text-sm font-medium mb-2">Email Aprobador 1 *</label>
            <input
              type="email"
              value={formData.approver1Email}
              disabled
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Email Aprobador 2 *</label>
            <input
              type="email"
              value={formData.approver2Email}
              disabled
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Razón del cambio</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
              className="w-full px-3 py-2 border rounded"
              rows="3"
              placeholder="Explique por qué se requiere este cambio de precio..."
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalePriceChangeModal;
