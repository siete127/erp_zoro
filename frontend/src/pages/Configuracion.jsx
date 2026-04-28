import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../services/api';
import { notify } from '../services/notify';
import {
  getGlobalApprovalEmail,
  updateGlobalApprovalEmail,
  getCompanyPriceEmails,
  updateCompanyPriceEmails
} from '../services/configService';

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20 disabled:bg-[#f4f6fb] disabled:text-slate-400";
const sectionClass = "rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]";
const labelClass = "block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1.5";
const saveBtn = "rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition";

export default function Configuracion() {
  const [email, setEmail] = useState('');
  const [companyEmail1, setCompanyEmail1] = useState('');
  const [companyEmail2, setCompanyEmail2] = useState('');
  const [companies, setCompanies] = useState([]);
  const [allowedCompanyIds, setAllowedCompanyIds] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [fiscal, setFiscal] = useState({ RFC: '', LegalName: '', FiscalRegime: '', TaxZipCode: '', Email: '' });
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  const [csdPassword, setCsdPassword] = useState('');
  const [uploadingCsd, setUploadingCsd] = useState(false);
  const [csdStatus, setCsdStatus] = useState(null);
  const cerInputRef = useRef(null);
  const keyInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('fiscal');

  const [apiKeys, setApiKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const g = await getGlobalApprovalEmail();
        setEmail(g);

        const t = localStorage.getItem('token');
        if (t) {
          try {
            const payload = JSON.parse(atob(t.split('.')[1]));
            if (payload) {
              setIsAdmin(payload.rol === 1 || payload.rol === 2);
              if (Array.isArray(payload.companies)) {
                setAllowedCompanyIds(payload.companies);
                if (payload.companies.length > 0) setSelectedCompany(payload.companies[0]);
              }
            }
          } catch (e) {
            console.error('Error parsing token payload', e);
          }
        }

        const compRes = await api.get('/companies/');
        setCompanies(compRes.data || []);
      } catch (err) {
        console.error('Error cargando configuración', err);
        notify('Error cargando configuración', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateGlobalApprovalEmail(email);
      notify('Configuración actualizada correctamente', 'success');
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al guardar configuración', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompanyChange = async (companyId) => {
    setSelectedCompany(companyId);
    if (!companyId) {
      setCompanyEmail1(''); setCompanyEmail2('');
      setFiscal({ RFC: '', LegalName: '', FiscalRegime: '', TaxZipCode: '', Email: '' });
      setCsdStatus(null);
      return;
    }
    try {
      const { email1, email2 } = await getCompanyPriceEmails(companyId);
      setCompanyEmail1(email1);
      setCompanyEmail2(email2);
      const compData = await api.get(`/companies/${companyId}`);
      const c = compData.data;
      setFiscal({ RFC: c.RFC || '', LegalName: c.LegalName || '', FiscalRegime: c.FiscalRegime || '', TaxZipCode: c.TaxZipCode || '', Email: c.Email || '' });
      setCompanyLogoUrl(c.LogoUrl || '');
      setCsdStatus(c.CsdCargado ? 'cargado' : 'pendiente');
    } catch (err) {
      notify('Error cargando datos de la empresa', 'error');
    }
  };

  useEffect(() => { if (selectedCompany) handleCompanyChange(selectedCompany); }, [selectedCompany]);

  const handleSubmitCompany = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setSaving(true);
    try {
      await updateCompanyPriceEmails(selectedCompany, companyEmail1, companyEmail2);
      notify('Correos de aprobación por empresa actualizados', 'success');
      await handleCompanyChange(selectedCompany);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error al guardar correos de empresa', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFiscal = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setSavingFiscal(true);
    try {
      await api.put(`/companies/${selectedCompany}/fiscal`, fiscal);
      notify('Datos fiscales actualizados', 'success');
      const compRes = await api.get('/companies/');
      setCompanies(compRes.data || []);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error guardando datos fiscales', 'error');
    } finally {
      setSavingFiscal(false);
    }
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleSubirCSD = async () => {
    if (!selectedCompany) return;
    const cerFile = cerInputRef.current?.files[0];
    const keyFile = keyInputRef.current?.files[0];
    if (!cerFile || !keyFile || !csdPassword) {
      notify('Selecciona el archivo .cer, .key e ingresa la contraseña', 'error');
      return;
    }
    setUploadingCsd(true);
    try {
      const cerBase64 = await fileToBase64(cerFile);
      const keyBase64 = await fileToBase64(keyFile);
      await api.post(`/companies/${selectedCompany}/csd`, { cerBase64, keyBase64, passwordCsd: csdPassword });
      notify('CSD subido exitosamente a Facturama', 'success');
      setCsdStatus('cargado');
      setCsdPassword('');
      if (cerInputRef.current) cerInputRef.current.value = '';
      if (keyInputRef.current) keyInputRef.current.value = '';
      const compRes = await api.get('/companies/');
      setCompanies(compRes.data || []);
    } catch (err) {
      notify(err.response?.data?.msg || err.response?.data?.error || 'Error subiendo CSD', 'error');
    } finally {
      setUploadingCsd(false);
    }
  };

  const handleEliminarCSD = async () => {
    if (!selectedCompany) return;
    if (!window.confirm('¿Seguro que deseas eliminar el CSD de esta empresa en Facturama?')) return;
    try {
      await api.delete(`/companies/${selectedCompany}/csd`);
      notify('CSD eliminado', 'success');
      setCsdStatus('pendiente');
      const compRes = await api.get('/companies/');
      setCompanies(compRes.data || []);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error eliminando CSD', 'error');
    }
  };

  const regimenes = [
    { code: '601', name: 'General de Ley Personas Morales' },
    { code: '603', name: 'Personas Morales con Fines no Lucrativos' },
    { code: '605', name: 'Sueldos y Salarios' },
    { code: '606', name: 'Arrendamiento' },
    { code: '607', name: 'Régimen de Enajenación o Adquisición de Bienes' },
    { code: '608', name: 'Demás ingresos' },
    { code: '610', name: 'Residentes en el Extranjero' },
    { code: '611', name: 'Ingresos por Dividendos' },
    { code: '612', name: 'Personas Físicas con Actividades Empresariales y Profesionales' },
    { code: '614', name: 'Ingresos por intereses' },
    { code: '615', name: 'Régimen de los ingresos por obtención de premios' },
    { code: '616', name: 'Sin obligaciones fiscales' },
    { code: '620', name: 'Sociedades Cooperativas de Producción' },
    { code: '621', name: 'Incorporación Fiscal' },
    { code: '622', name: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
    { code: '623', name: 'Opcional para Grupos de Sociedades' },
    { code: '624', name: 'Coordinados' },
    { code: '625', name: 'Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
    { code: '626', name: 'Régimen Simplificado de Confianza' }
  ];

  const selectedCompanyData = companies.find(c => String(c.Company_Id) === String(selectedCompany));

  const loadApiKeys = useCallback(async (companyId) => {
    if (!companyId) return;
    setLoadingKeys(true);
    try {
      const res = await api.get(`/api-keys/?company_id=${companyId}`);
      setApiKeys(res.data || []);
    } catch (err) {
      console.error('Error cargando API Keys', err);
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'apikeys' && selectedCompany) loadApiKeys(selectedCompany);
  }, [activeTab, selectedCompany, loadApiKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return notify('El nombre es requerido', 'error');
    setSavingKey(true);
    try {
      const res = await api.post('/api-keys/', {
        Company_Id: Number(selectedCompany),
        Name: newKeyName.trim(),
        Scopes: newKeyScopes.trim() || null,
        ExpiresAt: newKeyExpiry || null,
      });
      setCreatedKey(res.data.ApiKey);
      setNewKeyName(''); setNewKeyScopes(''); setNewKeyExpiry('');
      await loadApiKeys(selectedCompany);
    } catch (err) {
      notify(err.response?.data?.detail || 'Error creando API Key', 'error');
    } finally {
      setSavingKey(false);
    }
  };

  const handleToggleKey = async (keyId, currentActive) => {
    try {
      await api.patch(`/api-keys/${keyId}/toggle`, { IsActive: !currentActive });
      await loadApiKeys(selectedCompany);
    } catch {
      notify('Error actualizando API Key', 'error');
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta API Key? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete(`/api-keys/${keyId}`);
      await loadApiKeys(selectedCompany);
      notify('API Key eliminada', 'success');
    } catch {
      notify('Error eliminando API Key', 'error');
    }
  };

  const TABS = [
    { key: 'fiscal', label: 'Datos Fiscales' },
    { key: 'csd', label: 'Certificado (CSD)' },
    { key: 'emails', label: 'Correos Aprobación' },
    { key: 'logo', label: 'Logo' },
    { key: 'apikeys', label: 'API Keys' }
  ];

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-4xl space-y-5">

        {/* Header */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Sistema</p>
          <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Configuración</h1>
          <p className="text-sm text-slate-500">Ajustes del sistema y datos fiscales de empresas</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
          </div>
        ) : (
          <>
            {/* Company selector */}
            <div className={sectionClass}>
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Empresa</h3>
              {(!isAdmin && allowedCompanyIds.length === 0) ? (
                <p className="text-sm text-rose-600">No tienes empresas asignadas.</p>
              ) : (
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className={premiumField}
                >
                  <option value="">-- seleccionar empresa --</option>
                  {companies
                    .filter(c => isAdmin || allowedCompanyIds.includes(c.Company_Id))
                    .map(c => (
                      <option key={c.Company_Id} value={c.Company_Id}>
                        {c.NameCompany} {c.RFC ? `(${c.RFC})` : ''} {c.CsdCargado ? '✅' : '⚠️'}
                      </option>
                    ))}
                </select>
              )}
              {selectedCompanyData && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                    selectedCompanyData.CsdCargado
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}>
                    CSD: {selectedCompanyData.CsdCargado ? '✅ Cargado' : '⚠️ Pendiente'}
                  </span>
                  {selectedCompanyData.RFC && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700">
                      RFC: {selectedCompanyData.RFC}
                    </span>
                  )}
                </div>
              )}
            </div>

            {selectedCompany && (
              <>
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

                {/* Tab: Datos Fiscales */}
                {activeTab === 'fiscal' && (
                  <div className={sectionClass}>
                    <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Datos Fiscales</h3>
                    <p className="text-sm font-semibold text-slate-800 mb-1">{selectedCompanyData?.NameCompany}</p>
                    <p className="text-xs text-slate-500 mb-4">Estos datos se usan como Emisor en los CFDI generados por esta empresa.</p>
                    <form onSubmit={handleSaveFiscal} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>RFC</label>
                        <input
                          type="text"
                          value={fiscal.RFC}
                          onChange={(e) => setFiscal({ ...fiscal, RFC: e.target.value.toUpperCase() })}
                          maxLength={13}
                          className={premiumField}
                          placeholder="XAXX010101000"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Razón Social</label>
                        <input
                          type="text"
                          value={fiscal.LegalName}
                          onChange={(e) => setFiscal({ ...fiscal, LegalName: e.target.value.toUpperCase() })}
                          className={premiumField}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Régimen Fiscal</label>
                        <select
                          value={fiscal.FiscalRegime}
                          onChange={(e) => setFiscal({ ...fiscal, FiscalRegime: e.target.value })}
                          className={premiumField}
                        >
                          <option value="">-- Seleccionar --</option>
                          {regimenes.map(r => (
                            <option key={r.code} value={r.code}>{r.code} - {r.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Código Postal (Expedición)</label>
                        <input
                          type="text"
                          value={fiscal.TaxZipCode}
                          onChange={(e) => setFiscal({ ...fiscal, TaxZipCode: e.target.value })}
                          maxLength={5}
                          className={premiumField}
                          placeholder="64000"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Email (para CFDI)</label>
                        <input
                          type="email"
                          value={fiscal.Email}
                          onChange={(e) => setFiscal({ ...fiscal, Email: e.target.value })}
                          className={premiumField}
                          placeholder="facturacion@empresa.com"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <button type="submit" disabled={savingFiscal} className={saveBtn}>
                          {savingFiscal ? 'Guardando...' : 'Guardar Datos Fiscales'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Tab: CSD */}
                {activeTab === 'csd' && (
                  <div className={sectionClass}>
                    <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Certificado de Sello Digital (CSD)</h3>
                    <p className="text-sm font-semibold text-slate-800 mb-3">{selectedCompanyData?.NameCompany}</p>

                    <div className={`rounded-[14px] border px-4 py-3 mb-4 ${
                      csdStatus === 'cargado' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                    }`}>
                      <p className={`text-sm font-medium ${csdStatus === 'cargado' ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {csdStatus === 'cargado'
                          ? '✅ CSD cargado en Facturama. Esta empresa puede timbrar CFDI.'
                          : '⚠️ CSD no cargado. Sube el certificado para poder timbrar.'}
                      </p>
                    </div>

                    <p className="text-sm text-slate-500 mb-4">
                      Sube los archivos <strong>.cer</strong> y <strong>.key</strong> del CSD de esta empresa.
                      Se enviarán a Facturama para habilitar el timbrado multiemisor.
                      <br />
                      <span className="text-xs text-slate-400">RFC actual: {fiscal.RFC || 'No configurado'}</span>
                    </p>

                    {!fiscal.RFC && (
                      <div className="rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3 mb-4">
                        <p className="text-sm text-rose-700">⚠️ Primero configura el RFC en la pestaña "Datos Fiscales"</p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <label className={labelClass}>Archivo .cer</label>
                        <input
                          ref={cerInputRef}
                          type="file"
                          accept=".cer"
                          className="w-full text-sm text-slate-500 file:mr-3 file:rounded-[8px] file:border file:border-blue-200 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Archivo .key</label>
                        <input
                          ref={keyInputRef}
                          type="file"
                          accept=".key"
                          className="w-full text-sm text-slate-500 file:mr-3 file:rounded-[8px] file:border file:border-blue-200 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Contraseña del CSD</label>
                        <input
                          type="password"
                          value={csdPassword}
                          onChange={(e) => setCsdPassword(e.target.value)}
                          className={premiumField}
                          placeholder="Contraseña de la llave privada"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleSubirCSD}
                          disabled={uploadingCsd || !fiscal.RFC}
                          className={saveBtn}
                        >
                          {uploadingCsd ? 'Subiendo...' : 'Subir CSD a Facturama'}
                        </button>
                        {csdStatus === 'cargado' && (
                          <button
                            onClick={handleEliminarCSD}
                            className="rounded-[12px] border border-rose-200 bg-rose-50 px-5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition"
                          >
                            Eliminar CSD
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Correos */}
                {activeTab === 'emails' && (
                  <div className={sectionClass}>
                    <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Correos de Aprobación</h3>
                    <p className="text-sm font-semibold text-slate-800 mb-4">{selectedCompanyData?.NameCompany}</p>
                    <form onSubmit={handleSubmitCompany} className="space-y-4">
                      <div>
                        <label className={labelClass}>Correo aprobador 1</label>
                        <input
                          type="email"
                          value={companyEmail1}
                          onChange={(e) => setCompanyEmail1(e.target.value)}
                          placeholder="ejemplo1@empresa.com"
                          className={premiumField}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Correo aprobador 2</label>
                        <input
                          type="email"
                          value={companyEmail2}
                          onChange={(e) => setCompanyEmail2(e.target.value)}
                          placeholder="ejemplo2@empresa.com"
                          className={premiumField}
                        />
                      </div>
                      <button type="submit" disabled={saving} className={saveBtn}>
                        {saving ? 'Guardando...' : 'Guardar correos por empresa'}
                      </button>
                    </form>
                  </div>
                )}

                {/* Tab: API Keys */}
                {activeTab === 'apikeys' && (
                  <div className={sectionClass}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">API Keys</h3>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">{selectedCompanyData?.NameCompany}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Genera claves para sistemas externos. Usa el header{' '}
                          <code className="rounded-[6px] border border-[#eaf0fa] bg-[#f4f7ff] px-1.5 py-0.5 text-[11px] font-mono text-[#1b3d86]">X-API-Key: ek_...</code>
                        </p>
                      </div>
                      <button
                        onClick={() => { setShowNewKeyModal(true); setCreatedKey(null); }}
                        className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] transition"
                      >
                        + Nueva API Key
                      </button>
                    </div>

                    {/* New key modal */}
                    {showNewKeyModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,20,50,0.45)' }}>
                        <div className="overflow-hidden rounded-[24px] shadow-[0_24px_64px_rgba(10,20,50,0.22)] w-full max-w-md">
                          <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
                            <h4 className="text-base font-bold text-white">{createdKey ? 'Clave generada' : 'Nueva API Key'}</h4>
                            <button onClick={() => { setShowNewKeyModal(false); setCreatedKey(null); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition text-sm font-bold">✕</button>
                          </div>
                          <div className="bg-white p-6">
                            {createdKey ? (
                              <>
                                <p className="text-sm text-rose-600 mb-3 font-semibold">Guarda esta clave ahora — no se mostrará de nuevo.</p>
                                <div className="rounded-[12px] border border-[#eaf0fa] bg-[#f4f7ff] p-3 font-mono text-sm break-all mb-4 select-all text-[#1b3d86]">
                                  {createdKey}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => { navigator.clipboard.writeText(createdKey); notify('Copiado al portapapeles', 'success'); }}
                                    className="flex-1 rounded-[12px] border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                                  >
                                    Copiar
                                  </button>
                                  <button
                                    onClick={() => { setShowNewKeyModal(false); setCreatedKey(null); }}
                                    className="flex-1 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                                  >
                                    Cerrar
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="space-y-3 mb-4">
                                  <div>
                                    <label className={labelClass}>Nombre descriptivo *</label>
                                    <input
                                      type="text"
                                      value={newKeyName}
                                      onChange={(e) => setNewKeyName(e.target.value)}
                                      placeholder="Shopify Store, WooCommerce..."
                                      className={premiumField}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Scopes (separados por coma)</label>
                                    <input
                                      type="text"
                                      value={newKeyScopes}
                                      onChange={(e) => setNewKeyScopes(e.target.value)}
                                      placeholder="ventas:read, inventario:read"
                                      className={premiumField}
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">Dejar vacío para acceso completo</p>
                                  </div>
                                  <div>
                                    <label className={labelClass}>Fecha de expiración (opcional)</label>
                                    <input
                                      type="datetime-local"
                                      value={newKeyExpiry}
                                      onChange={(e) => setNewKeyExpiry(e.target.value)}
                                      className={premiumField}
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={handleCreateKey} disabled={savingKey} className={`flex-1 ${saveBtn}`}>
                                    {savingKey ? 'Generando...' : 'Generar clave'}
                                  </button>
                                  <button
                                    onClick={() => { setShowNewKeyModal(false); setNewKeyName(''); setNewKeyScopes(''); setNewKeyExpiry(''); }}
                                    className="flex-1 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {loadingKeys ? (
                      <div className="flex justify-center py-8">
                        <div className="h-6 w-6 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
                      </div>
                    ) : apiKeys.length === 0 ? (
                      <div className="py-10 text-center text-slate-400">
                        <p className="text-3xl mb-2">🔑</p>
                        <p className="text-sm">No hay API Keys para esta empresa.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-[16px] border border-[#eaf0fa]">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-[#eaf0fa]">
                              {["Nombre", "Clave", "Scopes", "Estatus", "Último uso", "Expira", "Acciones"].map(col => (
                                <th key={col} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] first:pl-4">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {apiKeys.map(k => (
                              <tr key={k.Key_Id} className="border-t border-[#eaf0fa] hover:bg-[#f4f7ff]/60 transition">
                                <td className="px-4 py-2.5 font-semibold text-slate-800">{k.Name}</td>
                                <td className="px-4 py-2.5 font-mono text-slate-400">{k.ApiKeyMasked}</td>
                                <td className="px-4 py-2.5 text-slate-500">{k.Scopes || <span className="italic text-slate-300">completo</span>}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                    k.IsActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
                                  }`}>
                                    {k.IsActive ? 'Activa' : 'Inactiva'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-400">{k.LastUsed ? new Date(k.LastUsed).toLocaleDateString('es-MX') : '—'}</td>
                                <td className="px-4 py-2.5 text-slate-400">{k.ExpiresAt ? new Date(k.ExpiresAt).toLocaleDateString('es-MX') : '—'}</td>
                                <td className="px-4 py-2.5">
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => handleToggleKey(k.Key_Id, k.IsActive)}
                                      className={`rounded-[8px] border px-2 py-1 text-[10px] font-semibold transition ${
                                        k.IsActive
                                          ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      }`}
                                    >
                                      {k.IsActive ? 'Desactivar' : 'Activar'}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteKey(k.Key_Id)}
                                      className="rounded-[8px] border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-100 transition"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Logo */}
                {activeTab === 'logo' && (
                  <div className={sectionClass}>
                    <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Logo</h3>
                    <p className="text-sm font-semibold text-slate-800 mb-1">{selectedCompanyData?.NameCompany}</p>
                    <p className="text-xs text-slate-500 mb-4">Sube el logo de la empresa (PNG, JPG, SVG, WEBP). Se mostrará en listados y vistas.</p>

                    <div className="mb-4">
                      {companyLogoUrl || selectedCompanyData?.LogoUrl ? (
                        <img src={companyLogoUrl || selectedCompanyData?.LogoUrl} alt="logo" className="w-40 h-40 object-contain rounded-[12px] border border-[#dce4f0]" />
                      ) : (
                        <div className="w-40 h-40 rounded-[12px] border border-[#dce4f0] bg-[#f4f6fb] flex items-center justify-center text-slate-400 text-sm">
                          Sin logo
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="block text-sm text-slate-500 file:mr-3 file:rounded-[8px] file:border file:border-blue-200 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <button
                        onClick={async () => {
                          if (!selectedCompany) return notify('Selecciona una empresa', 'warning');
                          const file = logoInputRef.current?.files?.[0];
                          if (!file) return notify('Selecciona un archivo de logo', 'warning');
                          setUploadingLogo(true);
                          try {
                            const form = new FormData();
                            form.append('logo', file);
                            const res = await api.post(`/companies/${selectedCompany}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
                            const url = (res.data && res.data.LogoUrl) || null;
                            if (url) {
                              setCompanyLogoUrl(url);
                              notify('Logo subido correctamente', 'success');
                              const compRes = await api.get('/companies/');
                              setCompanies(compRes.data || []);
                            } else {
                              notify('Logo subido, pero no se obtuvo URL', 'warning');
                            }
                          } catch (err) {
                            notify(err.response?.data?.msg || 'Error subiendo logo', 'error');
                          } finally {
                            setUploadingLogo(false);
                          }
                        }}
                        disabled={uploadingLogo}
                        className={saveBtn}
                      >
                        {uploadingLogo ? 'Subiendo...' : 'Subir logo'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Global approval email */}
            <div className={sectionClass}>
              <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Aprobación Global</h3>
              <p className="text-sm font-semibold text-slate-800 mb-1">Correo para cambios de precio (fallback global)</p>
              <p className="text-xs text-slate-500 mb-4">
                Los códigos de aprobación para cambios de precio se enviarán a este correo si no hay direcciones configuradas para la empresa seleccionada.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="ejemplo@empresa.com"
                    className={premiumField}
                  />
                </div>
                <button type="submit" disabled={saving} className={saveBtn}>
                  {saving ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </form>
            </div>

            {/* Multiemisor status */}
            <div className="rounded-[20px] border border-blue-200/80 bg-[linear-gradient(180deg,rgba(239,246,255,0.97)_0%,rgba(219,234,254,0.6)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.06)]">
              <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#3b6fd4]">Estado Multiemisor</h3>
              <p className="text-xs text-blue-700 mb-4">
                Cada empresa necesita su CSD cargado para poder timbrar CFDI. Todas utilizan la misma cuenta de Facturama.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {companies.map(c => (
                  <div key={c.Company_Id} className={`rounded-[14px] border p-3 ${
                    c.CsdCargado ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                  }`}>
                    <p className="font-semibold text-sm text-slate-800">{c.NameCompany}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.RFC || 'Sin RFC'}</p>
                    <p className={`text-xs mt-1.5 font-semibold ${c.CsdCargado ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {c.CsdCargado ? '✅ Listo para timbrar' : '⚠️ CSD pendiente'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
