import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';

function exportReporteCsv(reporte, mes) {
  if (!reporte.length) return;
  const rows = reporte.map(r => ({
    Usuario: r.Username,
    'Días asistidos': r.DiasAsistidos,
    'Horas totales': (Math.floor(r.TotalMinutos / 60) + 'h ' + (r.TotalMinutos % 60) + 'm'),
    'Home Office': r.DiasHomeOffice,
    Permisos: r.DiasPermiso,
  }));
  const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `reporte_asistencia_${mes}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

const TIPOS = ['normal', 'home_office', 'permiso'];
const TIPO_LABEL = { normal: 'Normal', home_office: 'Home Office', permiso: 'Permiso' };
const TIPO_COLOR = {
  normal: 'border-blue-200 bg-blue-50 text-blue-700',
  home_office: 'border-violet-200 bg-violet-50 text-violet-700',
  permiso: 'border-amber-200 bg-amber-50 text-amber-700',
};

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

function hhmm(mins) {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function Asistencia() {
  const [tab, setTab] = useState('registro');
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [estadoHoy, setEstadoHoy] = useState(null);
  const [tipo, setTipo] = useState('normal');
  const [loadingEstado, setLoadingEstado] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const [registros, setRegistros] = useState([]);
  const [filtroMes, setFiltroMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [loadingReg, setLoadingReg] = useState(false);

  const [reporte, setReporte] = useState([]);
  const [loadingReporte, setLoadingReporte] = useState(false);

  const [corrigiendo, setCorrigiendo] = useState(null);
  const [correccionForm, setCorreccionForm] = useState({ HoraEntrada: '', HoraSalida: '', Tipo: '' });
  const [savingCorreccion, setSavingCorreccion] = useState(false);

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const userId = localStorage.getItem('userId');

  const tokenStr = localStorage.getItem('token');
  const isAdmin = (() => {
    try { const p = JSON.parse(atob(tokenStr.split('.')[1])); return p.rol === 1 || p.rol === 2; }
    catch { return false; }
  })();

  useEffect(() => {
    api.get('/companies/').then(r => {
      const list = r.data || [];
      setCompanies(list);
      if (list.length > 0) setSelectedCompany(String(list[0].Company_Id));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedCompany && userId) cargarEstadoHoy();
  }, [selectedCompany, userId]);

  const cargarEstadoHoy = async () => {
    setLoadingEstado(true);
    try {
      const r = await api.get(`/asistencia/estado-hoy/${userId}?company_id=${selectedCompany}`);
      setEstadoHoy(r.data?.data || null);
    } catch {
      setEstadoHoy(null);
    } finally {
      setLoadingEstado(false);
    }
  };

  const handleCheckIn = async () => {
    setProcesando(true);
    try {
      await api.post(`/asistencia/check-in/${userId}`, { Company_Id: Number(selectedCompany), Tipo: tipo });
      notify('Check-in registrado', 'success');
      await cargarEstadoHoy();
    } catch (err) {
      notify(err?.response?.data?.detail || 'Error al hacer check-in', 'error');
    } finally {
      setProcesando(false);
    }
  };

  const handleCheckOut = async () => {
    setProcesando(true);
    try {
      await api.post(`/asistencia/check-out/${userId}`, { Company_Id: Number(selectedCompany), Tipo: tipo });
      notify('Check-out registrado', 'success');
      await cargarEstadoHoy();
    } catch (err) {
      notify(err?.response?.data?.detail || 'Error al hacer check-out', 'error');
    } finally {
      setProcesando(false);
    }
  };

  const cargarRegistros = async () => {
    setLoadingReg(true);
    try {
      const params = new URLSearchParams();
      if (selectedCompany) params.append('company_id', selectedCompany);
      if (filtroMes) params.append('mes', filtroMes);
      const r = await api.get(`/asistencia?${params}`);
      setRegistros(r.data?.data || []);
    } catch {
      setRegistros([]);
    } finally {
      setLoadingReg(false);
    }
  };

  const cargarReporte = async () => {
    if (!filtroMes) return;
    setLoadingReporte(true);
    try {
      const params = new URLSearchParams({ mes: filtroMes });
      if (selectedCompany) params.append('company_id', selectedCompany);
      const r = await api.get(`/asistencia/reporte-mensual?${params}`);
      setReporte(r.data?.data || []);
    } catch {
      setReporte([]);
    } finally {
      setLoadingReporte(false);
    }
  };

  const handleCorregir = async (e) => {
    e.preventDefault();
    setSavingCorreccion(true);
    const payload = {};
    if (correccionForm.HoraEntrada) payload.HoraEntrada = correccionForm.HoraEntrada;
    if (correccionForm.HoraSalida !== '') payload.HoraSalida = correccionForm.HoraSalida;
    if (correccionForm.Tipo) payload.Tipo = correccionForm.Tipo;
    try {
      await api.put(`/asistencia/${corrigiendo.Asist_Id}`, payload);
      notify('Registro corregido', 'success');
      setCorrigiendo(null);
      await cargarRegistros();
    } catch (err) {
      notify(err?.response?.data?.detail || 'Error al corregir', 'error');
    } finally {
      setSavingCorreccion(false);
    }
  };

  useEffect(() => {
    if (tab === 'listado') cargarRegistros();
    if (tab === 'reporte') cargarReporte();
  }, [tab, filtroMes, selectedCompany]);

  const tieneCheckInActivo = estadoHoy && !estadoHoy.HoraSalida;
  const yaCompletado = estadoHoy && estadoHoy.HoraSalida;

  const TABS = [['registro', 'Mi asistencia'], ['listado', 'Historial'], ['reporte', 'Reporte mensual']];

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">RH</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Asistencia</h1>
            <p className="text-sm text-slate-500">Registro de entrada y salida, historial y reporte mensual.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <label className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresa</label>
              <select
                className="rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
                value={selectedCompany}
                onChange={e => setSelectedCompany(e.target.value)}
              >
                {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Pill tabs */}
        <div className="flex gap-1 rounded-[16px] border border-[#dce4f0] bg-white/80 p-1 shadow-[0_2px_8px_rgba(15,45,93,0.05)] w-fit">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-[12px] px-4 py-2 text-sm font-semibold transition ${
                tab === key
                  ? 'bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.25)]'
                  : 'text-slate-600 hover:bg-white/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ===== TAB: Mi asistencia ===== */}
        {tab === 'registro' && (
          <div className="max-w-md">
            <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-6 shadow-[0_4px_20px_rgba(15,45,93,0.07)] text-center">
              <p className="text-sm text-slate-600 mb-1">
                Hoy: <span className="font-semibold text-slate-900">{new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </p>
              <p className="text-sm text-slate-600 mb-5">
                Usuario: <span className="font-semibold">{currentUser?.Username || userId}</span>
              </p>

              {loadingEstado ? (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
                </div>
              ) : (
                <>
                  {!estadoHoy && (
                    <div className="mb-4 rounded-[14px] border border-[#dce4f0] bg-[#f4f6fb] p-3">
                      <p className="text-sm text-slate-600">Sin registro de hoy</p>
                    </div>
                  )}
                  {tieneCheckInActivo && (
                    <div className="mb-4 rounded-[14px] border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-sm text-emerald-700 font-semibold">Entrada registrada</p>
                      <p className="text-xs text-emerald-600">{estadoHoy.HoraEntrada ? new Date(estadoHoy.HoraEntrada).toLocaleTimeString('es-MX') : ''}</p>
                      <span className={`mt-1.5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIPO_COLOR[estadoHoy.Tipo] || ''}`}>
                        {TIPO_LABEL[estadoHoy.Tipo] || estadoHoy.Tipo}
                      </span>
                    </div>
                  )}
                  {yaCompletado && (
                    <div className="mb-4 rounded-[14px] border border-blue-200 bg-blue-50 p-3">
                      <p className="text-sm text-blue-700 font-semibold">Jornada completada</p>
                      <p className="text-xs text-blue-600">
                        Entrada: {new Date(estadoHoy.HoraEntrada).toLocaleTimeString('es-MX')} — Salida: {new Date(estadoHoy.HoraSalida).toLocaleTimeString('es-MX')}
                      </p>
                      <span className={`mt-1.5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIPO_COLOR[estadoHoy.Tipo] || ''}`}>
                        {TIPO_LABEL[estadoHoy.Tipo] || estadoHoy.Tipo}
                      </span>
                    </div>
                  )}

                  {!yaCompletado && (
                    <div className="mb-5 text-left">
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Tipo de jornada</label>
                      <select className={premiumField} value={tipo} onChange={e => setTipo(e.target.value)}>
                        {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                      </select>
                    </div>
                  )}

                  {!yaCompletado && (
                    <div className="flex gap-3 justify-center">
                      {!tieneCheckInActivo && (
                        <button
                          onClick={handleCheckIn}
                          disabled={procesando}
                          className="rounded-[12px] bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(5,150,105,0.25)] disabled:opacity-50 transition"
                        >
                          {procesando ? 'Registrando...' : 'Check-in'}
                        </button>
                      )}
                      {tieneCheckInActivo && (
                        <button
                          onClick={handleCheckOut}
                          disabled={procesando}
                          className="rounded-[12px] bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(220,38,38,0.25)] disabled:opacity-50 transition"
                        >
                          {procesando ? 'Registrando...' : 'Check-out'}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ===== TAB: Historial ===== */}
        {tab === 'listado' && (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Mes</label>
                <input type="month" className="rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} />
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
              {loadingReg ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
                </div>
              ) : registros.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-400">Sin registros para el período seleccionado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#eaf0fa]">
                        {["Usuario","Fecha","Entrada","Salida","Horas","Tipo","Empresa", ...(isAdmin ? [""] : [])].map((col, i) => (
                          <th key={i} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map(r => (
                        <tr key={r.Asist_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 first:pl-6">{r.Username}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{r.Fecha ? new Date(r.Fecha + 'T00:00:00').toLocaleDateString('es-MX') : '—'}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{r.HoraEntrada ? new Date(r.HoraEntrada).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {r.HoraSalida
                              ? new Date(r.HoraSalida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                              : <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">En curso</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{hhmm(r.MinutosTrabajados)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIPO_COLOR[r.Tipo] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                              {TIPO_LABEL[r.Tipo] || r.Tipo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{r.NameCompany}</td>
                          {isAdmin && (
                            <td className="px-4 py-3 pr-6">
                              <button
                                onClick={() => {
                                  setCorrigiendo(r);
                                  setCorreccionForm({
                                    HoraEntrada: r.HoraEntrada ? new Date(r.HoraEntrada).toISOString().slice(0, 16) : '',
                                    HoraSalida: r.HoraSalida ? new Date(r.HoraSalida).toISOString().slice(0, 16) : '',
                                    Tipo: r.Tipo || 'normal',
                                  });
                                }}
                                className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition"
                              >
                                Corregir
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal corrección */}
            {corrigiendo && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-sm overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
                  <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-bold text-white">Corregir registro</h4>
                      <p className="text-xs text-blue-200">{corrigiendo.Username} — {corrigiendo.Fecha?.slice(0,10)}</p>
                    </div>
                    <button onClick={() => setCorrigiendo(null)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
                  </div>
                  <div className="bg-white p-6">
                    <form onSubmit={handleCorregir} className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Hora entrada</label>
                        <input
                          type="datetime-local"
                          value={correccionForm.HoraEntrada}
                          onChange={e => setCorreccionForm(f => ({ ...f, HoraEntrada: e.target.value }))}
                          className={premiumField}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Hora salida (vacío = en curso)</label>
                        <input
                          type="datetime-local"
                          value={correccionForm.HoraSalida}
                          onChange={e => setCorreccionForm(f => ({ ...f, HoraSalida: e.target.value }))}
                          className={premiumField}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Tipo</label>
                        <select
                          value={correccionForm.Tipo}
                          onChange={e => setCorreccionForm(f => ({ ...f, Tipo: e.target.value }))}
                          className={premiumField}
                        >
                          {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={savingCorreccion}
                          className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-3 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition"
                        >
                          {savingCorreccion ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCorrigiendo(null)}
                          className="flex-1 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: Reporte mensual ===== */}
        {tab === 'reporte' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Mes</label>
                <input type="month" className="rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} />
              </div>
              {reporte.length > 0 && (
                <button
                  onClick={() => exportReporteCsv(reporte, filtroMes)}
                  className="rounded-[12px] border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                >
                  Exportar CSV
                </button>
              )}
            </div>

            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
              {loadingReporte ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
                </div>
              ) : reporte.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-400">Sin datos para el mes seleccionado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#eaf0fa]">
                        {["Usuario","Días asistidos","Horas totales","Home Office","Permisos"].map((col, i) => (
                          <th key={col} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i > 0 ? 'text-right' : ''}`}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reporte.map((r, i) => (
                        <tr key={i} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 first:pl-6">{r.Username}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-slate-800">{r.DiasAsistidos}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-700">{hhmm(r.TotalMinutos)}</td>
                          <td className="px-4 py-3 text-sm text-right text-violet-700">{r.DiasHomeOffice}</td>
                          <td className="px-4 py-3 text-sm text-right text-amber-700 last:pr-6">{r.DiasPermiso}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#dce4f0] bg-[#f4f7ff]/60">
                        <td className="px-4 py-3 text-sm font-bold text-slate-800 first:pl-6">Total</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-slate-900">{reporte.reduce((s, r) => s + Number(r.DiasAsistidos), 0)}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-700">{hhmm(reporte.reduce((s, r) => s + Number(r.TotalMinutos || 0), 0))}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-violet-800">{reporte.reduce((s, r) => s + Number(r.DiasHomeOffice), 0)}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-amber-800 last:pr-6">{reporte.reduce((s, r) => s + Number(r.DiasPermiso), 0)}</td>
                      </tr>
                    </tfoot>
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
