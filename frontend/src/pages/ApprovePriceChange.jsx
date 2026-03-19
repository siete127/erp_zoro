import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { notify } from '../services/notify';

const ApprovePriceChange = () => {
  const { requestId } = useParams();
  const [searchParams] = useSearchParams();
  const [request, setRequest] = useState(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadRequest();
  }, [requestId]);

  const loadRequest = async () => {
    try {
      const res = await api.get('/client-pricing/price-change-requests/pending');
      const req = res.data.data.find(r => r.Request_Id === parseInt(requestId));
      setRequest(req);
    } catch (error) {
      console.error('Error al cargar solicitud:', error);
    }
  };

  const handleApprove = async (action) => {
    if (!email) {
      notify('Por favor ingrese su email', 'error');
      return;
    }

    try {
      await api.post(`/client-pricing/price-change-request/${requestId}/approve`, {
        approverEmail: email,
        action
      });
      setStatus(action === 'approve' ? 'approved' : 'rejected');
      notify(action === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada', action === 'approve' ? 'success' : 'info');
    } catch (error) {
      console.error('Error:', error);
      notify(error.response?.data?.message || 'Error al procesar', 'error');
    }
  };

  if (!request) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }

  if (status) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <div className={`text-6xl mb-4 ${status === 'approved' ? 'text-green-500' : 'text-red-500'}`}>
            {status === 'approved' ? '✓' : '✗'}
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {status === 'approved' ? 'Solicitud Aprobada' : 'Solicitud Rechazada'}
          </h2>
          <p className="text-gray-600">
            {status === 'approved' 
              ? 'Su aprobación ha sido registrada. Se requiere la aprobación del segundo aprobador para aplicar el cambio.'
              : 'La solicitud ha sido rechazada.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6 text-center">Aprobación de Cambio de Precio</h1>
        
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <p className="text-sm text-blue-700">
            ⚠️ Esta solicitud requiere la aprobación de 2 personas para ser aplicada.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Cliente</label>
              <p className="text-lg font-semibold">{request.ClientName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Producto</label>
              <p className="text-lg font-semibold">{request.ProductName}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Precio Actual</label>
              <p className="text-lg">${request.CurrentPrice?.toFixed(2) || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Nuevo Precio</label>
              <p className="text-2xl font-bold text-green-600">${request.NewPrice.toFixed(2)}</p>
            </div>
          </div>

          {request.Reason && (
            <div>
              <label className="text-sm font-medium text-gray-600">Razón</label>
              <p className="text-gray-800">{request.Reason}</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-600">Solicitado por</label>
            <p className="text-gray-800">{request.RequestedByName}</p>
          </div>

          <div className="bg-gray-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Estado de Aprobaciones</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Aprobador 1: {request.Approver1_Email}</span>
                <span className={`px-3 py-1 rounded text-sm ${
                  request.Approver1_Status === 'approved' ? 'bg-green-100 text-green-800' :
                  request.Approver1_Status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {request.Approver1_Status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Aprobador 2: {request.Approver2_Email}</span>
                <span className={`px-3 py-1 rounded text-sm ${
                  request.Approver2_Status === 'approved' ? 'bg-green-100 text-green-800' :
                  request.Approver2_Status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {request.Approver2_Status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <label className="block text-sm font-medium mb-2">Su Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ingrese su email para confirmar"
            className="w-full px-4 py-2 border rounded mb-4"
          />

          <div className="flex gap-4">
            <button
              onClick={() => handleApprove('approve')}
              className="flex-1 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-semibold"
            >
              ✓ Aprobar
            </button>
            <button
              onClick={() => handleApprove('reject')}
              className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 font-semibold"
            >
              ✗ Rechazar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovePriceChange;
