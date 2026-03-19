import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';
import { FaPlus, FaFileInvoice, FaEye, FaFilePdf, FaCheckCircle, FaTimesCircle, FaClipboardList } from 'react-icons/fa';

const ESTATUS_COLORS = {
  BORRADOR:                'bg-gray-100 text-gray-700',
  PENDIENTE_AUTORIZACION:  'bg-yellow-100 text-yellow-800',
  AUTORIZADA:              'bg-blue-100 text-blue-800',
  RECHAZADA:               'bg-red-100 text-red-700',
  COMPRADA:                'bg-green-100 text-green-800',
  CANCELADA:               'bg-gray-200 text-gray-500',
};

const ESTATUS_LABELS = {
  BORRADOR:                'Borrador',
  PENDIENTE_AUTORIZACION:  'Pend. Autorización',
  AUTORIZADA:              'Autorizada',
  RECHAZADA:               'Rechazada',
  COMPRADA:                'Comprada',
  CANCELADA:               'Cancelada',
};

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-MX') : '—';

export default function OrdenesCompra() {
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [filtros, setFiltros] = useState({ Company_Id: 'all', Estatus: 'all' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ocRes, compRes] = await Promise.all([
        api.get('/compras/ordenes'),
        api.get('/companies'),
      ]);
      setOrdenes(ocRes.data?.data || []);
      setCompanies(compRes.data || []);
    } catch (err) {
      notify(err.response?.data?.message || 'Error cargando órdenes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtradas = ordenes.filter(o => {
    if (filtros.Company_Id !== 'all' && String(o.Company_Id) !== String(filtros.Company_Id)) return false;
    if (filtros.Estatus !== 'all' && o.Estatus !== filtros.Estatus) return false;
    return true;
  });

  const handleDescargarPDF = async (oc) => {
    try {
      const res = await api.get(`/compras/ordenes/${oc.OC_Id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `OC-${oc.NumeroOC}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      notify('Error generando PDF', 'error');
    }
  };

  const handleEnviarAuth = async (oc) => {
    const ok = await confirm(`¿Enviar la OC ${oc.NumeroOC} a autorización?`, 'Confirmar');
    if (!ok) return;
    try {
      await api.post(`/compras/ordenes/${oc.OC_Id}/enviar-autorizacion`);
      notify('Enviada a autorización', 'success');
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Error', 'error');
    }
  };

  const handleCancelar = async (oc) => {
    const ok = await confirm(`¿Cancelar la OC ${oc.NumeroOC}?`, 'Cancelar orden');
    if (!ok) return;
    try {
      await api.post(`/compras/ordenes/${oc.OC_Id}/cancelar`);
      notify('Orden cancelada', 'success');
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Error', 'error');
    }
  };

  return (
    <div className="p-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FaClipboardList className="text-blue-600" /> Órdenes de Compra
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/compras/nueva')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <FaPlus /> Nueva OC
          </button>
          <button
            onClick={() => navigate('/compras/registro-directo')}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <FaFileInvoice /> Registro con Factura
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filtros.Company_Id}
          onChange={e => setFiltros(f => ({ ...f, Company_Id: e.target.value }))}
        >
          <option value="all">Todas las empresas</option>
          {companies.map(c => (
            <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>
          ))}
        </select>

        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filtros.Estatus}
          onChange={e => setFiltros(f => ({ ...f, Estatus: e.target.value }))}
        >
          <option value="all">Todos los estatus</option>
          {Object.entries(ESTATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <p className="text-gray-500 text-center py-8">Cargando...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-100">
          <table className="min-w-full text-sm bg-white">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-3 py-3 text-left">No. OC</th>
                <th className="px-3 py-3 text-left">Empresa</th>
                <th className="px-3 py-3 text-left">Proveedor</th>
                <th className="px-3 py-3 text-left">Fecha OC</th>
                <th className="px-3 py-3 text-left">F. Requerida</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-center">Auth.</th>
                <th className="px-3 py-3 text-center">Estatus</th>
                <th className="px-3 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400">
                    No hay órdenes de compra
                  </td>
                </tr>
              ) : filtradas.map(oc => (
                <tr key={oc.OC_Id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-3 py-3 font-semibold text-blue-700">{oc.NumeroOC}</td>
                  <td className="px-3 py-3">{oc.Empresa}</td>
                  <td className="px-3 py-3">{oc.Proveedor}</td>
                  <td className="px-3 py-3">{fmtDate(oc.FechaOC)}</td>
                  <td className="px-3 py-3">{fmtDate(oc.FechaRequerida)}</td>
                  <td className="px-3 py-3 text-right font-medium">{fmt(oc.Total)}</td>
                  <td className="px-3 py-3 text-center text-xs text-gray-500">
                    {oc.AutorizacionesOtorgadas}/{oc.RequiereDobleAutorizacion ? 2 : 1}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ESTATUS_COLORS[oc.Estatus] || 'bg-gray-100'}`}>
                      {ESTATUS_LABELS[oc.Estatus] || oc.Estatus}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => navigate(`/compras/${oc.OC_Id}`)}
                        title="Ver detalle"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <FaEye />
                      </button>
                      {['AUTORIZADA', 'COMPRADA'].includes(oc.Estatus) && (
                        <button
                          onClick={() => handleDescargarPDF(oc)}
                          title="Descargar PDF"
                          className="text-red-500 hover:text-red-700"
                        >
                          <FaFilePdf />
                        </button>
                      )}
                      {oc.Estatus === 'BORRADOR' && (
                        <button
                          onClick={() => handleEnviarAuth(oc)}
                          title="Enviar a autorización"
                          className="text-yellow-600 hover:text-yellow-800"
                        >
                          <FaCheckCircle />
                        </button>
                      )}
                      {!['COMPRADA', 'CANCELADA'].includes(oc.Estatus) && (
                        <button
                          onClick={() => handleCancelar(oc)}
                          title="Cancelar"
                          className="text-gray-400 hover:text-red-600"
                        >
                          <FaTimesCircle />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
