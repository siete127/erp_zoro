import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';
import ClientCreate from './ClientCreate';
import ClientRecurringProducts from '../../components/ClientRecurringProducts';
import ClienteDocumentos from '../../components/clients/ClienteDocumentos';

const premiumField = 'w-full rounded-2xl border border-[#d7e0ee] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.98))] px-4 py-3 text-sm text-slate-800 shadow-[0_8px_20px_rgba(15,45,93,0.05)] outline-none transition placeholder:text-slate-400 focus:border-[#17346f] focus:ring-4 focus:ring-[#17346f]/10';

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  );
}

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
        const c = await api.get('/companies/');
        setCompanies(c.data || []);
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
      await api.patch(`/clients/${c.Client_Id}/active`, {
        IsActive: c.Status && c.Status.toUpperCase() === 'ACTIVO' ? 0 : 1,
      });
      await fetchClients();
    } catch (err) {
      console.error('Error toggling client active', err);
      notify('Error cambiando estado del cliente', 'error');
    }
  };

  const removeClient = async (c) => {
    const ok = await confirm(
      `Eliminar permanentemente al cliente ${c.LegalName || c.CommercialName || c.Client_Id}? Esta accion no se puede deshacer.`,
      'Eliminar cliente', 'Eliminar', 'Cancelar'
    );
    if (!ok) return;
    try {
      await api.delete(`/clients/${c.Client_Id}`);
      await fetchClients();
    } catch (err) {
      console.error('Error eliminando cliente', err);
      notify('Error eliminando cliente', 'error');
    }
  };

  const filtered = clients.filter((c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (c.LegalName || '').toLowerCase().includes(q) ||
      (c.CommercialName || '').toLowerCase().includes(q) ||
      (c.RFC || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full min-h-screen overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_30%),linear-gradient(180deg,#edf2f8_0%,#e7edf5_48%,#edf2f7_100%)] p-4 md:p-6">

      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6b7a96]">Directorio</p>
          <h2 className="text-3xl font-semibold tracking-tight text-[#1d2430]">Clientes</h2>
          <p className="text-sm text-slate-500">Gestiona clientes, contactos, documentos y portal de acceso.</p>
        </div>
        <button
          onClick={() => setCreateMode(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#17408b] to-[#2e67d1] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(23,64,139,0.18)] transition hover:from-[#12356e] hover:to-[#2559ba]"
        >
          + Nuevo cliente
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-[26px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,249,253,0.92))] p-4 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
        <div className="flex flex-wrap items-center gap-3">
          {(userRole === 1 || userRole === 2) && (
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="rounded-2xl border border-[#d5ddeb] bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#17408b] focus:ring-2 focus:ring-[#17408b]/10"
            >
              <option value="all">Todas las empresas</option>
              {companies.map((c) => (
                <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>
              ))}
            </select>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, razon social o RFC"
            className="min-w-[220px] flex-1 rounded-2xl border border-[#d5ddeb] bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#17408b] focus:ring-2 focus:ring-[#17408b]/10"
          />
          <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm">
            {filtered.length} / {clients.length}
          </span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-[26px] border border-white/80 bg-white/90 p-6 text-sm text-slate-500 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
          Cargando clientes...
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
          <div className="overflow-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead className="bg-slate-50/90 text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Nombre / Razon social</th>
                  <th className="px-5 py-4 font-semibold">RFC</th>
                  <th className="px-5 py-4 font-semibold">Tipo</th>
                  <th className="px-5 py-4 font-semibold">Estado</th>
                  <th className="px-5 py-4 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isActive = c.Status && c.Status.toUpperCase() === 'ACTIVO';
                  return (
                    <tr key={c.Client_Id} className="border-t border-slate-100 transition hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{c.LegalName || c.CommercialName || c.Name || '—'}</p>
                        {c.CommercialName && c.LegalName && c.CommercialName !== c.LegalName && (
                          <p className="text-xs text-slate-500">{c.CommercialName}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-700">{c.RFC || c.DocumentNumber || '—'}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          {c.ClientType || 'CLIENTE'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => setRecurringProductsClient(c.Client_Id)}
                            className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-100"
                          >
                            Productos
                          </button>
                          <button
                            onClick={() => viewDetails(c)}
                            className="rounded-xl border border-[#d7e0ee] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Detalles
                          </button>
                          <button
                            onClick={() => startEdit(c)}
                            className="rounded-xl border border-[#d7e0ee] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => toggleActive(c)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${isActive ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                          >
                            {isActive ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            onClick={() => removeClient(c)}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="px-5 py-8 text-sm text-slate-400">No hay clientes que coincidan con el filtro.</p>
          )}
        </div>
      )}

      {/* Modal detalles */}
      {viewingDetails && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(3,10,28,0.6)] p-3 backdrop-blur-sm md:p-6"
          onClick={() => setViewingDetails(null)}
        >
          <div
            className="flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-white/30 bg-[linear-gradient(180deg,rgba(247,250,253,0.99),rgba(236,242,248,0.99))] shadow-[0_40px_100px_rgba(2,10,28,0.32)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 rounded-t-[32px] bg-[linear-gradient(135deg,#0f2556,#1c3f87_58%,#285fb3)] p-5 text-white shadow-[0_8px_24px_rgba(9,32,82,0.22)] md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-100/75">Ficha de cliente</p>
                  <h2 className="text-xl font-semibold text-white md:text-2xl">
                    {viewingDetails.client?.LegalName || viewingDetails.client?.CommercialName || 'Cliente'}
                  </h2>
                  {viewingDetails.client?.CommercialName && viewingDetails.client?.LegalName !== viewingDetails.client?.CommercialName && (
                    <p className="text-sm text-blue-100/75">{viewingDetails.client.CommercialName}</p>
                  )}
                </div>
                <button
                  onClick={() => setViewingDetails(null)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Cerrar"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 md:p-5">
              {/* Info general */}
              <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.98))] p-5 shadow-[0_12px_28px_rgba(15,45,93,0.07)]">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Informacion general</p>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <DetailRow label="Razon social" value={viewingDetails.client?.LegalName} />
                  <DetailRow label="Nombre comercial" value={viewingDetails.client?.CommercialName} />
                  <DetailRow label="RFC" value={viewingDetails.client?.RFC} />
                  <DetailRow label="Regimen fiscal" value={viewingDetails.client?.TaxRegime} />
                  <DetailRow label="Tipo" value={viewingDetails.client?.ClientType} />
                  <DetailRow label="Estado" value={viewingDetails.client?.Status} />
                  {viewingDetails.companies?.length > 0 && (
                    <div className="col-span-2 flex flex-col gap-0.5 md:col-span-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Empresas asignadas</p>
                      <p className="text-sm font-medium text-slate-800">{viewingDetails.companies.map((c) => c.NameCompany).join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Direcciones */}
              {viewingDetails.addresses?.length > 0 && (
                <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.98))] p-5 shadow-[0_12px_28px_rgba(15,45,93,0.07)]">
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Direcciones ({viewingDetails.addresses.length})</p>
                  <div className="space-y-3">
                    {viewingDetails.addresses.map((addr, idx) => (
                      <div key={idx} className="rounded-[18px] border border-[#e3eaf5] bg-white/90 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500">#{idx + 1}</span>
                          {addr.IsPrimary && (
                            <span className="rounded-full bg-[#0f2556] px-2.5 py-0.5 text-[10px] font-bold text-white">Principal</span>
                          )}
                          {addr.AddressType && (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{addr.AddressType}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          <DetailRow label="Calle" value={addr.Street} />
                          <DetailRow label="Ciudad" value={addr.City} />
                          <DetailRow label="Estado" value={addr.State} />
                          <DetailRow label="C.P." value={addr.PostalCode} />
                          <DetailRow label="Pais" value={addr.Country} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contactos */}
              {viewingDetails.contacts?.length > 0 && (
                <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.98))] p-5 shadow-[0_12px_28px_rgba(15,45,93,0.07)]">
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Contactos ({viewingDetails.contacts.length})</p>
                  <div className="space-y-3">
                    {viewingDetails.contacts.map((contact, idx) => (
                      <div key={idx} className="rounded-[18px] border border-[#e3eaf5] bg-white/90 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500">#{idx + 1}</span>
                          {contact.IsPrimary && (
                            <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-bold text-white">Principal</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          <DetailRow label="Nombre" value={contact.FullName} />
                          <DetailRow label="Telefono" value={contact.PhoneNumber} />
                          <DetailRow label="Movil" value={contact.MobileNumber} />
                          <DetailRow label="Email" value={contact.Email} />
                          {contact.SecondaryEmail && <DetailRow label="Email 2" value={contact.SecondaryEmail} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documentos */}
              <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.98))] p-5 shadow-[0_12px_28px_rgba(15,45,93,0.07)]">
                <ClienteDocumentos clienteId={viewingDetails.client?.Client_Id} />
              </div>

              {/* Portal */}
              {viewingDetails.client?.ClientType !== 'PROVEEDOR' && (
                <div className="rounded-[24px] border border-blue-200/70 bg-[linear-gradient(180deg,rgba(235,242,255,0.9),rgba(225,236,255,0.85))] p-5 shadow-[0_12px_28px_rgba(15,45,93,0.07)]">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#17408b]">Portal de cliente</p>
                  <p className="mb-3 text-xs text-blue-700">El cliente puede ver sus cotizaciones y facturas en linea con este enlace.</p>
                  {viewingDetails.client?.TokenPortal ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="max-w-xs truncate rounded-xl border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-blue-800">
                        {`${window.location.origin}/portal/${viewingDetails.client.TokenPortal}`}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/portal/${viewingDetails.client.TokenPortal}`);
                          notify('Enlace copiado al portapapeles', 'success');
                        }}
                        className="rounded-xl bg-[#17408b] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#12356e]"
                      >
                        Copiar enlace
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await api.post(`/portal/generar-token/${viewingDetails.client.Client_Id}`);
                            setViewingDetails((prev) => ({ ...prev, client: { ...prev.client, TokenPortal: res.data.TokenPortal } }));
                            notify('Token regenerado', 'success');
                          } catch {
                            notify('Error regenerando token', 'error');
                          }
                        }}
                        className="rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                      >
                        Regenerar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        try {
                          const res = await api.post(`/portal/generar-token/${viewingDetails.client.Client_Id}`);
                          setViewingDetails((prev) => ({ ...prev, client: { ...prev.client, TokenPortal: res.data.TokenPortal } }));
                          notify('Token de portal generado', 'success');
                        } catch {
                          notify('Error generando token', 'error');
                        }
                      }}
                      className="rounded-xl bg-[#17408b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12356e]"
                    >
                      Generar enlace de portal
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {createMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,10,28,0.6)] p-3 backdrop-blur-sm md:p-6">
          <div className="w-full max-w-6xl max-h-[95vh]">
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
