import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaClipboardList } from 'react-icons/fa';
import api from '../../../services/api';

export default function AuditoriaEmpresa() {
  const { empresaId } = useOutletContext();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/superadmin/empresas/${empresaId}/auditoria?limit=100`)
      .then(r => setLogs(r.data.items || []))
      .finally(() => setLoading(false));
  }, [empresaId]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>
          <p className="text-sm text-gray-500">Últimas 100 acciones de esta empresa</p>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-8">Cargando...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FaClipboardList className="text-4xl mx-auto mb-3" />
            <p>Sin registros de auditoría</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Módulo</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap text-xs">
                      {log.fecha ? new Date(log.fecha).toLocaleString('es-MX') : '—'}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-gray-800">{log.Name || log.user_id || '—'}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                        {log.accion || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600">{log.modulo || '—'}</td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs max-w-xs truncate">{log.detalle || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 px-4 py-2">{logs.length} registros</p>
          </div>
        )}
      </div>
    </div>
  );
}
