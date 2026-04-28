import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function FacturasVencidas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reporteria/facturas/vencimientos?dias_alerta=7')
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data || (data.total_vencidas === 0 && data.total_proximas === 0)) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-red-500 text-lg">⚠️</span>
        <h3 className="font-semibold text-red-700 text-sm">Alertas de Facturación</h3>
      </div>
      <div className="flex gap-4 mb-3">
        {data.total_vencidas > 0 && (
          <div className="bg-red-100 rounded-lg px-3 py-2 flex-1 text-center">
            <p className="text-2xl font-bold text-red-700">{data.total_vencidas}</p>
            <p className="text-xs text-red-600">Vencida{data.total_vencidas > 1 ? 's' : ''}</p>
          </div>
        )}
        {data.total_proximas > 0 && (
          <div className="bg-amber-100 rounded-lg px-3 py-2 flex-1 text-center">
            <p className="text-2xl font-bold text-amber-700">{data.total_proximas}</p>
            <p className="text-xs text-amber-600">Por vencer (7 días)</p>
          </div>
        )}
      </div>

      {data.vencidas?.slice(0, 3).map((f) => (
        <div key={f.Factura_Id} className="flex items-center justify-between text-xs text-red-700 border-t border-red-200 pt-1.5 mt-1.5">
          <span className="font-medium">{f.ReceptorNombre}</span>
          <span className="font-bold">${Number(f.Total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {f.Moneda}</span>
          <span className="text-red-500">{Math.abs(f.DiasRestantes)} días vencida</span>
        </div>
      ))}

      {data.proximas_a_vencer?.slice(0, 3).map((f) => (
        <div key={f.Factura_Id} className="flex items-center justify-between text-xs text-amber-700 border-t border-amber-200 pt-1.5 mt-1.5">
          <span className="font-medium">{f.ReceptorNombre}</span>
          <span className="font-bold">${Number(f.Total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {f.Moneda}</span>
          <span className="text-amber-600">vence en {f.DiasRestantes} día{f.DiasRestantes !== 1 ? 's' : ''}</span>
        </div>
      ))}
    </div>
  );
}
