import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';
import { FaPlus, FaFileInvoice, FaEye, FaFilePdf, FaCheckCircle, FaTimesCircle, FaClipboardList } from 'react-icons/fa';

const ESTATUS_BADGE = {
  BORRADOR:               'bg-slate-100 text-slate-600',
  PENDIENTE_AUTORIZACION: 'bg-amber-50 text-amber-700 border border-amber-200',
  AUTORIZADA:             'bg-blue-50 text-blue-700 border border-blue-200',
  RECHAZADA:              'bg-red-50 text-red-700 border border-red-200',
  COMPRADA:               'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CANCELADA:              'bg-slate-100 text-slate-400',
};

const ESTATUS_LABELS = {
  BORRADOR:               'Borrador',
  PENDIENTE_AUTORIZACION: 'Pend. Autorizacion',
  AUTORIZADA:             'Autorizada',
  RECHAZADA:              'Rechazada',
  COMPRADA:               'Comprada',
  CANCELADA:              'Cancelada',
};

const premiumFieldClass =
  "w-full rounded-[14px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

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
        api.get('/companies/'),
      ]);
      setOrdenes(ocRes.data?.data || []);
      setCompanies(compRes.data || []);
    } catch (err) {
      notify(err.response?.data?.message || 'Error cargando ordenes', 'error');
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
    const ok = await confirm(`¿Enviar la OC ${oc.NumeroOC} a autorizacion?`, 'Confirmar');
    if (!ok) return;
    try {
      await api.post(`/compras/ordenes/${oc.OC_Id}/enviar-autorizacion`);
      notify('Enviada a autorizacion', 'success');
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
    <div
      className="w-full min-h-screen overflow-auto"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, transparent 60%), radial-gradient(ellipse at 0% 80%, rgba(99,55,197,0.05) 0%, transparent 50%), #f4f7fc' }}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_4px_14px_rgba(27,61,134,0.25)]">
              <FaClipboardList className="text-base" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#6b7a96]">Compras</p>
              <h1 className="text-3xl font-semibold tracking-tight text-[#1d2430]">Ordenes de Compra</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/compras/nueva')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white text-sm font-semibold shadow-[0_4px_14px_rgba(27,61,134,0.3)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.4)] transition-shadow"
            >
              <FaPlus className="text-xs" /> Nueva OC
            </button>
            <button
              onClick={() => navigate('/compras/registro-directo')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] border border-[#dce4f0] bg-white text-slate-700 text-sm font-semibold shadow-[0_2px_8px_rgba(15,45,93,0.06)] hover:bg-slate-50 transition-colors"
            >
              <FaFileInvoice className="text-xs" /> Con Factura
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="rounded-[26px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,253,0.96))] p-4 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              className={`sm:w-56 ${premiumFieldClass}`}
              value={filtros.Company_Id}
              onChange={e => setFiltros(f => ({ ...f, Company_Id: e.target.value }))}
            >
              <option value="all">Todas las empresas</option>
              {companies.map(c => (
                <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>
              ))}
            </select>
            <select
              className={`sm:w-52 ${premiumFieldClass}`}
              value={filtros.Estatus}
              onChange={e => setFiltros(f => ({ ...f, Estatus: e.target.value }))}
            >
              <option value="all">Todos los estatus</option>
              {Object.entries(ESTATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-[22px] bg-slate-200/60" />
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] shadow-[0_18px_40px_rgba(15,45,93,0.08)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    <th className="py-3 pl-5 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96]">No. OC</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96]">Empresa</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96]">Proveedor</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96]">Fecha OC</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96]">F. Requerida</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] text-right">Total</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] text-center">Auth.</th>
                    <th className="py-3 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] text-center">Estatus</th>
                    <th className="py-3 pr-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-sm text-slate-400">
                        No hay ordenes de compra.
                      </td>
                    </tr>
                  ) : filtradas.map(oc => (
                    <tr key={oc.OC_Id} className="border-t border-[#eaf0fa] hover:bg-[#f5f8fe] transition-colors">
                      <td className="py-3.5 pl-5 pr-4 font-bold text-[#1b3d86] text-sm">{oc.NumeroOC}</td>
                      <td className="py-3.5 pr-4 text-slate-700 text-sm">{oc.Empresa}</td>
                      <td className="py-3.5 pr-4 text-slate-700 text-sm">{oc.Proveedor}</td>
                      <td className="py-3.5 pr-4 text-slate-500 text-xs">{fmtDate(oc.FechaOC)}</td>
                      <td className="py-3.5 pr-4 text-slate-500 text-xs">{fmtDate(oc.FechaRequerida)}</td>
                      <td className="py-3.5 pr-4 text-slate-800 font-semibold text-sm text-right">{fmt(oc.Total)}</td>
                      <td className="py-3.5 pr-4 text-center text-xs text-slate-500">
                        {oc.AutorizacionesOtorgadas}/{oc.RequiereDobleAutorizacion ? 2 : 1}
                      </td>
                      <td className="py-3.5 pr-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${ESTATUS_BADGE[oc.Estatus] || 'bg-slate-100 text-slate-500'}`}>
                          {ESTATUS_LABELS[oc.Estatus] || oc.Estatus}
                        </span>
                      </td>
                      <td className="py-3.5 pr-5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => navigate(`/compras/${oc.OC_Id}`)}
                            title="Ver detalle"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            <FaEye className="text-xs" />
                          </button>
                          {['AUTORIZADA', 'COMPRADA'].includes(oc.Estatus) && (
                            <button
                              onClick={() => handleDescargarPDF(oc)}
                              title="Descargar PDF"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                            >
                              <FaFilePdf className="text-xs" />
                            </button>
                          )}
                          {oc.Estatus === 'BORRADOR' && (
                            <button
                              onClick={() => handleEnviarAuth(oc)}
                              title="Enviar a autorizacion"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                            >
                              <FaCheckCircle className="text-xs" />
                            </button>
                          )}
                          {!['COMPRADA', 'CANCELADA'].includes(oc.Estatus) && (
                            <button
                              onClick={() => handleCancelar(oc)}
                              title="Cancelar"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                            >
                              <FaTimesCircle className="text-xs" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
