import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaDollarSign } from 'react-icons/fa';
import api from '../../../services/api';

export default function VentasEmpresa() {
  const { empresaId } = useOutletContext();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use superadmin stats endpoint to get ventas for this empresa
    api.get(`/superadmin/empresas/${empresaId}/stats`)
      .then(r => {
        const stats = r.data;
        setVentas(stats.ventas_mes ? [stats.ventas_mes] : []);
      })
      .finally(() => setLoading(false));
  }, [empresaId]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Ventas del mes</h1>
          <p className="text-sm text-gray-500">Resumen de ventas del mes actual</p>
        </div>
        {loading ? (
          <div className="text-center text-gray-500 py-8">Cargando...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ventas.map((v, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <FaDollarSign className="text-emerald-600" />
                  </div>
                  <p className="font-semibold text-gray-900">Ventas del mes</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  ${parseFloat(v.monto_ventas || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-sm text-gray-500 mt-1">{v.total_ventas || 0} transacciones</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
