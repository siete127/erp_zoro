import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaIdCard } from 'react-icons/fa';
import api from '../../../services/api';

export default function LicenciasEmpresa() {
  const { empresaId } = useOutletContext();
  const [licencias, setLicencias] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/licencias?company_id=${empresaId}`)
      .then(r => setLicencias(r.data.items || r.data || []))
      .catch(() => setLicencias([]))
      .finally(() => setLoading(false));
  }, [empresaId]);

  const getDiasRestantes = (fecha) => {
    if (!fecha) return null;
    const diff = new Date(fecha) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Licencias</h1>
          <p className="text-sm text-gray-500">Estado de licencias de esta empresa</p>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-8">Cargando...</div>
        ) : licencias.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FaIdCard className="text-4xl mx-auto mb-3" />
            <p>Sin licencias registradas</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Vencimiento</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Días restantes</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody>
                {licencias.map((lic, idx) => {
                  const dias = getDiasRestantes(lic.FechaVencimiento);
                  return (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{lic.TipoLicencia || lic.tipo || '—'}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {lic.FechaVencimiento ? new Date(lic.FechaVencimiento).toLocaleDateString('es-MX') : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {dias !== null ? (
                          <span className={`font-semibold ${dias < 7 ? 'text-red-600' : dias < 30 ? 'text-orange-500' : 'text-green-600'}`}>
                            {dias} días
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          lic.Estado === 'activa' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {lic.Estado || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
