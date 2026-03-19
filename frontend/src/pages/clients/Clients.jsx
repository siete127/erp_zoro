import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';
import ClientCreate from './ClientCreate';
import ClientRecurringProducts from '../../components/ClientRecurringProducts';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewingDetails, setViewingDetails] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [query, setQuery] = useState('');
  const [recurringProductsClient, setRecurringProductsClient] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const url = selectedCompany === 'all' ? '/clients' : `/clients?company_id=${selectedCompany}`;
      const res = await api.get(url);
      const data = res.data?.data || res.data || [];
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando clientes', err);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, [selectedCompany]);
  
  useEffect(() => {
    (async () => {
      try {
        const c = await api.get('/companies');
        setCompanies(c.data || []);
        
        // Obtener rol del usuario
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setUserRole(user.RolId);
      } catch (e) {
        console.warn('Could not load companies', e);
      }
    })();
  }, []);

  const startEdit = async (c) => {
    try {
      const res = await api.get(`/clients/${c.Client_Id}`);
      setEditing(res.data);
      setCreateMode(true);
    } catch (err) {
      console.error('Error cargando datos del cliente', err);
      notify('Error cargando datos del cliente', 'error');
    }
  };

  const viewDetails = async (c) => {
    try {
      const res = await api.get(`/clients/${c.Client_Id}`);
      setViewingDetails(res.data);
    } catch (err) {
      console.error('Error cargando detalles del cliente', err);
      notify('Error cargando detalles del cliente', 'error');
    }
  };

  const toggleActive = async (c) => {
    try {
      await api.patch(`/clients/${c.Client_Id}/active`, { IsActive: (c.Status && c.Status.toUpperCase() === 'ACTIVO') ? 0 : 1 });
      await fetchClients();
    } catch (err) {
      console.error('Error toggling client active', err);
      notify('Error cambiando estado del cliente', 'error');
    }
  };

  const removeClient = async (c) => {
    const ok = await confirm(`Eliminar permanentemente al cliente ${c.LegalName || c.CommercialName || c.Client_Id}? Esta acción no se puede deshacer.`, "Eliminar cliente", "Eliminar", "Cancelar");
    if (!ok) return;
    try {
      await api.delete(`/clients/${c.Client_Id}`);
      await fetchClients();
    } catch (err) {
      console.error('Error eliminando cliente', err);
      notify('Error eliminando cliente', 'error');
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-600">Listado de clientes registrados</p>
        </div>
        <div>
          <button onClick={() => setCreateMode(true)} className="px-3 py-2 bg-green-600 text-white rounded">Nuevo cliente</button>
        </div>
      </div>

      {loading ? <p className="text-gray-900">Cargando clientes...</p> : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            {(userRole === 1 || userRole === 2) && (
              <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="p-2 rounded border bg-white text-gray-900 border-gray-300">
                <option value="all">Todas las empresas</option>
                {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
              </select>
            )}
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o RFC" className="flex-1 max-w-md p-2 rounded border bg-white text-gray-900 border-gray-300 placeholder-gray-500" />
          </div>
          <div className="overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-600">
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">RFC</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.filter(c => {
                if (!query) return true;
                const q = query.toLowerCase();
                return (c.LegalName||'').toLowerCase().includes(q) || (c.CommercialName||'').toLowerCase().includes(q) || (c.RFC||'').toLowerCase().includes(q);
              }).map(c => (
                <tr key={c.Client_Id} className="border-t border-gray-200">
                  <td className="py-3 pr-4 text-gray-900">{c.LegalName || c.CommercialName || c.Name}</td>
                  <td className="py-3 pr-4 text-gray-900">{c.RFC || c.DocumentNumber || '-'}</td>
                  <td className="py-3 pr-4">
                    {c.Status && c.Status.toUpperCase() === 'ACTIVO' ? <span className="inline-block w-3 h-3 bg-green-500 rounded-full" title="Activo"></span> : <span className="inline-block w-3 h-3 bg-red-500 rounded-full" title="Inactivo"></span>}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setRecurringProductsClient(c.Client_Id)} className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded">Productos</button>
                      <button onClick={() => viewDetails(c)} className="px-3 py-1 text-sm bg-[#092052] hover:bg-[#0d3a7a] text-white rounded">Detalles</button>
                      <button onClick={() => startEdit(c)} className="px-3 py-1 text-sm bg-gray-600 text-white rounded">Editar</button>
                      <button onClick={() => toggleActive(c)} className={`px-3 py-1 text-sm rounded ${c.Status && c.Status.toUpperCase() === 'ACTIVO' ? 'bg-yellow-500 text-white' : 'bg-green-600 text-white'}`}>{c.Status && c.Status.toUpperCase() === 'ACTIVO' ? 'Desactivar' : 'Activar'}</button>
                      <button onClick={() => removeClient(c)} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clients.length === 0 && <p className="mt-4 text-sm text-gray-600">No hay clientes registrados.</p>}
        </div>
        </div>
      )}

      {viewingDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-[#092052] px-6 py-4 flex items-center justify-between sticky top-0">
              <h2 className="text-xl font-bold text-white">Detalles del Cliente</h2>
              <button onClick={() => setViewingDetails(null)} className="text-white hover:bg-white/20 rounded-full p-2">
                <span className="text-2xl">×</span>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Información General */}
              <div className="bg-gray-100 rounded-xl p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Información General</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Razón Social</p>
                    <p className="text-sm text-gray-900">{viewingDetails.client?.LegalName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Nombre Comercial</p>
                    <p className="text-sm text-gray-900">{viewingDetails.client?.CommercialName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">RFC</p>
                    <p className="text-sm text-gray-900">{viewingDetails.client?.RFC || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Estado</p>
                    <p className="text-sm text-gray-900">{viewingDetails.client?.Status || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Régimen Fiscal</p>
                    <p className="text-sm text-gray-900">{viewingDetails.client?.TaxRegime || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Tipo</p>
                    <p className="text-sm text-gray-900">{viewingDetails.client?.ClientType || '-'}</p>
                  </div>
                  {viewingDetails.companies && viewingDetails.companies.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-600 font-semibold">Empresas Asignadas</p>
                      <p className="text-sm text-gray-900">{viewingDetails.companies.map(c => c.NameCompany).join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Direcciones */}
              {viewingDetails.addresses && viewingDetails.addresses.length > 0 && (
                <div className="bg-gray-100 rounded-xl p-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Direcciones ({viewingDetails.addresses.length})</h3>
                  <div className="space-y-3">
                    {viewingDetails.addresses.map((addr, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-gray-300">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-gray-700">#{idx + 1}</span>
                          {addr.IsPrimary && <span className="text-xs bg-[#092052] text-white px-2 py-0.5 rounded-full">Principal</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-gray-600">Tipo:</span> <span className="text-gray-900">{addr.AddressType || '-'}</span></div>
                          <div><span className="text-gray-600">Calle:</span> <span className="text-gray-900">{addr.Street || '-'}</span></div>
                          <div><span className="text-gray-600">Ciudad:</span> <span className="text-gray-900">{addr.City || '-'}</span></div>
                          <div><span className="text-gray-600">Estado:</span> <span className="text-gray-900">{addr.State || '-'}</span></div>
                          <div><span className="text-gray-600">C.P.:</span> <span className="text-gray-900">{addr.PostalCode || '-'}</span></div>
                          <div><span className="text-gray-600">País:</span> <span className="text-gray-900">{addr.Country || '-'}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contactos */}
              {viewingDetails.contacts && viewingDetails.contacts.length > 0 && (
                <div className="bg-gray-100 rounded-xl p-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Contactos ({viewingDetails.contacts.length})</h3>
                  <div className="space-y-3">
                    {viewingDetails.contacts.map((contact, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-gray-300">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-gray-700">#{idx + 1}</span>
                          {contact.IsPrimary && <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">Principal</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-gray-600">Nombre:</span> <span className="text-gray-900">{contact.FullName || '-'}</span></div>
                          <div><span className="text-gray-600">Teléfono:</span> <span className="text-gray-900">{contact.PhoneNumber || '-'}</span></div>
                          <div><span className="text-gray-600">Móvil:</span> <span className="text-gray-900">{contact.MobileNumber || '-'}</span></div>
                          <div><span className="text-gray-600">Email:</span> <span className="text-gray-900">{contact.Email || '-'}</span></div>
                          {contact.SecondaryEmail && (
                            <div className="col-span-2"><span className="text-gray-600">Email 2:</span> <span className="text-gray-900">{contact.SecondaryEmail}</span></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {createMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="max-w-6xl w-full max-h-[95vh]">
            <ClientCreate
              editMode={!!editing}
              initialData={editing}
              onCreated={async () => { setCreateMode(false); setEditing(null); await fetchClients(); }}
              onSaved={async () => { setCreateMode(false); setEditing(null); await fetchClients(); }}
              onCancel={() => { setCreateMode(false); setEditing(null); }}
            />
          </div>
        </div>
      )}

      {recurringProductsClient && (
        <ClientRecurringProducts 
          clientId={recurringProductsClient} 
          onClose={() => setRecurringProductsClient(null)} 
        />
      )}
    </div>
  );
}
