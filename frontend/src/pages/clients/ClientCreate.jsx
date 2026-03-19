import React, { useEffect, useState, useRef } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';
import { isValidPhoneNumber } from 'libphonenumber-js';

const mapStatusToDb = (v) => {
  if (!v) return null;
  const m = String(v).toLowerCase();
  if (m === 'active' || m === 'activo' || m === 'activa') return 'ACTIVO';
  if (m === 'inactive' || m === 'inactivo') return 'INACTIVO';
  if (m === 'blocked' || m === 'bloqueado') return 'BLOQUEADO';
  return v;
};

export default function ClientCreate({ editMode = false, initialData = null, onCreated, onSaved, onCancel } = {}) {
  const [form, setForm] = useState({
    LegalName: '',
    CommercialName: '',
    RFC: '',
    TaxRegime: '',
    ClientType: '',
    Status: 'ACTIVO',
    Company_Ids: []
  });
  const [addresses, setAddresses] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [addingAddress, setAddingAddress] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [showAddresses, setShowAddresses] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [expandedAddresses, setExpandedAddresses] = useState({});
  const [expandedContacts, setExpandedContacts] = useState({});
  const addressCounterRef = useRef(0);
  const contactCounterRef = useRef(0);
  const [allowedStatus, setAllowedStatus] = useState(['ACTIVO','INACTIVO','BLOQUEADO']);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const addingAddressRef = useRef(false);
  const addingContactRef = useRef(false);
  const [uploadingConstancia, setUploadingConstancia] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const fetchMeta = async () => {
      try {
        const res = await api.get('/clients/meta');
        if (mounted && res.data && Array.isArray(res.data.allowed) && res.data.allowed.length > 0) setAllowedStatus(res.data.allowed);
      } catch (err) {
        console.warn('Could not load clients meta', err);
      }
    };
    const fetchCompanies = async () => {
      try {
        const res = await api.get('/companies');
        if (mounted) setCompanies(res.data || []);
      } catch (err) {
        console.error('Error cargando empresas', err);
      }
    };
    fetchMeta();
    fetchCompanies();
    return () => { mounted = false };
  }, []);

  useEffect(() => {
    if (editMode && initialData) {
      // Si initialData tiene la estructura { client, addresses, contacts, companies }
      const clientData = initialData.client || initialData;
      const addressesData = initialData.addresses || [];
      const contactsData = initialData.contacts || [];
      const companiesData = initialData.companies || [];
      
      // Extraer los Company_Ids de los datos retornados
      const companyIds = companiesData.length > 0 
        ? companiesData.map(c => c.Company_Id) 
        : (clientData.Company_Ids && Array.isArray(clientData.Company_Ids) ? clientData.Company_Ids : (clientData.Company_Id ? [clientData.Company_Id] : []));
      
      setForm(prev => ({
        ...prev,
        LegalName: clientData.LegalName || '',
        CommercialName: clientData.CommercialName || '',
        RFC: clientData.RFC || '',
        TaxRegime: clientData.TaxRegime || '',
        ClientType: clientData.ClientType || '',
        Status: clientData.Status || 'ACTIVO',
        Company_Ids: companyIds
      }));
      
      if (Array.isArray(addressesData) && addressesData.length > 0) {
        setAddresses(addressesData.map(a => ({ ...a, _uid: a.Address_Id ? `id-${a.Address_Id}` : `tmp-${Date.now()}-${Math.random()}` })));
        setShowAddresses(true);
      }
      
      if (Array.isArray(contactsData) && contactsData.length > 0) {
        setContacts(contactsData.map(c => ({ ...c, _uid: c.Contact_Id ? `id-${c.Contact_Id}` : `tmp-${Date.now()}-${Math.random()}` })));
        setShowContacts(true);
      }
    }
  }, [editMode, initialData]);

  const validateField = (name, value) => {
    let msg = '';
    switch (name) {
      case 'LegalName':
        if (!value || String(value).trim().length < 1) msg = 'Razón social es requerida';
        break;
      case 'RFC':
        if (value && String(value).trim().length < 3) msg = 'RFC inválido';
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [name]: msg }));
    return msg === '';
  };

  const validateAll = () => {
    const newErrors = {};
    if (!form.LegalName || form.LegalName.trim().length < 1) newErrors.LegalName = 'Razón social es requerida';
    if (form.RFC && form.RFC.trim().length < 3) newErrors.RFC = 'RFC inválido';
    setErrors(newErrors);
    return { valid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'Company_Ids') {
      const companyId = parseInt(value, 10);
      setForm(prev => ({
        ...prev,
        Company_Ids: checked
          ? [...prev.Company_Ids, companyId]
          : prev.Company_Ids.filter(id => id !== companyId)
      }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
      validateField(name, value);
    }
  };

  const isFormValid = () => {
    if (!form.LegalName || form.LegalName.trim().length < 1) return false;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const validation = validateAll();
      if (!validation.valid) { setError('Corrige los errores del formulario'); setLoading(false); return; }

      const payload = {
        LegalName: form.LegalName,
        CommercialName: form.CommercialName,
        RFC: form.RFC,
        TaxRegime: form.TaxRegime,
        ClientType: form.ClientType,
        Status: mapStatusToDb(form.Status),
        Company_Ids: form.Company_Ids && form.Company_Ids.length > 0 ? form.Company_Ids : [],
        Addresses: addresses.map(a => ({ AddressType: a.AddressType, Street: a.Street, City: a.City, State: a.State, PostalCode: a.PostalCode, Country: a.Country, IsPrimary: !!a.IsPrimary })),
        Contacts: contacts.map(c => ({ FullName: c.FullName, PhoneNumber: c.PhoneNumber, MobileNumber: c.MobileNumber, Email: c.Email, SecondaryEmail: c.SecondaryEmail, IsPrimary: !!c.IsPrimary }))
      };

      if (editMode && initialData) {
        const clientId = initialData.client?.Client_Id || initialData.Client_Id;
        if (!clientId) throw new Error('No se encontró el ID del cliente');
        const res = await api.put(`/clients/${clientId}`, payload);
        setMessage(res.data?.msg || 'Cliente actualizado');
        notify('Cliente guardado correctamente', 'success');
        if (typeof onSaved === 'function') { try { onSaved(res.data); } catch (e) { console.warn('onSaved callback error', e); } }
        setTimeout(() => { if (typeof onCancel === 'function') onCancel(); }, 1500);
      } else {
        const res = await api.post('/clients', payload);
        setMessage(res.data?.msg || 'Cliente creado');
        setForm({ LegalName: '', CommercialName: '', RFC: '', TaxRegime: '', ClientType: '', Status: 'ACTIVO', Company_Ids: [] });
        notify('Nuevo cliente creado exitosamente', 'success');
        if (typeof onCreated === 'function') { try { onCreated(res.data); } catch (e) { console.warn('onCreated callback error', e); } }
        setTimeout(() => { if (typeof onCancel === 'function') onCancel(); }, 1500);
      }
    } catch (err) {
      console.error('Save client error', err);
      setError(err.response?.data?.msg || 'Error guardando cliente');
    } finally {
      setLoading(false);
    }
  };

  const addAddress = () => {
    if (addingAddressRef.current || addresses.length >= 3) return;
    addingAddressRef.current = true;
    setAddingAddress(true);
    addressCounterRef.current += 1;
    const uid = `addr-${addressCounterRef.current}-${Date.now()}`;
    const newAddr = { _uid: uid, AddressType: '', Street: '', City: '', State: '', PostalCode: '', Country: '', IsPrimary: false };
    setAddresses(prev => {
      const exists = prev.some(a => a._uid === uid);
      if (exists) return prev;
      return [...prev, newAddr];
    });
    setShowAddresses(true);
    setTimeout(() => {
      setAddingAddress(false);
      addingAddressRef.current = false;
    }, 1000);
  };
  const updateAddress = (uid, field, value) => setAddresses(prev => prev.map(a => a._uid === uid ? ({ ...a, [field]: value }) : a));
  const removeAddressAt = (uid) => setAddresses(prev => prev.filter(a => a._uid !== uid));

  const addContact = () => {
    if (addingContactRef.current || contacts.length >= 2) return;
    addingContactRef.current = true;
    setAddingContact(true);
    contactCounterRef.current += 1;
    const uid = `contact-${contactCounterRef.current}-${Date.now()}`;
    const newC = { _uid: uid, FullName: '', PhoneNumber: '', MobileNumber: '', Email: '', SecondaryEmail: '', IsPrimary: false };
    setContacts(prev => {
      const exists = prev.some(c => c._uid === uid);
      if (exists) return prev;
      return [...prev, newC];
    });
    setShowContacts(true);
    setTimeout(() => {
      setAddingContact(false);
      addingContactRef.current = false;
    }, 1000);
  };
  const updateContact = (uid, field, value) => setContacts(prev => prev.map(c => c._uid === uid ? ({ ...c, [field]: value }) : c));
  const removeContactAt = (uid) => setContacts(prev => prev.filter(c => c._uid !== uid));

  const handleConstanciaUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isXML = file.name.toLowerCase().endsWith('.xml');
    const isPDF = file.name.toLowerCase().endsWith('.pdf');
    
    if (!isXML && !isPDF) {
      notify('Por favor selecciona un archivo XML o PDF', 'error');
      return;
    }

    setUploadingConstancia(true);
    try {
      const formData = new FormData();
      formData.append('constancia', file);

      const res = await api.post('/constancia/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success && res.data.data) {
        const { RFC, LegalName, CommercialName, TaxRegime, Address } = res.data.data;
        
        setForm(prev => ({
          ...prev,
          RFC: RFC || prev.RFC,
          LegalName: LegalName || prev.LegalName,
          CommercialName: CommercialName || prev.CommercialName,
          TaxRegime: TaxRegime || prev.TaxRegime
        }));

        if (Address && (Address.Street || Address.City)) {
          addressCounterRef.current += 1;
          const uid = `addr-${addressCounterRef.current}-${Date.now()}`;
          setAddresses(prev => [{
            _uid: uid,
            AddressType: 'Fiscal',
            Street: Address.Street || '',
            City: Address.City || '',
            State: Address.State || '',
            PostalCode: Address.PostalCode || '',
            Country: Address.Country || 'México',
            IsPrimary: true
          }, ...prev]);
          setShowAddresses(true);
        }

        notify('Constancia cargada correctamente', 'success');
      }
    } catch (err) {
      console.error('Error cargando constancia:', err);
      const errorMsg = err.response?.data?.msg || err.response?.data?.error || err.message || 'Error procesando constancia';
      notify(errorMsg, 'error');
      console.error('Detalles del error:', err.response?.data);
    } finally {
      setUploadingConstancia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-h-[95vh] bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
      <div className="bg-[#092052] px-6 py-4 flex-shrink-0">
        <h2 className="text-xl font-bold text-white">{editMode ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <form id="clientForm" onSubmit={handleSubmit} noValidate className="p-6 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Columna izquierda */}
            <div className="space-y-4">
              {/* Info básica */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-900">Información General</h3>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xml,.pdf"
                      onChange={handleConstanciaUpload}
                      className="hidden"
                      id="constanciaInput"
                    />
                    <label
                      htmlFor="constanciaInput"
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                        uploadingConstancia
                          ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {uploadingConstancia ? '⏳ Cargando...' : '📄 Cargar Constancia'}
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Razón Social * {editMode && form.LegalName && <span className="ml-1 text-green-600">✓</span>}
                  </label>
                  <input name="LegalName" value={form.LegalName} onChange={handleChange} className={`w-full h-9 px-3 text-sm rounded-lg border-2 ${editMode && form.LegalName ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'} text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]`} />
                  {errors.LegalName && <p className="mt-1 text-xs text-red-600">{errors.LegalName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nombre Comercial {editMode && form.CommercialName && <span className="ml-1 text-green-600">✓</span>}
                  </label>
                  <input name="CommercialName" value={form.CommercialName} onChange={handleChange} className={`w-full h-9 px-3 text-sm rounded-lg border-2 ${editMode && form.CommercialName ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'} text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    RFC {editMode && form.RFC && <span className="ml-1 text-green-600">✓</span>}
                  </label>
                  <input name="RFC" value={form.RFC} onChange={handleChange} className={`w-full h-9 px-3 text-sm rounded-lg border-2 ${editMode && form.RFC ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'} text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052] uppercase`} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Estado</label>
                    <select name="Status" value={form.Status} onChange={handleChange} className="w-full h-9 px-3 text-sm rounded-lg border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]">
                      {allowedStatus.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Empresas</label>
                    <div className="bg-white border-2 border-gray-300 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                      {companies.length > 0 ? (
                        companies.map(c => (
                          <label key={c.Company_Id} className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              name="Company_Ids"
                              value={c.Company_Id}
                              checked={form.Company_Ids.includes(c.Company_Id)}
                              onChange={handleChange}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-[#092052]"
                            />
                            <span className="ml-2 text-sm text-gray-700">{c.NameCompany}</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500">Cargando empresas...</p>
                      )}
                    </div>
                    {form.Company_Ids.length > 0 && (
                      <p className="text-xs text-green-600 mt-1">✓ {form.Company_Ids.length} empresa(s) seleccionada(s)</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Régimen Fiscal {editMode && form.TaxRegime && <span className="ml-1 text-green-600">✓</span>}
                    </label>
                    <input name="TaxRegime" value={form.TaxRegime} onChange={handleChange} className={`w-full h-9 px-3 text-sm rounded-lg border-2 ${editMode && form.TaxRegime ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'} text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]`} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Tipo {editMode && form.ClientType && <span className="ml-1 text-green-600">✓</span>}
                    </label>
                    <input name="ClientType" value={form.ClientType} onChange={handleChange} className={`w-full h-9 px-3 text-sm rounded-lg border-2 ${editMode && form.ClientType ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'} text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Columna derecha */}
            <div className="space-y-4">
              {/* Direcciones */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <button type="button" onClick={() => setShowAddresses(!showAddresses)} className="w-full flex items-center justify-between px-4 py-2 bg-gray-100 hover:bg-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">Direcciones</span>
                    <span className="px-2 py-0.5 bg-indigo-500 text-white text-xs font-bold rounded-full">{addresses.length}</span>
                  </div>
                  <svg className={`w-4 h-4 transition-transform text-gray-700 ${showAddresses ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showAddresses && (
                  <div className="p-4 space-y-3">
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); if (!addingAddress && addresses.length < 3) addAddress(); }} disabled={addingAddress || addresses.length >= 3} className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:pointer-events-none">
                      + Agregar {addresses.length >= 3 ? '(Máx. 3)' : `(${addresses.length}/3)`}
                    </button>
                    {addresses.map((a, idx) => {
                      const isExpanded = expandedAddresses[a._uid] !== false;
                      const addressSummary = a.AddressType || 'Dirección';
                      const hasFilled = a.Street && a.City && a.State;
                      return (
                        <div key={a._uid} className={`rounded-lg overflow-hidden border ${editMode && a.Address_Id ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                          <button
                            type="button"
                            onClick={() => setExpandedAddresses(prev => ({ ...prev, [a._uid]: !isExpanded }))}
                            className={`w-full flex items-center justify-between px-3 py-2 ${hasFilled ? 'bg-green-100 hover:bg-green-200' : 'bg-gray-100 hover:bg-gray-200'}`}
                          >
                            <div className="flex items-center gap-2 text-left">
                              <span className="text-xs font-bold text-gray-700">#{idx + 1} - {addressSummary}</span>
                              {hasFilled && <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>}
                            </div>
                            <svg className={`w-4 h-4 transition-transform text-gray-700 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isExpanded && (
                            <div className="p-3 space-y-2 border-t border-gray-200">
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  {editMode && a.Address_Id && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Existente</span>}
                                </div>
                                <button type="button" onClick={() => removeAddressAt(a._uid)} className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded">Eliminar</button>
                              </div>
                              <input value={a.AddressType || ''} onChange={(e) => updateAddress(a._uid, 'AddressType', e.target.value)} placeholder="Tipo (Fiscal, Entrega...)" className="w-full h-8 px-2 text-xs rounded border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                              <input value={a.Street || ''} onChange={(e) => updateAddress(a._uid, 'Street', e.target.value)} placeholder="Calle *" className="w-full h-8 px-2 text-xs rounded border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                              <div className="grid grid-cols-2 gap-2">
                                <input value={a.City || ''} onChange={(e) => updateAddress(a._uid, 'City', e.target.value)} placeholder="Ciudad" className="w-full h-8 px-2 text-xs rounded border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                                <input value={a.State || ''} onChange={(e) => updateAddress(a._uid, 'State', e.target.value)} placeholder="Estado" className="w-full h-8 px-2 text-xs rounded border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input value={a.PostalCode || ''} onChange={(e) => updateAddress(a._uid, 'PostalCode', e.target.value)} placeholder="C.P." className="w-full h-8 px-2 text-xs rounded border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                                <input value={a.Country || ''} onChange={(e) => updateAddress(a._uid, 'Country', e.target.value)} placeholder="País" className="w-full h-8 px-2 text-xs rounded border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                              </div>
                              <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input type="checkbox" checked={!!a.IsPrimary} onChange={(e) => updateAddress(a._uid, 'IsPrimary', e.target.checked)} className="w-4 h-4" />
                                <span className="text-gray-700">Principal</span>
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Contactos */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <button type="button" onClick={() => setShowContacts(!showContacts)} className="w-full flex items-center justify-between px-4 py-2 bg-gray-100 hover:bg-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">Contactos</span>
                    <span className="px-2 py-0.5 bg-purple-500 text-white text-xs font-bold rounded-full">{contacts.length}</span>
                  </div>
                  <svg className={`w-4 h-4 transition-transform text-gray-700 ${showContacts ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showContacts && (
                  <div className="p-4 space-y-3">
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); if (!addingContact && contacts.length < 2) addContact(); }} disabled={addingContact || contacts.length >= 2} className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:pointer-events-none">
                      + Agregar {contacts.length >= 2 ? '(Máx. 2)' : `(${contacts.length}/2)`}
                    </button>
                    {contacts.map((c, idx) => {
                      const isExpanded = expandedContacts[c._uid] !== false;
                      const contactSummary = c.FullName || 'Contacto';
                      const hasFilled = c.FullName && (c.PhoneNumber || c.MobileNumber || c.Email);
                      return (
                        <div key={c._uid} className={`rounded-lg overflow-hidden border ${editMode && c.Contact_Id ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                          <button
                            type="button"
                            onClick={() => setExpandedContacts(prev => ({ ...prev, [c._uid]: !isExpanded }))}
                            className={`w-full flex items-center justify-between px-3 py-2 ${hasFilled ? 'bg-purple-100 hover:bg-purple-200' : 'bg-gray-100 hover:bg-gray-200'}`}
                          >
                            <div className="flex items-center gap-2 text-left">
                              <span className="text-xs font-bold text-gray-700">#{idx + 1} - {contactSummary}</span>
                              {hasFilled && <span className="inline-block w-2 h-2 bg-purple-500 rounded-full"></span>}
                            </div>
                            <svg className={`w-4 h-4 transition-transform text-gray-700 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isExpanded && (
                            <div className="p-3 space-y-2 border-t border-gray-200">
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  {editMode && c.Contact_Id && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Existente</span>}
                                </div>
                                <button type="button" onClick={() => removeContactAt(c._uid)} className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded">Eliminar</button>
                              </div>
                              <input value={c.FullName || ''} onChange={(e) => updateContact(c._uid, 'FullName', e.target.value)} placeholder="Nombre completo" className="w-full h-8 px-2 text-xs rounded border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                              <div className="grid grid-cols-2 gap-2">
                                <input value={c.PhoneNumber || ''} onChange={(e) => updateContact(c._uid, 'PhoneNumber', e.target.value)} placeholder="Teléfono" className="w-full h-8 px-2 text-xs rounded border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                                <input value={c.MobileNumber || ''} onChange={(e) => updateContact(c._uid, 'MobileNumber', e.target.value)} placeholder="Móvil" className="w-full h-8 px-2 text-xs rounded border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                              </div>
                              <input type="email" value={c.Email || ''} onChange={(e) => updateContact(c._uid, 'Email', e.target.value)} placeholder="Email principal" className="w-full h-8 px-2 text-xs rounded border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                              <input type="email" value={c.SecondaryEmail || ''} onChange={(e) => updateContact(c._uid, 'SecondaryEmail', e.target.value)} placeholder="Email secundario" className="w-full h-8 px-2 text-xs rounded border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                              <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input type="checkbox" checked={!!c.IsPrimary} onChange={(e) => updateContact(c._uid, 'IsPrimary', e.target.checked)} className="w-4 h-4" />
                                <span className="text-gray-700">Principal</span>
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botón submit */}
          {message && <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{message}</div>}
          {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
        </form>
      </div>

      {/* Footer con botón fijo */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4 flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 h-10 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-lg transition-all">
          Cancelar
        </button>
        <button 
          form="clientForm"
          type="submit" 
          disabled={loading || !isFormValid()} 
          className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? (editMode ? 'Guardando...' : 'Creando...') : (editMode ? 'Guardar' : 'Crear Cliente')}
        </button>
      </div>
    </div>
  );
}
