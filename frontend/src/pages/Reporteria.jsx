import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reporteriaService } from '../services/reporteriaService';
import { notify } from '../services/notify';

function exportFacturasCsv(facturas) {
  if (!facturas.length) return;
  const rows = facturas.map(f => ({
    Folio: `${f.Serie || ''}${f.Folio || ''}`,
    UUID: f.UUID || '',
    Cliente: f.ReceptorNombre || '',
    RFC: f.ReceptorRFC || '',
    Total: Number(f.Total || 0).toFixed(2),
    Fecha: f.FechaTimbrado ? new Date(f.FechaTimbrado).toLocaleDateString('es-MX') : '',
    Status: f.Status || '',
  }));
  const csv = [
    Object.keys(rows[0]).join(','),
    ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'facturas.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

const STAT_CARDS = [
  { key: 'TotalFacturas', label: 'Total Facturas', color: 'border-blue-200 bg-blue-50', textColor: 'text-blue-700', valColor: 'text-blue-900' },
  { key: 'FacturasVigentes', label: 'Vigentes', color: 'border-emerald-200 bg-emerald-50', textColor: 'text-emerald-700', valColor: 'text-emerald-900' },
  { key: 'FacturasCanceladas', label: 'Canceladas', color: 'border-rose-200 bg-rose-50', textColor: 'text-rose-700', valColor: 'text-rose-900' },
  { key: 'TotalFacturado', label: 'Total Facturado', color: 'border-violet-200 bg-violet-50', textColor: 'text-violet-700', valColor: 'text-violet-900', money: true },
];

function Reporteria() {
  const navigate = useNavigate();
  const [facturas, setFacturas] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({ fechaInicio: '', fechaFin: '', cliente: '', status: '' });

  useEffect(() => { cargarDatos(); }, []);

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
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Facturación</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Reportería de Facturas</h1>
            <p className="text-sm text-slate-500">Consulta y descarga facturas emitidas</p>
          </div>
          <div className="flex gap-2">
            {facturas.length > 0 && (
              <button
                onClick={() => exportFacturasCsv(facturas)}
                className="rounded-[12px] border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
              >
                Exportar CSV
              </button>
            )}
            <button
              onClick={() => navigate('/complementos-pago')}
              className="rounded-[12px] border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition"
            >
              Complementos de Pago
            </button>
          </div>
        </div>

        {/* Stats */}
        {estadisticas && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STAT_CARDS.map(s => (
              <div key={s.key} className={`rounded-[20px] border p-4 ${s.color}`}>
                <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${s.textColor}`}>{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.valColor}`}>
                  {s.money
                    ? `$${(estadisticas[s.key] || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                    : (estadisticas[s.key] || 0)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="rounded-[26px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] px-5 py-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96] mb-1">Fecha Inicio</label>
              <input
                type="date"
                value={filtros.fechaInicio}
                onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.target.value })}
                className={premiumField}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96] mb-1">Fecha Fin</label>
              <input
                type="date"
                value={filtros.fechaFin}
                onChange={(e) => setFiltros({ ...filtros, fechaFin: e.target.value })}
                className={premiumField}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96] mb-1">Cliente</label>
              <input
                type="text"
                placeholder="Nombre o RFC"
                value={filtros.cliente}
                onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })}
                className={premiumField}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96] mb-1">Status</label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
                className={premiumField}
              >
                <option value="">Todos</option>
                <option value="Vigente">Vigente</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={cargarDatos}
                className="w-full rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] transition"
              >
                Filtrar
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["Folio", "UUID", "Cliente", "RFC", "Total", "Fecha", "Status", "Acciones"].map((col, i) => (
                      <th key={col} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i === 4 ? 'text-right' : i === 7 ? 'text-center' : ''}`}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {facturas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">No hay facturas para mostrar</td>
                    </tr>
                  ) : facturas.map((factura) => {
                    const isTemp = !factura.FacturamaId || factura.FacturamaId.startsWith('TEMP-');
                    return (
                      <tr key={factura.Factura_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                        <td className="py-3 pl-6 pr-4 font-mono text-sm font-semibold text-[#1b3d86]">{factura.Serie || ''}{factura.Folio || '—'}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-400">{factura.UUID ? factura.UUID.substring(0, 8) + '…' : '—'}</td>
                        <td className="py-3 pr-4 text-sm text-slate-800">{factura.ReceptorNombre}</td>
                        <td className="py-3 pr-4 text-sm text-slate-500">{factura.ReceptorRFC}</td>
                        <td className="py-3 pr-4 text-sm font-semibold text-right text-slate-800">
                          ${(factura.Total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 pr-4 text-sm text-slate-600">
                          {factura.FechaTimbrado ? new Date(factura.FechaTimbrado).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                            factura.Status === 'Vigente'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-rose-200 bg-rose-50 text-rose-700'
                          }`}>
                            {factura.Status}
                          </span>
                        </td>
                        <td className="py-3 pr-6">
                          {isTemp ? (
                            <p className="text-center text-xs text-slate-400">Factura de prueba</p>
                          ) : (
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleDescargarPDF(factura.Factura_Id, factura.FacturamaId)}
                                className="rounded-[9px] border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                              >
                                PDF
                              </button>
                              <button
                                onClick={() => handleDescargarXML(factura.Factura_Id, factura.FacturamaId)}
                                className="rounded-[9px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                              >
                                XML
                              </button>
                            </div>
                          )}
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
    </div>
  );
}

export default Reporteria;
