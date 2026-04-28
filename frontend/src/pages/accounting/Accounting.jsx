import React, { useEffect, useState, useMemo } from 'react';
import accountingService from '../../services/accountingService';
import api from '../../services/api';
import { notify } from '../../services/notify';

const FMT = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const fmt = (v) => FMT.format(Number(v) || 0);

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";
const smallField = "w-full rounded-[10px] border border-[#dce4f0] bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/15";

const TYPE_BADGE = {
  INGRESO: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  GASTO:   'border-rose-200 bg-rose-50 text-rose-700',
  COSTO:   'border-rose-200 bg-rose-50 text-rose-700',
  ACTIVO:  'border-blue-200 bg-blue-50 text-blue-700',
  PASIVO:  'border-amber-200 bg-amber-50 text-amber-700',
  CAPITAL: 'border-violet-200 bg-violet-50 text-violet-700',
};

const ACCOUNT_TYPES = ['ACTIVO', 'PASIVO', 'CAPITAL', 'INGRESO', 'GASTO', 'COSTO'];

export default function Accounting() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('cuentas');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [balances, setBalances] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [incomeStmt, setIncomeStmt] = useState([]);
  const [loadingIncome, setLoadingIncome] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountForm, setAccountForm] = useState({ AccountCode: '', Name: '', Type: '', Company_Id: '', ParentAccount: '' });
  const [savingAccount, setSavingAccount] = useState(false);
  const [balanceDetail, setBalanceDetail] = useState(null);
  const [companies, setCompanies] = useState([]);

  useEffect(() => { loadAccounts(); loadKpis(); loadCompanies(); }, []);

  async function loadCompanies() {
    try {
      const res = await api.get('/companies/');
      setCompanies(res.data || []);
    } catch (_) {}
  }

  async function loadAccounts() {
    setLoading(true);
    try {
      const res = await accountingService.listAccounts();
      setAccounts(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch (err) {
      console.error('loadAccounts', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadKpis() {
    try {
      const res = await accountingService.getOperationalReports();
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setKpis(data);
    } catch (_) { setKpis([]); }
  }

  async function loadBalances() {
    setLoadingBalances(true);
    try {
      const params = new URLSearchParams();
      if (from) params.append('from_date', from);
      if (to) params.append('to_date', to);
      const res = await api.get(`/accounting/balances?${params}`);
      setBalances(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch (err) {
      notify(err.response?.data?.detail || 'Error obteniendo balanzas', 'error');
    } finally {
      setLoadingBalances(false);
    }
  }

  async function loadIncomeStatement() {
    setLoadingIncome(true);
    try {
      const params = new URLSearchParams();
      if (from) params.append('from_date', from);
      if (to) params.append('to_date', to);
      const res = await api.get(`/accounting/income-statement?${params}`);
      setIncomeStmt(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch (err) {
      notify(err.response?.data?.detail || 'Error obteniendo estado de resultados', 'error');
    } finally {
      setLoadingIncome(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'balanza') loadBalances();
    if (activeTab === 'resultados') loadIncomeStatement();
  }, [activeTab]);

  const kpiValue = (metric) => {
    const r = kpis.find(k => k.Metric === metric);
    return r ? r.Value : 0;
  };

  const filteredAccounts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return accounts;
    return accounts.filter(a =>
      String(a.AccountCode || '').toLowerCase().includes(q) ||
      String(a.Name || '').toLowerCase().includes(q) ||
      String(a.Type || '').toLowerCase().includes(q)
    );
  }, [accounts, search]);

  function exportCsv() {
    if (!filteredAccounts.length) return notify('No hay datos para exportar', 'warning');
    const rows = filteredAccounts.map(a => ({ Código: a.AccountCode, Nombre: a.Name, Tipo: a.Type, Empresa: a.Company_Id }));
    const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cuentas.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function exportBalancesCsv() {
    if (!balances.length) return notify('No hay balanza para exportar', 'warning');
    const rows = balances.map(b => ({ Cuenta: b.AccountCode, Cargo: b.Debit, Abono: b.Credit, Saldo: (b.Debit || 0) - (b.Credit || 0) }));
    const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'balanza.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function openCreateModal() {
    setEditingAccount(null);
    setAccountForm({ AccountCode: '', Name: '', Type: '', Company_Id: companies[0]?.Company_Id || '', ParentAccount: '' });
    setShowAccountModal(true);
  }

  function openEditModal(account) {
    setEditingAccount(account);
    setAccountForm({ AccountCode: account.AccountCode || '', Name: account.Name || '', Type: account.Type || '', Company_Id: account.Company_Id || '', ParentAccount: account.ParentAccount || '' });
    setShowAccountModal(true);
  }

  async function handleSaveAccount(e) {
    e.preventDefault();
    if (!accountForm.AccountCode || !accountForm.Name || !accountForm.Type) return notify('Código, nombre y tipo son requeridos', 'error');
    setSavingAccount(true);
    try {
      const payload = { AccountCode: accountForm.AccountCode, Name: accountForm.Name, Type: accountForm.Type, Company_Id: Number(accountForm.Company_Id), ParentAccount: accountForm.ParentAccount || null };
      if (editingAccount) {
        await api.put(`/accounting/accounts/${editingAccount.AccountCode}`, payload);
        notify('Cuenta actualizada', 'success');
      } else {
        await api.post('/accounting/accounts', payload);
        notify('Cuenta creada', 'success');
      }
      setShowAccountModal(false);
      loadAccounts();
    } catch (err) {
      notify(err.response?.data?.detail || 'Error guardando cuenta', 'error');
    } finally {
      setSavingAccount(false);
    }
  }

  const ingresos = incomeStmt.filter(r => r.AccountType === 'INGRESO');
  const gastos = incomeStmt.filter(r => ['GASTO', 'COSTO'].includes(r.AccountType));
  const totalIngresos = ingresos.reduce((s, r) => s + (Number(r.TotalCredit) - Number(r.TotalDebit)), 0);
  const totalGastos = gastos.reduce((s, r) => s + (Number(r.TotalDebit) - Number(r.TotalCredit)), 0);
  const utilidadNeta = totalIngresos - totalGastos;

  const TABS = [
    { key: 'cuentas', label: 'Catálogo de Cuentas' },
    { key: 'balanza', label: 'Balanza de Comprobación' },
    { key: 'resultados', label: 'Estado de Resultados' },
  ];

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 overflow-auto"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-6xl space-y-5">

        {/* Header */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Finanzas</p>
          <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Contabilidad</h1>
          <p className="text-sm text-slate-500">Catálogo de cuentas, balanzas y reportes financieros</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: 'Cuentas por Cobrar', metric: 'Receivables', color: 'border-blue-200 bg-blue-50', text: 'text-blue-700', val: 'text-blue-900' },
            { title: 'Cuentas por Pagar', metric: 'Payables', color: 'border-rose-200 bg-rose-50', text: 'text-rose-700', val: 'text-rose-900' },
            { title: 'Efectivo / Bancos', metric: 'Cash', color: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700', val: 'text-emerald-900' },
          ].map(k => (
            <div key={k.metric} className={`rounded-[20px] border p-4 ${k.color}`}>
              <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${k.text}`}>{k.title}</p>
              <p className={`text-2xl font-bold mt-1 ${k.val}`}>{fmt(kpiValue(k.metric))}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 rounded-[18px] border border-white/70 bg-white/60 p-1.5 shadow-[0_2px_10px_rgba(15,45,93,0.06)]">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-[12px] px-4 py-2 text-xs font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.25)]'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date filters for balanza/resultados */}
        {(activeTab === 'balanza' || activeTab === 'resultados') && (
          <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] px-5 py-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96] mb-1">Desde</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={smallField} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96] mb-1">Hasta</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className={smallField} />
              </div>
              <button
                onClick={activeTab === 'balanza' ? loadBalances : loadIncomeStatement}
                className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] transition"
              >
                Aplicar filtro
              </button>
              {activeTab === 'balanza' && balances.length > 0 && (
                <button onClick={exportBalancesCsv} className="rounded-[12px] border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition">
                  Exportar CSV
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB: Catálogo de Cuentas */}
        {activeTab === 'cuentas' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar código, nombre o tipo..."
                className="rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20 w-64"
              />
              <div className="ml-auto flex gap-2">
                <button onClick={loadAccounts} className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Actualizar</button>
                <button onClick={exportCsv} className="rounded-[12px] border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition">Exportar CSV</button>
                <button onClick={openCreateModal} className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.20)] transition">+ Nueva Cuenta</button>
              </div>
            </div>
            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-[#eaf0fa]">
                      {["Código", "Nombre", "Tipo", "Empresa", "Cuenta Padre", "Acciones"].map((col, i) => (
                        <th key={col} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i === 5 ? 'text-right' : ''}`}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">Cargando...</td></tr>}
                    {!loading && filteredAccounts.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">No hay cuentas</td></tr>}
                    {filteredAccounts.map((a) => (
                      <tr key={a.Account_Id || a.AccountCode} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                        <td className="px-4 py-3 pl-6 font-mono text-xs font-semibold text-[#1b3d86]">{a.AccountCode}</td>
                        <td className="px-4 py-3 text-slate-800">{a.Name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${TYPE_BADGE[a.Type] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                            {a.Type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{a.Company_Id || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{a.ParentAccount || '—'}</td>
                        <td className="px-4 py-3 pr-6 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => setBalanceDetail(a)} className="rounded-[8px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2.5 py-1 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition">
                              Ver saldo
                            </button>
                            <button onClick={() => openEditModal(a)} className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Balanza de Comprobación */}
        {activeTab === 'balanza' && (
          loadingBalances ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : balances.length === 0 ? (
            <div className="rounded-[20px] border border-white/70 bg-white/80 py-12 text-center text-slate-400">
              <p className="text-3xl mb-2">⚖️</p>
              <p className="text-sm">Selecciona un rango de fechas y presiona "Aplicar filtro"</p>
            </div>
          ) : (
            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-[#eaf0fa]">
                      {["Cuenta", "Cargo (Débito)", "Abono (Crédito)", "Saldo"].map((col, i) => (
                        <th key={col} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i > 0 ? 'text-right' : ''}`}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((b, i) => {
                      const saldo = (Number(b.Debit) || 0) - (Number(b.Credit) || 0);
                      return (
                        <tr key={b.AccountCode || i} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                          <td className="px-4 py-3 pl-6 font-mono text-xs font-semibold text-[#1b3d86]">{b.AccountCode}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{fmt(b.Debit)}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{fmt(b.Credit)}</td>
                          <td className={`px-4 py-3 pr-6 text-right font-semibold ${saldo < 0 ? 'text-rose-600' : 'text-slate-800'}`}>{fmt(saldo)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-[#eaf0fa]">
                    <tr>
                      <td className="px-4 py-3 pl-6 text-sm font-bold text-slate-800">Totales</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(balances.reduce((s, b) => s + (Number(b.Debit) || 0), 0))}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(balances.reduce((s, b) => s + (Number(b.Credit) || 0), 0))}</td>
                      <td className="px-4 py-3 pr-6 text-right font-bold text-slate-800">{fmt(balances.reduce((s, b) => s + (Number(b.Debit) || 0) - (Number(b.Credit) || 0), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        )}

        {/* TAB: Estado de Resultados */}
        {activeTab === 'resultados' && (
          loadingIncome ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : incomeStmt.length === 0 ? (
            <div className="rounded-[20px] border border-white/70 bg-white/80 py-12 text-center text-slate-400">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-sm">Selecciona un rango de fechas y presiona "Aplicar filtro"</p>
            </div>
          ) : (
            <div className="max-w-2xl">
              <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
                <div className="border-b border-[#eaf0fa] px-6 py-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Estado de Resultados</h3>
                  {(from || to) && <p className="text-xs text-slate-400 mt-0.5">{from || '…'} → {to || 'hoy'}</p>}
                </div>
                <div className="p-6 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] mb-2">Ingresos</p>
                  {ingresos.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-[#eaf0fa]">
                      <span className="text-slate-600">{r.AccountType}</span>
                      <span className="font-semibold text-emerald-700">{fmt(Number(r.TotalCredit) - Number(r.TotalDebit))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold py-2 border-b-2 border-[#eaf0fa]">
                    <span className="text-slate-800">Total Ingresos</span>
                    <span className="text-emerald-700">{fmt(totalIngresos)}</span>
                  </div>

                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] mt-4 mb-2">Gastos y Costos</p>
                  {gastos.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-[#eaf0fa]">
                      <span className="text-slate-600">{r.AccountType}</span>
                      <span className="font-semibold text-rose-700">{fmt(Number(r.TotalDebit) - Number(r.TotalCredit))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold py-2 border-b-2 border-[#eaf0fa]">
                    <span className="text-slate-800">Total Gastos</span>
                    <span className="text-rose-700">{fmt(totalGastos)}</span>
                  </div>

                  <div className={`flex justify-between text-base font-bold py-3 mt-2 px-3 rounded-[14px] border ${
                    utilidadNeta >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}>
                    <span>{utilidadNeta >= 0 ? 'Utilidad Neta' : 'Pérdida Neta'}</span>
                    <span>{fmt(utilidadNeta)}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Modal: Ver saldo por cuenta */}
      {balanceDetail && (
        <AccountBalanceModal
          account={balanceDetail}
          from={from}
          to={to}
          onClose={() => setBalanceDetail(null)}
        />
      )}

      {/* Modal: Crear / Editar cuenta */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,20,50,0.45)' }}>
          <div className="overflow-hidden rounded-[24px] shadow-[0_24px_64px_rgba(10,20,50,0.22)] w-full max-w-md">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4">
              <h4 className="text-base font-bold text-white">{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta Contable'}</h4>
              <button onClick={() => setShowAccountModal(false)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition text-sm font-bold">✕</button>
            </div>
            <div className="bg-white p-6">
              <form onSubmit={handleSaveAccount} className="space-y-3">
                {[
                  { label: 'Código *', key: 'AccountCode', placeholder: '1000, 1100.01...' },
                  { label: 'Nombre *', key: 'Name', placeholder: 'Caja, Bancos, Ventas...' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1.5">{f.label}</label>
                    <input
                      value={accountForm[f.key]}
                      onChange={e => setAccountForm({ ...accountForm, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className={premiumField}
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1.5">Tipo *</label>
                  <select value={accountForm.Type} onChange={e => setAccountForm({ ...accountForm, Type: e.target.value })} className={premiumField}>
                    <option value="">-- Seleccionar --</option>
                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1.5">Empresa *</label>
                  <select value={accountForm.Company_Id} onChange={e => setAccountForm({ ...accountForm, Company_Id: e.target.value })} className={premiumField}>
                    <option value="">-- Seleccionar --</option>
                    {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1.5">Cuenta Padre (opcional)</label>
                  <input value={accountForm.ParentAccount} onChange={e => setAccountForm({ ...accountForm, ParentAccount: e.target.value })} placeholder="1000" className={premiumField} />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={savingAccount} className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition">
                    {savingAccount ? 'Guardando...' : (editingAccount ? 'Actualizar' : 'Crear cuenta')}
                  </button>
                  <button type="button" onClick={() => setShowAccountModal(false)} className="flex-1 rounded-[12px] border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountBalanceModal({ account, from, to, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams({ accountId: account.AccountCode });
        if (from) params.append('from_date', from);
        if (to) params.append('to_date', to);
        const res = await api.get(`/accounting/balances?${params}`);
        const rows = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setData(rows.find(r => r.AccountCode === account.AccountCode) || null);
      } catch (_) {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [account, from, to]);

  const saldo = data ? (Number(data.Debit) || 0) - (Number(data.Credit) || 0) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,20,50,0.45)' }}>
      <div className="overflow-hidden rounded-[24px] shadow-[0_24px_64px_rgba(10,20,50,0.22)] w-full max-w-sm">
        <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4">
          <h4 className="text-base font-bold text-white">{account.AccountCode} — {account.Name}</h4>
          <p className="text-xs text-blue-200 mt-0.5">{account.Type}</p>
        </div>
        <div className="bg-white p-6">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : !data ? (
            <p className="text-sm text-slate-400">Sin movimientos en el período seleccionado.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-[#eaf0fa]"><span className="text-slate-500">Cargo (Débito)</span><span className="font-semibold">{FMT.format(Number(data.Debit) || 0)}</span></div>
              <div className="flex justify-between py-2 border-b border-[#eaf0fa]"><span className="text-slate-500">Abono (Crédito)</span><span className="font-semibold">{FMT.format(Number(data.Credit) || 0)}</span></div>
              <div className={`flex justify-between py-2 font-bold ${saldo < 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                <span>Saldo</span><span>{FMT.format(saldo)}</span>
              </div>
            </div>
          )}
          <button onClick={onClose} className="mt-4 w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
