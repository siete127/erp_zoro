import React, { useEffect, useState, useCallback } from 'react';
import leaveService from '../../services/leaveService';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';
import VacacionesCalendar from './VacacionesCalendar';
import BalanceWidget from './BalanceWidget';
import LeaveTypeSelector from './LeaveTypeSelector';
import PayrollSyncPanel from './PayrollSyncPanel';
import VacacionesReports from './VacacionesReports';
import './vacaciones.css';

const TODAY = new Date().toISOString().split('T')[0];
const CURRENT_YEAR = new Date().getFullYear();

const EMPTY_FORM = {
  start_date: '',
  end_date: '',
  razon: '',
  leave_type_id: null,
};

const STATUS_COLOR = {
  Aprobado: '#10b981',
  Rechazado: '#ef4444',
  Pendiente: '#f59e0b',
  Cancelado: '#6b7280',
};

const VacacionesTab = ({ currentUser, userCompanies }) => {
  const isAdmin = currentUser?.is_admin || currentUser?.isAdmin || currentUser?.RolId <= 2;
  const userId = currentUser?.User_Id || currentUser?.user_id;
  const companyId = currentUser?.companies?.[0] || userCompanies?.[0]?.Company_Id;

  const [activeSection, setActiveSection] = useState('lista');
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [filters, setFilters] = useState({ estatus: '', user_id: '', year: CURRENT_YEAR });
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [diasCalculados, setDiasCalculados] = useState(null);

  const [approvingId, setApprovingId] = useState(null);
  const [approveData, setApproveData] = useState({ estatus: 'Aprobado', observaciones: '' });

  // ── Cargar solicitudes ──────────────────────────────────────────────────────

  const loadSolicitudes = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        estatus: filters.estatus || undefined,
        year: filters.year || undefined,
      };
      if (isAdmin && filters.user_id) params.user_id = filters.user_id;

      const data = await leaveService.listRequests(params);
      setSolicitudes(Array.isArray(data) ? data : []);
    } catch (err) {
      notify.error(err?.response?.data?.detail || 'Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  }, [filters, isAdmin]);

  useEffect(() => {
    loadSolicitudes();
  }, []);

  // ── Calcular días hábiles en tiempo real ────────────────────────────────────

  useEffect(() => {
    if (!form.start_date || !form.end_date || !companyId) {
      setDiasCalculados(null);
      return;
    }
    if (form.end_date < form.start_date) {
      setDiasCalculados(null);
      return;
    }
    leaveService.calculateWorkingDays(form.start_date, form.end_date, companyId)
      .then(r => setDiasCalculados(r?.working_days ?? null))
      .catch(() => setDiasCalculados(null));
  }, [form.start_date, form.end_date, companyId]);

  // ── Crear solicitud ─────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!form.leave_type_id) {
      setFormError('Selecciona un tipo de licencia');
      return;
    }
    if (!form.start_date || !form.end_date) {
      setFormError('Las fechas son obligatorias');
      return;
    }
    if (form.end_date < form.start_date) {
      setFormError('La fecha de fin no puede ser anterior a la de inicio');
      return;
    }
    if (form.start_date < TODAY) {
      setFormError('No se pueden solicitar vacaciones con fecha en el pasado');
      return;
    }

    setSubmitting(true);
    try {
      await leaveService.createRequest({
        user_id: userId,
        leave_type_id: form.leave_type_id,
        start_date: form.start_date,
        end_date: form.end_date,
        razon: form.razon || null,
      });
      notify.success('Solicitud enviada correctamente');
      setForm(EMPTY_FORM);
      setDiasCalculados(null);
      setActiveSection('lista');
      loadSolicitudes();
    } catch (err) {
      const detail = err?.response?.data?.detail || '';
      setFormError(detail || 'Error al crear la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cancelar solicitud ──────────────────────────────────────────────────────

  const handleCancel = async (id, estatus) => {
    if (!await confirm(`¿Cancelar esta solicitud${estatus === 'Aprobado' ? ' (ya estaba aprobada)' : ''}?`)) return;
    try {
      await leaveService.cancelRequest(id);
      notify.success('Solicitud cancelada');
      loadSolicitudes();
    } catch (err) {
      notify.error(err?.response?.data?.detail || 'Error al cancelar');
    }
  };

  // ── Aprobar / Rechazar ──────────────────────────────────────────────────────

  const handleApprove = async () => {
    try {
      await leaveService.approveRequest(approvingId, {
        estatus: approveData.estatus,
        observaciones: approveData.observaciones || null,
      });
      notify.success(`Solicitud ${approveData.estatus.toLowerCase()}`);
      setApprovingId(null);
      setApproveData({ estatus: 'Aprobado', observaciones: '' });
      loadSolicitudes();
    } catch (err) {
      notify.error(err?.response?.data?.detail || 'Error al procesar');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="vacaciones-container">
      {/* Tabs */}
      <div className="vacaciones-tabs">
        {[
          { key: 'lista', label: '📋 Solicitudes' },
          { key: 'nueva', label: '➕ Nueva Solicitud' },
          { key: 'calendario', label: '📅 Calendario' },
          { key: 'saldo', label: '⚖️ Saldo' },
          ...(isAdmin ? [{ key: 'nomina', label: '💰 Sync Nómina' }, { key: 'reportes', label: '📊 Reportes' }] : []),
        ].map(t => (
          <button
            key={t.key}
            className={`tab-btn ${activeSection === t.key ? 'active' : ''}`}
            onClick={() => { setActiveSection(t.key); setFormError(null); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LISTA ── */}
      {activeSection === 'lista' && (
        <div className="vacaciones-section">
          <h3>📋 Solicitudes de Vacaciones</h3>

          <div className="vacaciones-filters">
            <select
              value={filters.estatus}
              onChange={e => setFilters(f => ({ ...f, estatus: e.target.value }))}
              className="filter-select"
            >
              <option value="">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Aprobado">Aprobado</option>
              <option value="Rechazado">Rechazado</option>
              <option value="Cancelado">Cancelado</option>
            </select>

            <select
              value={filters.year}
              onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}
              className="filter-select"
            >
              {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {isAdmin && (
              <input
                type="number"
                placeholder="ID usuario (admin)"
                className="filter-select"
                style={{ width: 160 }}
                value={filters.user_id}
                onChange={e => setFilters(f => ({ ...f, user_id: e.target.value }))}
                min="1"
              />
            )}

            <button onClick={loadSolicitudes} className="btn-filter">🔍 Filtrar</button>
          </div>

          {loading ? (
            <p className="loading">Cargando...</p>
          ) : solicitudes.length === 0 ? (
            <p className="empty">No hay solicitudes para los filtros seleccionados</p>
          ) : (
            <div className="table-responsive">
              <table className="vacaciones-table">
                <thead>
                  <tr>
                    {isAdmin && <th>Empleado</th>}
                    <th>Tipo</th>
                    <th>Período</th>
                    <th>Días</th>
                    <th>Razón</th>
                    <th>Estado</th>
                    <th>Fecha solicitud</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitudes.map(sol => (
                    <tr key={sol.Vacaciones_Id || sol.id}>
                      {isAdmin && (
                        <td>
                          <small>{sol.NombreEmpleado || sol.user_name || `#${sol.User_Id || sol.user_id}`}</small>
                        </td>
                      )}
                      <td>
                        <small>{sol.LeaveTypeName || sol.leave_type_name || '—'}</small>
                      </td>
                      <td>
                        <small>
                          {new Date(sol.FechaInicio || sol.start_date).toLocaleDateString()} →{' '}
                          {new Date(sol.FechaFin || sol.end_date).toLocaleDateString()}
                        </small>
                      </td>
                      <td className="text-center">
                        {sol.Cantidad || sol.days_count || '—'}
                      </td>
                      <td>{sol.Razon || sol.razon || '—'}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ backgroundColor: STATUS_COLOR[sol.Estatus || sol.status] || '#6b7280' }}
                        >
                          {sol.Estatus || sol.status}
                        </span>
                      </td>
                      <td>
                        <small>
                          {new Date(sol.CreatedAt || sol.created_at).toLocaleDateString()}
                        </small>
                      </td>
                      <td className="actions">
                        {isAdmin && (sol.Estatus || sol.status) === 'Pendiente' && (
                          <button
                            className="btn-sm btn-edit"
                            title="Aprobar / Rechazar"
                            onClick={() => setApprovingId(sol.Vacaciones_Id || sol.id)}
                          >
                            ✅
                          </button>
                        )}
                        {['Pendiente', 'Aprobado'].includes(sol.Estatus || sol.status) && (
                          <button
                            className="btn-sm btn-delete"
                            title="Cancelar solicitud"
                            onClick={() => handleCancel(
                              sol.Vacaciones_Id || sol.id,
                              sol.Estatus || sol.status
                            )}
                          >
                            🚫
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── NUEVA SOLICITUD ── */}
      {activeSection === 'nueva' && (
        <div className="vacaciones-section">
          <h3>➕ Nueva Solicitud de Vacaciones</h3>

          {formError && (
            <div className="form-error-banner">
              ⚠️ {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="vacaciones-form">
            <div className="form-group">
              <label>Tipo de Licencia <span className="required">*</span></label>
              <LeaveTypeSelector
                companyId={companyId}
                value={form.leave_type_id}
                onChange={(typeId) => setForm(f => ({ ...f, leave_type_id: typeId }))}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="start_date">Fecha Inicio <span className="required">*</span></label>
                <input
                  type="date"
                  id="start_date"
                  value={form.start_date}
                  min={TODAY}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="end_date">Fecha Fin <span className="required">*</span></label>
                <input
                  type="date"
                  id="end_date"
                  value={form.end_date}
                  min={form.start_date || TODAY}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  required
                />
              </div>
            </div>

            {diasCalculados !== null && (
              <div className="dias-calculados">
                📅 <strong>{diasCalculados} días hábiles</strong> en el período seleccionado
              </div>
            )}

            <div className="form-group">
              <label htmlFor="razon">Razón (opcional)</label>
              <input
                type="text"
                id="razon"
                value={form.razon}
                onChange={e => setForm(f => ({ ...f, razon: e.target.value }))}
                placeholder="Ej: Vacaciones familiares, descanso personal..."
                maxLength={500}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? '⏳ Enviando...' : '✅ Enviar Solicitud'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setForm(EMPTY_FORM); setFormError(null); setDiasCalculados(null); }}
              >
                Limpiar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CALENDARIO ── */}
      {activeSection === 'calendario' && (
        <div className="vacaciones-section">
          <h3>📅 Calendario de Vacaciones</h3>
          <VacacionesCalendar
            currentUser={currentUser}
            onCreateClick={() => setActiveSection('nueva')}
          />
        </div>
      )}

      {/* ── SALDO ── */}
      {activeSection === 'saldo' && (
        <div className="vacaciones-section">
          <h3>⚖️ Mi Saldo de Vacaciones</h3>
          <BalanceWidget userId={userId} year={CURRENT_YEAR} />
        </div>
      )}

      {/* ── NÓMINA (solo admin) ── */}
      {activeSection === 'nomina' && isAdmin && (
        <div className="vacaciones-section">
          <PayrollSyncPanel />
        </div>
      )}

      {/* ── REPORTES (solo admin) ── */}
      {activeSection === 'reportes' && isAdmin && (
        <div className="vacaciones-section">
          <VacacionesReports currentUser={currentUser} />
        </div>
      )}

      {/* ── MODAL APROBAR/RECHAZAR ── */}
      {approvingId && (
        <div className="modal-overlay" onClick={() => setApprovingId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h4>Procesar Solicitud #{approvingId}</h4>

            <div className="form-group">
              <label>Acción</label>
              <select
                value={approveData.estatus}
                onChange={e => setApproveData(p => ({ ...p, estatus: e.target.value }))}
                className="full-width"
              >
                <option value="Aprobado">✅ Aprobar</option>
                <option value="Rechazado">❌ Rechazar</option>
              </select>
            </div>

            <div className="form-group">
              <label>Observaciones</label>
              <textarea
                value={approveData.observaciones}
                onChange={e => setApproveData(p => ({ ...p, observaciones: e.target.value }))}
                rows="3"
                placeholder="Motivo del rechazo u observaciones..."
              />
            </div>

            <div className="modal-actions">
              <button onClick={handleApprove} className="btn btn-success">Confirmar</button>
              <button onClick={() => setApprovingId(null)} className="btn btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VacacionesTab;
