import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaCog, FaExternalLinkAlt, FaPlus, FaTimesCircle, FaTrash } from 'react-icons/fa';
import Modal from '../../components/Modal';
import {
  OperationEmptyState,
  OperationHeader,
  OperationSectionTitle,
  OperationStat,
  operationContainerClass,
  operationDangerButtonClass,
  operationFieldClass,
  operationPageClass,
  operationPrimaryButtonClass,
  operationSecondaryButtonClass,
  operationTableShellClass
} from '../../components/operation/OperationUI';
import api from '../../services/api';
import confirm from '../../services/confirm';
import { notify } from '../../services/notify';

const MODULOS = ['REQUISICION', 'COTIZACION'];

const MODULO_LABELS = {
  REQUISICION: 'Requisicion',
  COTIZACION: 'Cotizacion'
};

const defaultReglaForm = () => ({
  Regla_Id: null,
  Company_Id: '',
  Modulo: 'REQUISICION',
  MontoMinimo: '',
  NivelesReq: 1,
  Aprobador1_Id: '',
  Aprobador2_Id: '',
  Activo: true
});

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString('es-MX') : '-');

function getDocumentoRoute(aprobacion) {
  if (aprobacion.Modulo === 'COTIZACION') return `/cotizaciones/${aprobacion.Documento_Id}`;
  if (aprobacion.Modulo === 'REQUISICION') return `/compras/requisiciones?req_id=${aprobacion.Documento_Id}`;
  return null;
}

function StatusPill({ estatus }) {
  const map = {
    PENDIENTE: 'border-amber-200 bg-amber-50 text-amber-700',
    APROBADO: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    RECHAZADO: 'border-rose-200 bg-rose-50 text-rose-700'
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${map[estatus] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
      {estatus}
    </span>
  );
}

export default function Aprobaciones() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('bandeja');
  const [aprobaciones, setAprobaciones] = useState([]);
  const [reglas, setReglas] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingReglas, setLoadingReglas] = useState(false);
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('PENDIENTE');
  const [filtroEmpresa, setFiltroEmpresa] = useState('all');
  const [reglaEmpresa, setReglaEmpresa] = useState('');
  const [showReglaForm, setShowReglaForm] = useState(false);
  const [reglaForm, setReglaForm] = useState(defaultReglaForm());
  const [savingDecision, setSavingDecision] = useState(null);
  const [savingRegla, setSavingRegla] = useState(false);
  const [comentariosModal, setComentariosModal] = useState(null);
  const [comentarioTexto, setComentarioTexto] = useState('');
  const [decisionPendiente, setDecisionPendiente] = useState(null);

  const fetchBandeja = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroModulo) params.append('Modulo', filtroModulo);
      if (filtroEstatus) params.append('Estatus', filtroEstatus);
      if (filtroEmpresa !== 'all') params.append('Company_Id', filtroEmpresa);
      const res = await api.get(`/aprobaciones/?${params.toString()}`);
      setAprobaciones(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      notify('Error al cargar la bandeja de aprobaciones', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchReglas = async () => {
    if (!reglaEmpresa) return;
    setLoadingReglas(true);
    try {
      const res = await api.get(`/aprobaciones/reglas?company_id=${reglaEmpresa}`);
      setReglas(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      notify('Error al cargar reglas de aprobacion', 'error');
    } finally {
      setLoadingReglas(false);
    }
  };

  const fetchCatalogos = async () => {
    try {
      const [compRes, usrRes] = await Promise.all([api.get('/companies/'), api.get('/users/')]);
      const comps = Array.isArray(compRes.data) ? compRes.data : compRes.data?.data || [];
      setCompanies(comps);
      setUsuarios(Array.isArray(usrRes.data) ? usrRes.data : usrRes.data?.data || []);
      if (comps.length > 0 && !reglaEmpresa) {
        setReglaEmpresa(String(comps[0].Company_Id));
      }
    } catch (error) {
      console.error(error);
      notify('Error al cargar catalogos', 'error');
    }
  };

  useEffect(() => {
    fetchCatalogos();
  }, []);

  useEffect(() => {
    if (tab === 'bandeja') fetchBandeja();
  }, [tab, filtroModulo, filtroEstatus, filtroEmpresa]);

  useEffect(() => {
    if (tab === 'reglas') fetchReglas();
  }, [tab, reglaEmpresa]);

  const pendientes = useMemo(
    () => aprobaciones.filter((item) => item.Estatus === 'PENDIENTE').length,
    [aprobaciones]
  );
  const aprobadas = useMemo(
    () => aprobaciones.filter((item) => item.Estatus === 'APROBADO').length,
    [aprobaciones]
  );
  const rechazadas = useMemo(
    () => aprobaciones.filter((item) => item.Estatus === 'RECHAZADO').length,
    [aprobaciones]
  );

  const handleVerDocumento = (aprobacion) => {
    const route = getDocumentoRoute(aprobacion);
    if (!route) {
      notify('No hay ruta configurada para este modulo', 'error');
      return;
    }
    navigate(route);
  };

  const ejecutarDecision = async (id, aprobado, comentarios) => {
    setSavingDecision(id);
    try {
      await api.post(`/aprobaciones/${id}/decidir`, { aprobado, comentarios });
      notify('Solicitud procesada', 'success');
      fetchBandeja();
    } catch (error) {
      notify(error?.response?.data?.detail || 'Error al procesar la decision', 'error');
    } finally {
      setSavingDecision(null);
    }
  };

  const handleDecidir = async (aprobacion, aprobado) => {
    if (!aprobado) {
      setDecisionPendiente({ aprobacion, aprobado });
      setComentariosModal(aprobacion);
      setComentarioTexto('');
      return;
    }
    const ok = await confirm(`Aprobar la solicitud de ${MODULO_LABELS[aprobacion.Modulo] || aprobacion.Modulo} #${aprobacion.Documento_Id}?`);
    if (!ok) return;
    await ejecutarDecision(aprobacion.Aprobacion_Id, true, null);
  };

  const handleConfirmarRechazo = async () => {
    if (!decisionPendiente) return;
    await ejecutarDecision(decisionPendiente.aprobacion.Aprobacion_Id, false, comentarioTexto || null);
    setComentariosModal(null);
    setDecisionPendiente(null);
  };

  const handleGuardarRegla = async (event) => {
    event.preventDefault();
    setSavingRegla(true);
    try {
      const payload = {
        ...reglaForm,
        Company_Id: Number.parseInt(reglaForm.Company_Id, 10),
        MontoMinimo: reglaForm.MontoMinimo !== '' ? Number.parseFloat(reglaForm.MontoMinimo) : null,
        NivelesReq: Number.parseInt(reglaForm.NivelesReq, 10),
        Aprobador1_Id: reglaForm.Aprobador1_Id ? Number.parseInt(reglaForm.Aprobador1_Id, 10) : null,
        Aprobador2_Id: reglaForm.Aprobador2_Id ? Number.parseInt(reglaForm.Aprobador2_Id, 10) : null
      };
      await api.post('/aprobaciones/reglas', payload);
      notify('Regla guardada', 'success');
      setShowReglaForm(false);
      setReglaForm(defaultReglaForm());
      fetchReglas();
    } catch (error) {
      notify(error?.response?.data?.detail || 'Error al guardar regla', 'error');
    } finally {
      setSavingRegla(false);
    }
  };

  const handleEliminarRegla = async (regla) => {
    const ok = await confirm(`Eliminar la regla de ${MODULO_LABELS[regla.Modulo] || regla.Modulo} para esta empresa?`);
    if (!ok) return;
    try {
      await api.delete(`/aprobaciones/reglas/${regla.Regla_Id}`);
      notify('Regla eliminada', 'success');
      fetchReglas();
    } catch (error) {
      notify(error?.response?.data?.detail || 'Error al eliminar regla', 'error');
    }
  };

  return (
    <div className={operationPageClass}>
      <div className={operationContainerClass}>
        <OperationHeader
          eyebrow="Aprobaciones"
          title="Bandeja y reglas"
          description="Centraliza decisiones pendientes y configura escalamiento por empresa sin dejar la misma pantalla."
          actions={(
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTab('bandeja')}
                className={tab === 'bandeja' ? operationPrimaryButtonClass : operationSecondaryButtonClass}
              >
                Bandeja
              </button>
              <button
                onClick={() => setTab('reglas')}
                className={tab === 'reglas' ? operationPrimaryButtonClass : operationSecondaryButtonClass}
              >
                <FaCog className="text-xs" /> Configurar reglas
              </button>
            </div>
          )}
          stats={[
            <OperationStat key="pendientes" label="Pendientes" value={pendientes} tone="amber" />,
            <OperationStat key="aprobadas" label="Aprobadas" value={aprobadas} tone="emerald" />,
            <OperationStat key="rechazadas" label="Rechazadas" value={rechazadas} tone="rose" />,
            <OperationStat key="empresas" label="Empresas" value={companies.length} tone="slate" />
          ]}
        />

        {tab === 'bandeja' && (
          <>
            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
              <OperationSectionTitle
                eyebrow="Filtro"
                title="Solicitudes activas"
                description="Refina por empresa, modulo o estatus para vaciar la cola de aprobacion mas rapido."
              />
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresa</label>
                  <select value={filtroEmpresa} onChange={(event) => setFiltroEmpresa(event.target.value)} className={operationFieldClass}>
                    <option value="all">Todas las empresas</option>
                    {companies.map((company) => (
                      <option key={company.Company_Id} value={String(company.Company_Id)}>{company.NameCompany}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Modulo</label>
                  <select value={filtroModulo} onChange={(event) => setFiltroModulo(event.target.value)} className={operationFieldClass}>
                    <option value="">Todos los modulos</option>
                    {MODULOS.map((modulo) => (
                      <option key={modulo} value={modulo}>{MODULO_LABELS[modulo]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Estatus</label>
                  <select value={filtroEstatus} onChange={(event) => setFiltroEstatus(event.target.value)} className={operationFieldClass}>
                    <option value="">Todos los estatus</option>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="APROBADO">Aprobado</option>
                    <option value="RECHAZADO">Rechazado</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={operationTableShellClass}>
              <div className="border-b border-[#e7edf6] px-6 py-4">
                <OperationSectionTitle
                  eyebrow="Bandeja"
                  title="Solicitudes por revisar"
                  description="Accede al documento origen, aprueba o rechaza y deja trazabilidad con comentarios."
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86]" />
                </div>
              ) : aprobaciones.length === 0 ? (
                <div className="p-6">
                  <OperationEmptyState
                    title="Sin solicitudes en esta vista"
                    description="Cuando un documento requiera decision aparecera aqui con su empresa, aprobador y acceso directo al origen."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#e7edf6]">
                        {['Modulo', 'Documento', 'Empresa', 'Aprobador', 'Fecha', 'Estatus', 'Acciones'].map((header) => (
                          <th key={header} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {aprobaciones.map((aprobacion) => (
                        <tr key={aprobacion.Aprobacion_Id} className="border-t border-[#eef2f8] transition hover:bg-[#f7faff]">
                          <td className="px-4 py-4 pl-6 text-sm font-semibold text-slate-900">
                            {MODULO_LABELS[aprobacion.Modulo] || aprobacion.Modulo}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">#{aprobacion.Documento_Id}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{aprobacion.NameCompany || aprobacion.Company_Id}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{aprobacion.AprobadorNombre || '-'}</td>
                          <td className="px-4 py-4 text-sm text-slate-500">{fmtDate(aprobacion.FechaSolicitud)}</td>
                          <td className="px-4 py-4 text-sm">
                            <StatusPill estatus={aprobacion.Estatus} />
                            {aprobacion.Comentarios && (
                              <p className="mt-2 max-w-xs text-xs text-slate-500">{aprobacion.Comentarios}</p>
                            )}
                          </td>
                          <td className="px-4 py-4 pr-6">
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => handleVerDocumento(aprobacion)} className={operationSecondaryButtonClass}>
                                <FaExternalLinkAlt className="text-[10px]" /> Ver documento
                              </button>
                              {aprobacion.Estatus === 'PENDIENTE' && (
                                <>
                                  <button
                                    disabled={savingDecision === aprobacion.Aprobacion_Id}
                                    onClick={() => handleDecidir(aprobacion, true)}
                                    className="inline-flex items-center justify-center rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                                  >
                                    <FaCheckCircle className="text-xs" /> Aprobar
                                  </button>
                                  <button
                                    disabled={savingDecision === aprobacion.Aprobacion_Id}
                                    onClick={() => handleDecidir(aprobacion, false)}
                                    className={operationDangerButtonClass}
                                  >
                                    <FaTimesCircle className="text-xs" /> Rechazar
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'reglas' && (
          <>
            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
              <OperationSectionTitle
                eyebrow="Gobernanza"
                title="Reglas por empresa"
                description="Define quien aprueba, desde que monto se dispara el flujo y si hay uno o dos niveles."
                aside={(
                  <button
                    onClick={() => {
                      setReglaForm({ ...defaultReglaForm(), Company_Id: reglaEmpresa });
                      setShowReglaForm(true);
                    }}
                    disabled={!reglaEmpresa}
                    className={operationPrimaryButtonClass}
                  >
                    <FaPlus className="text-xs" /> Nueva regla
                  </button>
                )}
              />

              <div className="max-w-sm">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresa</label>
                <select value={reglaEmpresa} onChange={(event) => setReglaEmpresa(event.target.value)} className={operationFieldClass}>
                  <option value="">Seleccionar empresa...</option>
                  {companies.map((company) => (
                    <option key={company.Company_Id} value={String(company.Company_Id)}>{company.NameCompany}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={operationTableShellClass}>
              <div className="border-b border-[#e7edf6] px-6 py-4">
                <OperationSectionTitle
                  eyebrow="Reglas"
                  title="Matriz de aprobacion"
                  description="Cada fila representa el umbral y la cadena de aprobadores aplicable."
                />
              </div>

              {loadingReglas ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86]" />
                </div>
              ) : !reglaEmpresa || reglas.length === 0 ? (
                <div className="p-6">
                  <OperationEmptyState
                    title={reglaEmpresa ? 'Sin reglas configuradas' : 'Selecciona una empresa'}
                    description={reglaEmpresa ? 'Crea una regla para automatizar el escalamiento de requisiciones o cotizaciones.' : 'Primero elige una empresa para ver o crear su matriz de aprobacion.'}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#e7edf6]">
                        {['Modulo', 'Monto minimo', 'Niveles', 'Aprobador 1', 'Aprobador 2', 'Activo', 'Acciones'].map((header) => (
                          <th key={header} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reglas.map((regla) => (
                        <tr key={regla.Regla_Id} className="border-t border-[#eef2f8] transition hover:bg-[#f7faff]">
                          <td className="px-4 py-4 pl-6 text-sm font-semibold text-slate-900">{MODULO_LABELS[regla.Modulo] || regla.Modulo}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {regla.MontoMinimo != null ? `$${Number(regla.MontoMinimo).toLocaleString('es-MX')}` : 'Siempre'}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">{regla.NivelesReq}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{regla.Aprobador1Nombre || '-'}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{regla.Aprobador2Nombre || '-'}</td>
                          <td className="px-4 py-4 text-sm">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${regla.Activo ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                              {regla.Activo ? 'Si' : 'No'}
                            </span>
                          </td>
                          <td className="px-4 py-4 pr-6">
                            <button onClick={() => handleEliminarRegla(regla)} className={operationDangerButtonClass}>
                              <FaTrash className="text-xs" /> Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        <Modal isOpen={showReglaForm} onClose={() => setShowReglaForm(false)} title="Nueva regla de aprobacion" size="lg">
          <form onSubmit={handleGuardarRegla} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresa</label>
                <select
                  value={reglaForm.Company_Id}
                  onChange={(event) => setReglaForm((prev) => ({ ...prev, Company_Id: event.target.value }))}
                  className={operationFieldClass}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {companies.map((company) => (
                    <option key={company.Company_Id} value={company.Company_Id}>{company.NameCompany}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Modulo</label>
                <select
                  value={reglaForm.Modulo}
                  onChange={(event) => setReglaForm((prev) => ({ ...prev, Modulo: event.target.value }))}
                  className={operationFieldClass}
                >
                  {MODULOS.map((modulo) => (
                    <option key={modulo} value={modulo}>{MODULO_LABELS[modulo]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Monto minimo</label>
                <input
                  type="number"
                  value={reglaForm.MontoMinimo}
                  onChange={(event) => setReglaForm((prev) => ({ ...prev, MontoMinimo: event.target.value }))}
                  className={operationFieldClass}
                  placeholder="Vacio = siempre"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Niveles requeridos</label>
                <select
                  value={reglaForm.NivelesReq}
                  onChange={(event) => setReglaForm((prev) => ({ ...prev, NivelesReq: event.target.value }))}
                  className={operationFieldClass}
                >
                  <option value="1">1 nivel</option>
                  <option value="2">2 niveles</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Aprobador 1</label>
                <select
                  value={reglaForm.Aprobador1_Id}
                  onChange={(event) => setReglaForm((prev) => ({ ...prev, Aprobador1_Id: event.target.value }))}
                  className={operationFieldClass}
                >
                  <option value="">Seleccionar...</option>
                  {usuarios.map((user) => (
                    <option key={user.User_Id} value={user.User_Id}>{user.Name} {user.Lastname}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Aprobador 2</label>
                <select
                  value={reglaForm.Aprobador2_Id}
                  onChange={(event) => setReglaForm((prev) => ({ ...prev, Aprobador2_Id: event.target.value }))}
                  className={operationFieldClass}
                  disabled={Number(reglaForm.NivelesReq) < 2}
                >
                  <option value="">Seleccionar...</option>
                  {usuarios.map((user) => (
                    <option key={user.User_Id} value={user.User_Id}>{user.Name} {user.Lastname}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={reglaForm.Activo}
                onChange={(event) => setReglaForm((prev) => ({ ...prev, Activo: event.target.checked }))}
                className="h-4 w-4 rounded accent-[#1b3d86]"
              />
              Regla activa
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowReglaForm(false)} className={operationSecondaryButtonClass}>Cancelar</button>
              <button type="submit" disabled={savingRegla} className={operationPrimaryButtonClass}>
                {savingRegla ? 'Guardando...' : 'Guardar regla'}
              </button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={Boolean(comentariosModal)} onClose={() => setComentariosModal(null)} title="Motivo del rechazo" size="md">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Agrega un comentario para dejar contexto del rechazo. Esto ayuda a quien genero el documento a corregirlo rapido.
            </p>
            <textarea
              value={comentarioTexto}
              onChange={(event) => setComentarioTexto(event.target.value)}
              rows={4}
              className={`${operationFieldClass} resize-none`}
              placeholder="Ej: falta adjuntar evidencia de costo o monto fuera de politica..."
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setComentariosModal(null)} className={operationSecondaryButtonClass}>Cancelar</button>
              <button type="button" onClick={handleConfirmarRechazo} className={operationDangerButtonClass}>
                <FaTimesCircle className="text-xs" /> Confirmar rechazo
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
