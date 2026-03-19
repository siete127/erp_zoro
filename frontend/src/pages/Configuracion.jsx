import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { notify } from '../services/notify';
import {
  getGlobalApprovalEmail,
  updateGlobalApprovalEmail,
  getCompanyPriceEmails,
  updateCompanyPriceEmails
} from '../services/configService';

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

  // Datos fiscales
  const [fiscal, setFiscal] = useState({ RFC: '', LegalName: '', FiscalRegime: '', TaxZipCode: '', Email: '' });
  const [savingFiscal, setSavingFiscal] = useState(false);
  
  // CSD
  const [csdPassword, setCsdPassword] = useState('');
  const [uploadingCsd, setUploadingCsd] = useState(false);
  const [csdStatus, setCsdStatus] = useState(null);
  const cerInputRef = useRef(null);
  const keyInputRef = useRef(null);

  // Tab activo
  const [activeTab, setActiveTab] = useState('fiscal');

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
                if (payload.companies.length > 0) {
                  setSelectedCompany(payload.companies[0]);
                }
              }
            }
          } catch (e) {
            console.error('Error parsing token payload', e);
          }
        }

        const compRes = await api.get('/companies');
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
      console.error('Error guardando configuración', err);
      notify(err.response?.data?.msg || 'Error al guardar configuración', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompanyChange = async (companyId) => {
    setSelectedCompany(companyId);
    if (!companyId) {
      setCompanyEmail1('');
      setCompanyEmail2('');
      setFiscal({ RFC: '', LegalName: '', FiscalRegime: '', TaxZipCode: '', Email: '' });
      setCsdStatus(null);
      return;
    }
    try {
      const { email1, email2 } = await getCompanyPriceEmails(companyId);
      setCompanyEmail1(email1);
      setCompanyEmail2(email2);
      
      // Cargar datos fiscales y CSD
      const compData = await api.get(`/companies/${companyId}`);
      const c = compData.data;
      setFiscal({
        RFC: c.RFC || '',
        LegalName: c.LegalName || '',
        FiscalRegime: c.FiscalRegime || '',
        TaxZipCode: c.TaxZipCode || '',
        Email: c.Email || ''
      });
      setCsdStatus(c.CsdCargado ? 'cargado' : 'pendiente');
    } catch (err) {
      console.error('Error cargando datos de empresa', err);
      notify('Error cargando datos de la empresa', 'error');
    }
  };

  useEffect(() => {
    if (selectedCompany) {
      handleCompanyChange(selectedCompany);
    }
  }, [selectedCompany]);

  const handleSubmitCompany = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setSaving(true);
    try {
      await updateCompanyPriceEmails(selectedCompany, companyEmail1, companyEmail2);
      notify('Correos de aprobación por empresa actualizados', 'success');
      await handleCompanyChange(selectedCompany);
    } catch (err) {
      console.error('Error guardando correos de empresa', err);
      notify(err.response?.data?.msg || 'Error al guardar correos de empresa', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Guardar datos fiscales
  const handleSaveFiscal = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setSavingFiscal(true);
    try {
      await api.put(`/companies/${selectedCompany}/fiscal`, fiscal);
      notify('Datos fiscales actualizados', 'success');
      // Recargar lista
      const compRes = await api.get('/companies');
      setCompanies(compRes.data || []);
    } catch (err) {
      notify(err.response?.data?.msg || 'Error guardando datos fiscales', 'error');
    } finally {
      setSavingFiscal(false);
    }
  };

  // Subir CSD
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
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

      await api.post(`/companies/${selectedCompany}/csd`, {
        cerBase64,
        keyBase64,
        passwordCsd: csdPassword
      });

      notify('CSD subido exitosamente a Facturama', 'success');
      setCsdStatus('cargado');
      setCsdPassword('');
      if (cerInputRef.current) cerInputRef.current.value = '';
      if (keyInputRef.current) keyInputRef.current.value = '';
      
      // Recargar
      const compRes = await api.get('/companies');
      setCompanies(compRes.data || []);
    } catch (err) {
      console.error('Error subiendo CSD', err);
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
      const compRes = await api.get('/companies');
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
    { code: '625', name: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
    { code: '626', name: 'Régimen Simplificado de Confianza' }
  ];

  const selectedCompanyData = companies.find(c => String(c.Company_Id) === String(selectedCompany));

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuración</h2>
          <p className="text-sm text-gray-600">Ajustes del sistema y datos fiscales de empresas</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-900">Cargando configuración...</p>
      ) : (
        <div className="max-w-4xl">
          {/* Selector de empresa */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Empresa</label>
            {(!isAdmin && allowedCompanyIds.length === 0) ? (
              <p className="text-sm text-red-500">No tienes empresas asignadas.</p>
            ) : (
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="mt-2 flex gap-2 text-xs">
                <span className={`px-2 py-1 rounded ${selectedCompanyData.CsdCargado ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  CSD: {selectedCompanyData.CsdCargado ? '✅ Cargado' : '⚠️ Pendiente'}
                </span>
                {selectedCompanyData.RFC && (
                  <span className="px-2 py-1 rounded bg-blue-100 text-blue-800">RFC: {selectedCompanyData.RFC}</span>
                )}
              </div>
            )}
          </div>

          {selectedCompany && (
            <>
              {/* Tabs */}
              <div className="flex border-b border-gray-200 mb-4">
                {[
                  { key: 'fiscal', label: '📋 Datos Fiscales' },
                  { key: 'csd', label: '🔐 Certificado (CSD)' },
                  { key: 'emails', label: '✉️ Correos Aprobación' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === tab.key
                        ? 'border-[#092052] text-[#092052]'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab: Datos Fiscales */}
              {activeTab === 'fiscal' && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Datos Fiscales - {selectedCompanyData?.NameCompany}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Estos datos se usan como Emisor en los CFDI generados por esta empresa.
                  </p>
                  <form onSubmit={handleSaveFiscal} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
                      <input
                        type="text"
                        value={fiscal.RFC}
                        onChange={(e) => setFiscal({ ...fiscal, RFC: e.target.value.toUpperCase() })}
                        maxLength={13}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="XAXX010101000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
                      <input
                        type="text"
                        value={fiscal.LegalName}
                        onChange={(e) => setFiscal({ ...fiscal, LegalName: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Régimen Fiscal</label>
                      <select
                        value={fiscal.FiscalRegime}
                        onChange={(e) => setFiscal({ ...fiscal, FiscalRegime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Seleccionar --</option>
                        {regimenes.map(r => (
                          <option key={r.code} value={r.code}>{r.code} - {r.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal (Expedición)</label>
                      <input
                        type="text"
                        value={fiscal.TaxZipCode}
                        onChange={(e) => setFiscal({ ...fiscal, TaxZipCode: e.target.value })}
                        maxLength={5}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="64000"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email (para CFDI)</label>
                      <input
                        type="email"
                        value={fiscal.Email}
                        onChange={(e) => setFiscal({ ...fiscal, Email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="facturacion@empresa.com"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        disabled={savingFiscal}
                        className="px-4 py-2 bg-[#092052] text-white rounded hover:bg-[#0d3a7a] disabled:bg-gray-400"
                      >
                        {savingFiscal ? 'Guardando...' : 'Guardar Datos Fiscales'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Tab: CSD */}
              {activeTab === 'csd' && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Certificado de Sello Digital (CSD) - {selectedCompanyData?.NameCompany}
                  </h3>
                  
                  <div className={`p-4 rounded-lg mb-4 ${
                    csdStatus === 'cargado' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                    <p className={`text-sm font-medium ${csdStatus === 'cargado' ? 'text-green-800' : 'text-yellow-800'}`}>
                      {csdStatus === 'cargado' 
                        ? '✅ CSD cargado en Facturama. Esta empresa puede timbrar CFDI.'
                        : '⚠️ CSD no cargado. Sube el certificado para poder timbrar.'}
                    </p>
                  </div>

                  <p className="text-sm text-gray-500 mb-4">
                    Sube los archivos <strong>.cer</strong> y <strong>.key</strong> del CSD de esta empresa.
                    Se enviarán a Facturama para habilitar el timbrado multiemisor.
                    <br/>
                    <span className="text-xs text-gray-400">RFC actual: {fiscal.RFC || 'No configurado'}</span>
                  </p>

                  {!fiscal.RFC && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded mb-4">
                      <p className="text-sm text-red-700">⚠️ Primero configura el RFC en la pestaña "Datos Fiscales"</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Archivo .cer</label>
                      <input
                        ref={cerInputRef}
                        type="file"
                        accept=".cer"
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Archivo .key</label>
                      <input
                        ref={keyInputRef}
                        type="file"
                        accept=".key"
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña del CSD</label>
                      <input
                        type="password"
                        value={csdPassword}
                        onChange={(e) => setCsdPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Contraseña de la llave privada"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSubirCSD}
                        disabled={uploadingCsd || !fiscal.RFC}
                        className="px-4 py-2 bg-[#092052] text-white rounded hover:bg-[#0d3a7a] disabled:bg-gray-400"
                      >
                        {uploadingCsd ? 'Subiendo...' : '🔐 Subir CSD a Facturama'}
                      </button>
                      {csdStatus === 'cargado' && (
                        <button
                          onClick={handleEliminarCSD}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          🗑️ Eliminar CSD
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Correos */}
              {activeTab === 'emails' && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Correos de Aprobación - {selectedCompanyData?.NameCompany}
                  </h3>
                  <form onSubmit={handleSubmitCompany} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Correo aprobador 1</label>
                      <input
                        type="email"
                        value={companyEmail1}
                        onChange={(e) => setCompanyEmail1(e.target.value)}
                        placeholder="ejemplo1@empresa.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Correo aprobador 2</label>
                      <input
                        type="email"
                        value={companyEmail2}
                        onChange={(e) => setCompanyEmail2(e.target.value)}
                        placeholder="ejemplo2@empresa.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-[#092052] text-white rounded hover:bg-[#0d3a7a] disabled:bg-gray-400"
                    >
                      {saving ? 'Guardando...' : 'Guardar correos por empresa'}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* Sección global */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Aprobación de Cambios de Precio (global)
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correo electrónico para aprobación
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  Los códigos de aprobación para cambios de precio se enviarán a este correo si
                  no hay direcciones configuradas para la empresa seleccionada.
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="ejemplo@empresa.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#092052] text-white rounded hover:bg-[#0d3a7a] disabled:bg-gray-400"
              >
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </form>
          </div>

          {/* Resumen multiemisor */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">🏢 Estado Multiemisor</h3>
            <p className="text-sm text-blue-700 mb-4">
              Cada empresa necesita su CSD cargado para poder timbrar CFDI. Todas utilizan la misma cuenta de Facturama.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {companies.map(c => (
                <div key={c.Company_Id} className={`p-3 rounded-lg border ${
                  c.CsdCargado ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <p className="font-medium text-sm">{c.NameCompany}</p>
                  <p className="text-xs text-gray-600">{c.RFC || 'Sin RFC'}</p>
                  <p className={`text-xs mt-1 font-semibold ${c.CsdCargado ? 'text-green-700' : 'text-yellow-700'}`}>
                    {c.CsdCargado ? '✅ Listo para timbrar' : '⚠️ CSD pendiente'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
