import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';

const fmt = (v) => Number(v || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
const TABS = ['Nóminas', 'Empleados', 'Conceptos'];
const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";
const smallField = "w-full rounded-[10px] border border-[#dce4f0] bg-white px-3 py-2 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.04)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

function exportNominaCsv(nominaDetalle) {
  if (!nominaDetalle?.lineas?.length) return;
  const n = nominaDetalle.nomina;
  const rows = nominaDetalle.lineas.map(l => ({
    Empleado: l.EmpleadoNombre, RFC: l.RFC,
    Percepciones: Number(l.Percepciones).toFixed(2),
    Deducciones: Number(l.Deducciones).toFixed(2),
    Neto: Number(l.Neto).toFixed(2),
  }));
  const header = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
  const totals = `"TOTALES","",${fmt(n.TotalPercepciones)},${fmt(n.TotalDeducciones)},${fmt(n.TotalNeto)}`;
  const csv = [header, body, totals].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `nomina_${n.Tipo}_${n.PeriodoInicio?.slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function imprimirRecibo(linea, nomina) {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Recibo de Nómina</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0;padding:20px}.header{border-bottom:2px solid #092052;padding-bottom:10px;margin-bottom:16px}.header h1{margin:0;font-size:16px;color:#092052}.header p{margin:2px 0;color:#555;font-size:11px}.section{margin-bottom:14px}.section h2{font-size:11px;font-weight:bold;background:#f3f4f6;padding:4px 8px;margin:0 0 6px;border-left:3px solid #092052;text-transform:uppercase}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;padding:0 8px}.field{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #e5e7eb}.field span:first-child{color:#6b7280}.totals{border:1px solid #e5e7eb;border-radius:6px;padding:10px 16px;margin-top:12px}.total-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}.total-row.main{font-size:14px;font-weight:bold;border-top:2px solid #092052;margin-top:6px;padding-top:6px;color:#092052}.footer{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:20px}.firma{text-align:center;border-top:1px solid #111;padding-top:4px;font-size:10px;color:#555}@media print{body{padding:0}}</style></head><body>
    <div class="header"><h1>Recibo de Nómina</h1><p>Período: ${nomina.PeriodoInicio?.slice(0,10)} — ${nomina.PeriodoFin?.slice(0,10)}</p><p>Tipo: ${nomina.Tipo} | Empresa: ${nomina.NameCompany || ''}</p></div>
    <div class="section"><h2>Datos del Empleado</h2><div class="grid2">
      <div class="field"><span>Nombre</span><span>${linea.EmpleadoNombre || ''}</span></div>
      <div class="field"><span>RFC</span><span>${linea.RFC || ''}</span></div>
      <div class="field"><span>NSS</span><span>${linea.NSS || '—'}</span></div>
      <div class="field"><span>Puesto</span><span>${linea.Puesto || '—'}</span></div>
    </div></div>
    <div class="totals">
      <div class="total-row"><span>Percepciones</span><span style="color:#166534">${fmt(linea.Percepciones)}</span></div>
      <div class="total-row"><span>Deducciones</span><span style="color:#991b1b">${fmt(linea.Deducciones)}</span></div>
      <div class="total-row main"><span>NETO A PAGAR</span><span>${fmt(linea.Neto)}</span></div>
    </div>
    <div class="footer"><div class="firma">Firma del empleado</div><div class="firma">Firma del patrón / sello</div></div>
    </body></html>`;
  const w = window.open('', '_blank', 'width=700,height=900');
  w.document.write(html); w.document.close(); w.focus(); w.print();
}

export default function Nomina() {
  const [tab, setTab] = useState('Nóminas');
  const [nominas, setNominas] = useState([]);
  const [loadingNominas, setLoadingNominas] = useState(false);
  const [nominaDetalle, setNominaDetalle] = useState(null);
  const [showNominaForm, setShowNominaForm] = useState(false);
  const [nominaForm, setNominaForm] = useState({ Company_Id: '', PeriodoInicio: '', PeriodoFin: '', Tipo: 'QUINCENAL', DiasLaborados: 15 });
  const [savingNomina, setSavingNomina] = useState(false);

  const [empleados, setEmpleados] = useState([]);
  const [loadingEmp, setLoadingEmp] = useState(false);
  const [empForm, setEmpForm] = useState({ Company_Id: '', Nombre: '', RFC: '', NSS: '', CURP: '', FechaIngreso: '', Puesto: '', Departamento: '', TipoContrato: '', TipoJornada: '', SalarioBase: '', Banco: '', CuentaBancaria: '', Clabe: '' });
  const [editingEmp, setEditingEmp] = useState(null);
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [savingEmp, setSavingEmp] = useState(false);

  const [conceptos, setConceptos] = useState([]);
  const [conceptoForm, setConceptoForm] = useState({ Tipo: 'PERCEPCION', Clave: '', Descripcion: '', EsGravado: true, EsExento: false });
  const [showConceptoForm, setShowConceptoForm] = useState(false);

  const [companies, setCompanies] = useState([]);

  useEffect(() => { api.get('/companies/').then(r => setCompanies(r.data || [])).catch(() => {}); }, []);

  useEffect(() => {
    if (tab === 'Nóminas') loadNominas();
    if (tab === 'Empleados') loadEmpleados();
    if (tab === 'Conceptos') loadConceptos();
  }, [tab]);

  const loadNominas = async () => {
    setLoadingNominas(true);
    try { const r = await api.get('/nomina/nominas'); setNominas(r.data?.data || []); }
    catch { notify('Error cargando nóminas', 'error'); }
    finally { setLoadingNominas(false); }
  };
  const loadEmpleados = async () => {
    setLoadingEmp(true);
    try { const r = await api.get('/nomina/empleados'); setEmpleados(r.data?.data || []); }
    catch { notify('Error cargando empleados', 'error'); }
    finally { setLoadingEmp(false); }
  };
  const loadConceptos = async () => {
    try { const r = await api.get('/nomina/conceptos'); setConceptos(r.data?.data || []); }
    catch {}
  };

  const handleCrearNomina = async (e) => {
    e.preventDefault();
    setSavingNomina(true);
    try {
      await api.post('/nomina/nominas', { ...nominaForm, Company_Id: Number(nominaForm.Company_Id), DiasLaborados: Number(nominaForm.DiasLaborados) });
      notify('Nómina creada con líneas por empleados activos', 'success');
      setShowNominaForm(false);
      setNominaForm({ Company_Id: '', PeriodoInicio: '', PeriodoFin: '', Tipo: 'QUINCENAL', DiasLaborados: 15 });
      await loadNominas();
    } catch (err) { notify(err?.response?.data?.detail || 'Error al crear nómina', 'error'); }
    finally { setSavingNomina(false); }
  };

  const handleCerrarNomina = async (n) => {
    const ok = await confirm(`¿Cerrar la nómina ${n.Tipo}?`, 'Cerrar nómina', 'Cerrar', 'Cancelar');
    if (!ok) return;
    try {
      await api.post(`/nomina/nominas/${n.Nomina_Id}/cerrar`);
      notify('Nómina cerrada', 'success');
      if (nominaDetalle?.nomina?.Nomina_Id === n.Nomina_Id)
        setNominaDetalle(prev => ({ ...prev, nomina: { ...prev.nomina, Estatus: 'CERRADA' } }));
      await loadNominas();
    } catch (err) { notify(err?.response?.data?.detail || 'Error', 'error'); }
  };

  const handleVerDetalle = async (n) => {
    try { const r = await api.get(`/nomina/nominas/${n.Nomina_Id}`); setNominaDetalle(r.data?.data || null); }
    catch { notify('Error cargando detalle', 'error'); }
  };

  const handleUpdateLinea = async (linea, percepciones, deducciones) => {
    try {
      await api.put(`/nomina/lineas/${linea.NominaLinea_Id}`, { Percepciones: Number(percepciones), Deducciones: Number(deducciones) });
      notify('Línea actualizada', 'success');
      await handleVerDetalle({ Nomina_Id: nominaDetalle.nomina.Nomina_Id });
    } catch (err) { notify(err?.response?.data?.detail || 'Error', 'error'); }
  };

  const handleEmpSubmit = async (e) => {
    e.preventDefault();
    setSavingEmp(true);
    try {
      const body = { ...empForm, Company_Id: Number(empForm.Company_Id), SalarioBase: Number(empForm.SalarioBase) };
      if (editingEmp) { await api.put(`/nomina/empleados/${editingEmp.Empleado_Id}`, body); notify('Empleado actualizado', 'success'); }
      else { await api.post('/nomina/empleados', body); notify('Empleado creado', 'success'); }
      setShowEmpForm(false); setEditingEmp(null); await loadEmpleados();
    } catch (err) { notify(err?.response?.data?.detail || 'Error', 'error'); }
    finally { setSavingEmp(false); }
  };

  const handleEditEmp = (e) => {
    setEditingEmp(e);
    setEmpForm({ Company_Id: e.Company_Id || '', Nombre: e.Nombre || '', RFC: e.RFC || '', NSS: e.NSS || '', CURP: e.CURP || '', FechaIngreso: e.FechaIngreso?.slice(0,10) || '', Puesto: e.Puesto || '', Departamento: e.Departamento || '', TipoContrato: e.TipoContrato || '', TipoJornada: e.TipoJornada || '', SalarioBase: e.SalarioBase || '', Banco: e.Banco || '', CuentaBancaria: e.CuentaBancaria || '', Clabe: e.Clabe || '' });
    setShowEmpForm(true);
  };

  const handleDeleteEmp = async (e) => {
    const ok = await confirm(`¿Desactivar a ${e.Nombre}?`, 'Desactivar empleado', 'Desactivar', 'Cancelar');
    if (!ok) return;
    try { await api.delete(`/nomina/empleados/${e.Empleado_Id}`); notify('Empleado desactivado', 'success'); await loadEmpleados(); }
    catch { notify('Error', 'error'); }
  };

  const handleConceptoSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/nomina/conceptos', conceptoForm);
      notify('Concepto creado', 'success');
      setShowConceptoForm(false);
      setConceptoForm({ Tipo: 'PERCEPCION', Clave: '', Descripcion: '', EsGravado: true, EsExento: false });
      await loadConceptos();
    } catch (err) { notify(err?.response?.data?.detail || 'Error', 'error'); }
  };

  const EMP_FIELDS = [
    ['Empresa', 'Company_Id', 'select'], ['Nombre completo', 'Nombre', 'text'], ['RFC', 'RFC', 'text'],
    ['NSS', 'NSS', 'text'], ['CURP', 'CURP', 'text'], ['Fecha ingreso', 'FechaIngreso', 'date'],
    ['Puesto', 'Puesto', 'text'], ['Departamento', 'Departamento', 'text'],
    ['Tipo contrato', 'TipoContrato', 'text'], ['Tipo jornada', 'TipoJornada', 'text'],
    ['Salario base mensual', 'SalarioBase', 'number'], ['Banco', 'Banco', 'text'],
    ['Cuenta bancaria', 'CuentaBancaria', 'text'], ['CLABE', 'Clabe', 'text'],
  ];

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">RH</p>
          <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Nómina</h1>
          <p className="text-sm text-slate-500">Gestión de empleados, nóminas y conceptos de pago.</p>
        </div>

        {/* Pill tabs */}
        <div className="flex gap-1 rounded-[16px] border border-[#dce4f0] bg-white/80 p-1 shadow-[0_2px_8px_rgba(15,45,93,0.05)] w-fit">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-[12px] px-4 py-2 text-sm font-semibold transition ${tab === t ? 'bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.25)]' : 'text-slate-600 hover:bg-white/80'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ===== TAB: Nóminas ===== */}
        {tab === 'Nóminas' && (
          <div className={`flex gap-6 ${nominaDetalle ? 'flex-col lg:flex-row' : ''}`}>
            <div className={nominaDetalle ? 'lg:w-1/2' : 'w-full'}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-slate-800">Lista de nóminas</h3>
                <button onClick={() => setShowNominaForm(v => !v)} className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] transition">
                  + Nueva nómina
                </button>
              </div>

              {showNominaForm && (
                <div className="mb-4 rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
                  <form onSubmit={handleCrearNomina} className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresa</label>
                      <select className={smallField} value={nominaForm.Company_Id} onChange={e => setNominaForm(f => ({ ...f, Company_Id: e.target.value }))} required>
                        <option value="">Seleccionar</option>
                        {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Tipo</label>
                      <select className={smallField} value={nominaForm.Tipo} onChange={e => setNominaForm(f => ({ ...f, Tipo: e.target.value }))}>
                        {['QUINCENAL', 'SEMANAL', 'MENSUAL'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Período inicio</label>
                      <input type="date" className={smallField} value={nominaForm.PeriodoInicio} onChange={e => setNominaForm(f => ({ ...f, PeriodoInicio: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Período fin</label>
                      <input type="date" className={smallField} value={nominaForm.PeriodoFin} onChange={e => setNominaForm(f => ({ ...f, PeriodoFin: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Días laborados</label>
                      <input type="number" min={1} max={31} className={smallField} value={nominaForm.DiasLaborados} onChange={e => setNominaForm(f => ({ ...f, DiasLaborados: e.target.value }))} />
                    </div>
                    <div className="flex items-end gap-2">
                      <button type="button" onClick={() => setShowNominaForm(false)} className="flex-1 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
                      <button type="submit" disabled={savingNomina} className="flex-1 rounded-[10px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 transition">{savingNomina ? 'Creando...' : 'Crear'}</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
                {loadingNominas ? (
                  <div className="flex items-center justify-center py-12"><div className="h-7 w-7 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" /></div>
                ) : nominas.length === 0 ? (
                  <p className="px-6 py-10 text-center text-sm text-slate-400">No hay nóminas registradas.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[#eaf0fa]">
                          {["Período","Tipo","Empresa","Percepciones","Deducciones","Neto","Estatus",""].map((col, i) => (
                            <th key={i} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] first:pl-6 last:pr-6 ${i >= 3 && i <= 5 ? 'text-right' : ''}`}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {nominas.map(n => (
                          <tr key={n.Nomina_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                            <td className="px-4 py-3 pl-6 text-xs text-slate-700">{n.PeriodoInicio?.slice(0,10)} — {n.PeriodoFin?.slice(0,10)}</td>
                            <td className="px-4 py-3 text-xs text-slate-700">{n.Tipo}</td>
                            <td className="px-4 py-3 text-xs text-slate-700">{n.NameCompany}</td>
                            <td className="px-4 py-3 text-right text-xs text-slate-700">{fmt(n.TotalPercepciones)}</td>
                            <td className="px-4 py-3 text-right text-xs text-rose-600">{fmt(n.TotalDeducciones)}</td>
                            <td className="px-4 py-3 text-right text-xs font-semibold text-slate-900">{fmt(n.TotalNeto)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${n.Estatus === 'CERRADA' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{n.Estatus}</span>
                            </td>
                            <td className="px-4 py-3 pr-6">
                              <div className="flex gap-2">
                                <button onClick={() => handleVerDetalle(n)} className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2.5 py-1 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition">Ver</button>
                                {n.Estatus !== 'CERRADA' && <button onClick={() => handleCerrarNomina(n)} className="rounded-[9px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">Cerrar</button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Detalle nómina */}
            {nominaDetalle && (
              <div className="lg:w-1/2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-800">Detalle — {nominaDetalle.nomina?.Tipo} {nominaDetalle.nomina?.PeriodoInicio?.slice(0,10)}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => exportNominaCsv(nominaDetalle)} className="rounded-[9px] border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition">Exportar CSV</button>
                    <button onClick={() => setNominaDetalle(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Percepciones</p>
                    <p className="font-bold text-emerald-900 text-sm">{fmt(nominaDetalle.nomina?.TotalPercepciones)}</p>
                  </div>
                  <div className="rounded-[16px] border border-rose-200 bg-rose-50 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Deducciones</p>
                    <p className="font-bold text-rose-900 text-sm">{fmt(nominaDetalle.nomina?.TotalDeducciones)}</p>
                  </div>
                  <div className="rounded-[16px] border border-blue-200 bg-blue-50 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Neto</p>
                    <p className="font-bold text-blue-900 text-sm">{fmt(nominaDetalle.nomina?.TotalNeto)}</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_4px_20px_rgba(15,45,93,0.07)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[#eaf0fa]">
                          {["Empleado","RFC","Percepciones","Deducciones","Neto",""].map((col, i) => (
                            <th key={i} className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] first:pl-5 last:pr-5 ${i >= 2 && i <= 4 ? 'text-right' : ''}`}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(nominaDetalle.lineas || []).map(l => (
                          <LineaRow key={l.NominaLinea_Id} linea={l} nomina={nominaDetalle.nomina} cerrada={nominaDetalle.nomina?.Estatus === 'CERRADA'} onSave={handleUpdateLinea} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: Empleados ===== */}
        {tab === 'Empleados' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-800">Empleados de nómina</h3>
              <button
                onClick={() => { setEditingEmp(null); setEmpForm({ Company_Id: '', Nombre: '', RFC: '', NSS: '', CURP: '', FechaIngreso: '', Puesto: '', Departamento: '', TipoContrato: '', TipoJornada: '', SalarioBase: '', Banco: '', CuentaBancaria: '', Clabe: '' }); setShowEmpForm(v => !v); }}
                className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] transition"
              >
                + Nuevo empleado
              </button>
            </div>

            {showEmpForm && (
              <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
                <form onSubmit={handleEmpSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {EMP_FIELDS.map(([label, key, type]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">{label}</label>
                      {type === 'select' ? (
                        <select className={smallField} value={empForm[key]} onChange={e => setEmpForm(f => ({ ...f, [key]: e.target.value }))} required>
                          <option value="">Seleccionar</option>
                          {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                        </select>
                      ) : (
                        <input type={type} className={smallField} value={empForm[key]} onChange={e => setEmpForm(f => ({ ...f, [key]: e.target.value }))} />
                      )}
                    </div>
                  ))}
                  <div className="sm:col-span-3 flex justify-end gap-2">
                    <button type="button" onClick={() => setShowEmpForm(false)} className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
                    <button type="submit" disabled={savingEmp} className="rounded-[10px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition">{savingEmp ? 'Guardando...' : editingEmp ? 'Actualizar' : 'Crear'}</button>
                  </div>
                </form>
              </div>
            )}

            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
              {loadingEmp ? (
                <div className="flex items-center justify-center py-12"><div className="h-7 w-7 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" /></div>
              ) : empleados.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-400">No hay empleados de nómina registrados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#eaf0fa]">
                        {["Nombre","RFC","Puesto","Departamento","Salario base","Empresa","Activo",""].map((col, i) => (
                          <th key={i} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] first:pl-6 last:pr-6 ${i === 4 ? 'text-right' : ''}`}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {empleados.map(e => (
                        <tr key={e.Empleado_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                          <td className="px-4 py-3 pl-6 text-sm font-medium text-slate-800">{e.Nombre}</td>
                          <td className="px-4 py-3 font-mono text-sm text-slate-700">{e.RFC}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{e.Puesto || '—'}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{e.Departamento || '—'}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{fmt(e.SalarioBase)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{e.NameCompany}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${e.Activo ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{e.Activo ? 'Activo' : 'Inactivo'}</span>
                          </td>
                          <td className="px-4 py-3 pr-6">
                            <div className="flex gap-2">
                              <button onClick={() => handleEditEmp(e)} className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2.5 py-1 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition">Editar</button>
                              {e.Activo && <button onClick={() => handleDeleteEmp(e)} className="rounded-[9px] border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">Desactivar</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== TAB: Conceptos ===== */}
        {tab === 'Conceptos' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-800">Conceptos de percepción / deducción</h3>
              <button onClick={() => setShowConceptoForm(v => !v)} className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] transition">+ Nuevo concepto</button>
            </div>

            {showConceptoForm && (
              <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
                <form onSubmit={handleConceptoSubmit} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Tipo</label>
                    <select className={smallField} value={conceptoForm.Tipo} onChange={e => setConceptoForm(f => ({ ...f, Tipo: e.target.value }))}>
                      <option>PERCEPCION</option><option>DEDUCCION</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Clave</label>
                    <input className={smallField} value={conceptoForm.Clave} onChange={e => setConceptoForm(f => ({ ...f, Clave: e.target.value }))} required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Descripción</label>
                    <input className={smallField} value={conceptoForm.Descripcion} onChange={e => setConceptoForm(f => ({ ...f, Descripcion: e.target.value }))} required />
                  </div>
                  <div className="sm:col-span-4 flex flex-wrap gap-4 items-center">
                    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={conceptoForm.EsGravado} onChange={e => setConceptoForm(f => ({ ...f, EsGravado: e.target.checked }))} /> Gravado</label>
                    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={conceptoForm.EsExento} onChange={e => setConceptoForm(f => ({ ...f, EsExento: e.target.checked }))} /> Exento</label>
                    <div className="flex-1 flex justify-end gap-2">
                      <button type="button" onClick={() => setShowConceptoForm(false)} className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
                      <button type="submit" className="rounded-[10px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white transition">Crear</button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
              {conceptos.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-400">Sin conceptos registrados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#eaf0fa]">
                        {["Tipo","Clave","Descripción","Gravado","Exento"].map(col => (
                          <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {conceptos.map(c => (
                        <tr key={c.Concepto_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                          <td className="px-4 py-3 pl-6">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${c.Tipo === 'PERCEPCION' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{c.Tipo}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-slate-800">{c.Clave}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{c.Descripcion}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{c.EsGravado ? '✓' : '—'}</td>
                          <td className="px-4 py-3 pr-6 text-sm text-slate-700">{c.EsExento ? '✓' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function LineaRow({ linea, nomina, cerrada, onSave }) {
  const [editing, setEditing] = useState(false);
  const [perc, setPerc] = useState(linea.Percepciones);
  const [ded, setDed] = useState(linea.Deducciones);
  const smallField = "w-full rounded-[8px] border border-[#dce4f0] bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-[#3b6fd4]";

  if (editing) {
    return (
      <tr className="border-t border-[#eaf0fa] bg-[#f0f4ff]/60">
        <td className="px-3 py-2 pl-5 text-sm font-medium text-slate-800" colSpan={2}>{linea.EmpleadoNombre}</td>
        <td className="px-3 py-2"><input type="number" className={smallField} value={perc} onChange={e => setPerc(e.target.value)} /></td>
        <td className="px-3 py-2"><input type="number" className={smallField} value={ded} onChange={e => setDed(e.target.value)} /></td>
        <td className="px-3 py-2 text-right text-xs font-semibold text-slate-900">{(Number(perc) - Number(ded)).toFixed(2)}</td>
        <td className="px-3 py-2 pr-5">
          <div className="flex gap-1">
            <button onClick={() => { onSave(linea, perc, ded); setEditing(false); }} className="rounded-[7px] border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">Guardar</button>
            <button onClick={() => setEditing(false)} className="rounded-[7px] border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
      <td className="px-3 py-2 pl-5 text-sm font-medium text-slate-800">{linea.EmpleadoNombre}</td>
      <td className="px-3 py-2 font-mono text-xs text-slate-600">{linea.RFC}</td>
      <td className="px-3 py-2 text-right text-xs text-slate-700">{Number(linea.Percepciones).toFixed(2)}</td>
      <td className="px-3 py-2 text-right text-xs text-rose-600">{Number(linea.Deducciones).toFixed(2)}</td>
      <td className="px-3 py-2 text-right text-xs font-semibold text-slate-900">{Number(linea.Neto).toFixed(2)}</td>
      <td className="px-3 py-2 pr-5">
        <div className="flex gap-1">
          <button onClick={() => imprimirRecibo(linea, nomina)} className="rounded-[7px] border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition" title="Imprimir recibo">🖨</button>
          {!cerrada && <button onClick={() => setEditing(true)} className="rounded-[7px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2 py-1 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition">Editar</button>}
        </div>
      </td>
    </tr>
  );
}
