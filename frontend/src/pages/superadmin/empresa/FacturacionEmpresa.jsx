import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaFileInvoice } from 'react-icons/fa';
import api from '../../../services/api';

export default function FacturacionEmpresa() {
  const { empresaId } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/superadmin/empresas/${empresaId}/stats`)
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, [empresaId]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
          <p className="text-sm text-gray-500">Estado de facturación de esta empresa</p>
        </div>
        {loading ? (
          <div className="text-center text-gray-500 py-8">Cargando...</div>
        ) : stats ? (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <FaFileInvoice className="text-orange-600" />
              </div>
              <p className="font-semibold text-gray-900">Facturas pendientes</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.facturas_pendientes || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Por timbrar o procesar</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
