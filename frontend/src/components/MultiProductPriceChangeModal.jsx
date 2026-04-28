import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { notify } from '../services/notify';

const MultiProductPriceChangeModal = ({ productos, clientId, onClose, onRequestCreated }) => {
  const [formData, setFormData] = useState({
    approver1Email: '',
    approver2Email: '',
    reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(true);

  // Cargar correos de aprobación desde la BD al abrir el modal
  useEffect(() => {
    const loadApprovalEmails = async () => {
      try {
        setLoadingEmails(true);
        // Intentar obtener correos directamente por client_id
        const emailRes = await api.get(`/config/precio-emails?client_id=${clientId}`);
        setFormData(prev => ({
          ...prev,
          approver1Email: emailRes.data.email1 || '',
          approver2Email: emailRes.data.email2 || ''
        }));
      } catch (err) {
        console.error('Error cargando correos de aprobación:', err);
        // Si falla, usar valores del .env como respaldo
        setFormData(prev => ({
          ...prev,
          approver1Email: import.meta.env.VITE_APPROVER1_EMAIL || '',
          approver2Email: import.meta.env.VITE_APPROVER2_EMAIL || ''
        }));
      } finally {
        setLoadingEmails(false);
      }
    };

    if (clientId) {
      loadApprovalEmails();
    }
  }, [clientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (!clientId) {
      notify('Error: No se ha seleccionado un cliente', 'error');
      setLoading(false);
      return;
    }
    
    try {
      const productDetails = productos.map(p => ({
        productId: p.Producto_Id,
        currentPrice: p.originalPrice,
        newPrice: p.PrecioUnitario
      }));

      const response = await api.post('/client-pricing/multi-price-change-request', {
        clientId,
        products: productDetails,
        approver1Email: formData.approver1Email,
        approver2Email: formData.approver2Email,
        reason: formData.reason,
        saleId: null
      });
      
      onRequestCreated(response.data.requestId, productos);
      onClose();
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      notify('Error al crear solicitud de cambio de precio', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalProducts = productos.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">Solicitar Cambios de Precio ({totalProducts} productos)</h3>
        
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
          <p className="text-sm text-yellow-700">
            ⚠️ La venta no se podrá guardar hasta que ambos aprobadores confirmen los cambios de precio.
          </p>
        </div>

        <div className="mb-4 max-h-60 overflow-y-auto border rounded p-3 bg-gray-50">
          <h4 className="font-semibold mb-2">Productos con cambio de precio:</h4>
          {productos.map((prod, idx) => (
            <div key={idx} className="flex justify-between items-center py-2 border-b last:border-b-0">
              <div className="flex-1">
                <p className="text-sm font-medium">{prod.Nombre}</p>
                <p className="text-xs text-gray-600">{prod.Codigo}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 line-through">${prod.originalPrice?.toFixed(2)}</p>
                <p className="text-sm font-bold text-green-600">${prod.PrecioUnitario?.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Email Aprobador 1 *</label>
            <input
              type="email"
              value={formData.approver1Email}
              onChange={(e) => setFormData({...formData, approver1Email: e.target.value})}
              disabled={true}
              placeholder="Cargando correo de aprobación..."
              className="w-full px-3 py-2 border rounded bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Email Aprobador 2 *</label>
            <input
              type="email"
              value={formData.approver2Email}
              onChange={(e) => setFormData({...formData, approver2Email: e.target.value})}
              disabled={true}
              placeholder="Cargando correo de aprobación..."
              className="w-full px-3 py-2 border rounded bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Razón del cambio</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
              className="w-full px-3 py-2 border rounded"
              rows="3"
              placeholder="Explique por qué se requieren estos cambios de precio..."
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || loadingEmails}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Enviando...' : loadingEmails ? 'Cargando correos...' : 'Enviar Solicitud'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading || loadingEmails}
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

export default MultiProductPriceChangeModal;
