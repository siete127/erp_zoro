import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reporteriaService } from '../services/reporteriaService';
import { notify } from '../services/notify';

function Reporteria() {
  const navigate = useNavigate();
  const [facturas, setFacturas] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    fechaInicio: '',
    fechaFin: '',
    cliente: '',
    status: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [facturasRes, statsRes] = await Promise.all([
        reporteriaService.getFacturas(filtros),
        reporteriaService.getEstadisticas(filtros)
      ]);
      setFacturas(facturasRes.data || []);
      setEstadisticas(statsRes.data || null);
    } catch (error) {
      notify('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrar = () => {
    cargarDatos();
  };

  const handleDescargarPDF = async (facturaId, facturamaId) => {
    if (!facturamaId || facturamaId.startsWith('TEMP-')) {
      notify('Esta factura no tiene un ID válido. Puede ser una factura de prueba.', 'warning');
      return;
    }
    try {
      await reporteriaService.descargarPDF(facturaId);
      notify('PDF descargado correctamente', 'success');
    } catch (error) {
      notify(error.response?.data?.message || 'Error al descargar PDF', 'error');
    }
  };

  const handleDescargarXML = async (facturaId, facturamaId) => {
    if (!facturamaId || facturamaId.startsWith('TEMP-')) {
      notify('Esta factura no tiene un ID válido. Puede ser una factura de prueba.', 'warning');
      return;
    }
    try {
      await reporteriaService.descargarXML(facturaId);
      notify('XML descargado correctamente', 'success');
    } catch (error) {
      notify(error.response?.data?.message || 'Error al descargar XML', 'error');
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Reportería de Facturas</h2>
            <p className="text-sm text-gray-600">Consulta y descarga facturas emitidas</p>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-semibold">Total Facturas</p>
            <p className="text-2xl font-bold text-blue-900">{estadisticas.TotalFacturas || 0}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 font-semibold">Vigentes</p>
            <p className="text-2xl font-bold text-green-900">{estadisticas.FacturasVigentes || 0}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600 font-semibold">Canceladas</p>
            <p className="text-2xl font-bold text-red-900">{estadisticas.FacturasCanceladas || 0}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-600 font-semibold">Total Facturado</p>
            <p className="text-2xl font-bold text-purple-900">
              ${(estadisticas.TotalFacturado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={filtros.fechaInicio}
              onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={filtros.fechaFin}
              onChange={(e) => setFiltros({ ...filtros, fechaFin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Cliente</label>
            <input
              type="text"
              placeholder="Nombre o RFC"
              value={filtros.cliente}
              onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <select
              value={filtros.status}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="">Todos</option>
              <option value="Vigente">Vigente</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleFiltrar}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Facturas */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-4 text-gray-600">Cargando facturas...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-sm text-gray-600">
                  <th className="py-3 px-4">Folio</th>
                  <th className="py-3 px-4">UUID</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">RFC</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 px-4 text-sm text-gray-600 text-center">
                      No hay facturas para mostrar
                    </td>
                  </tr>
                ) : (
                  facturas.map((factura) => {
                    const isTemp = !factura.FacturamaId || factura.FacturamaId.startsWith('TEMP-');
                    return (
                    <tr key={factura.Factura_Id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {factura.Serie || ''}{factura.Folio || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600 font-mono">
                        {factura.UUID ? factura.UUID.substring(0, 8) + '...' : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {factura.ReceptorNombre}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {factura.ReceptorRFC}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">
                        ${(factura.Total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {factura.FechaTimbrado ? new Date(factura.FechaTimbrado).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          factura.Status === 'Vigente' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {factura.Status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isTemp ? (
                          <div className="text-center">
                            <span className="text-xs text-gray-400">Factura de prueba</span>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleDescargarPDF(factura.Factura_Id, factura.FacturamaId)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                              title="Descargar PDF"
                            >
                              📄 PDF
                            </button>
                            <button
                              onClick={() => handleDescargarXML(factura.Factura_Id, factura.FacturamaId)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium"
                              title="Descargar XML"
                            >
                              📋 XML
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Reporteria;
