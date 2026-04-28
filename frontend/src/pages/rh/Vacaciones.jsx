import React, { useEffect, useState } from 'react';
import { vacacionesService } from '../../services/vacacionesService';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';
import api from '../../services/api';
import VacacionesCalendar from './VacacionesCalendar';
import BalanceWidget from './BalanceWidget';
import LeaveTypeSelector from './LeaveTypeSelector';
import PayrollSyncPanel from './PayrollSyncPanel';
import VacacionesReports from './VacacionesReports';
import './vacaciones.css';

const VacacionesTab = ({ currentUser, userCompanies }) => {
  const isAdmin = currentUser?.isAdmin || currentUser?.is_admin || currentUser?.RolId === 2;
  const [activeSection, setActiveSection] = useState('lista'); // 'lista', 'nueva', 'calendario', 'saldo', 'nomina', 'reportes'
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    estatus: '',
    user_id: '',
  });

  const [formData, setFormData] = useState({
    FechaInicio: '',
    FechaFin: '',
    Cantidad: 0,
    Razon: '',
    Observaciones: '',
    LeaveTypeId: null,
  });

  const [editingId, setEditingId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [approveData, setApproveData] = useState({
    Estatus: 'Aprobado',
    Observaciones: '',
  });

  // Cargar solicitudes
  const loadSolicitudes = async () => {
    setLoading(true);
    try {
      const filterObj = {
        estatus: filters.estatus,
      };
      if (filters.user_id) {
        filterObj.user_id = filters.user_id;
      }
      const data = await vacacionesService.list(filterObj);
      setSolicitudes(data);
    } catch (error) {
      notify.error('Error al cargar solicitudes');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSolicitudes();
  }, []);

  // Cambiar filtro
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Aplicar filtros
  const handleApplyFilters = () => {
    loadSolicitudes();
  };

  // Cambio de input en formulario
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Calcular días entre fechas
  const calcularDias = () => {
    if (formData.FechaInicio && formData.FechaFin) {
      const inicio = new Date(formData.FechaInicio);
      const fin = new Date(formData.FechaFin);
      const diff = fin - inicio;
      const dias = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir ambos días
      setFormData(prev => ({ ...prev, Cantidad: Math.max(0, dias) }));
    }
  };

  // Crear nueva solicitud
  const handleSubmitForm = async (e) => {
    e.preventDefault();

    if (!formData.FechaInicio || !formData.FechaFin || !formData.Cantidad) {
      notify.error('Por favor completa los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        // Actualizar
        await vacacionesService.update(editingId, formData);
        notify.success('Solicitud actualizada correctamente');
        setEditingId(null);
      } else {
        // Crear nueva
        await vacacionesService.create(formData);
        notify.success('Solicitud de vacaciones creada correctamente');
      }

      // Limpiar formulario
      setFormData({
        FechaInicio: '',
        FechaFin: '',
        Cantidad: 0,
        Razon: '',
        Observaciones: '',
      });
      setActiveSection('lista');
      loadSolicitudes();
    } catch (error) {
      notify.error(error.response?.data?.detail || 'Error al guardar solicitud');
    } finally {
      setLoading(false);
    }
  };

  // Editar solicitud
  const handleEdit = async (solicitud) => {
    if (solicitud.Estatus !== 'Pendiente') {
      notify.error('Solo se pueden editar solicitudes pendientes');
      return;
    }
    setFormData({
      FechaInicio: solicitud.FechaInicio.split('T')[0],
      FechaFin: solicitud.FechaFin.split('T')[0],
      Cantidad: solicitud.Cantidad,
      Razon: solicitud.Razon || '',
      Observaciones: solicitud.Observaciones || '',
    });
    setEditingId(solicitud.Vacaciones_Id);
    setActiveSection('nueva');
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
      FechaInicio: '',
      FechaFin: '',
      Cantidad: 0,
      Razon: '',
      Observaciones: '',
    });
  };

  // Aprobar solicitud — con mapeo automático a nómina si se aprueba
  const handleApprove = async () => {
    if (!approveData.Estatus) {
      notify.error('Selecciona una acción (Aprobar/Rechazar)');
      return;
    }

    try {
      await vacacionesService.approve(
        approvingId,
        approveData.Estatus,
        approveData.Observaciones
      );
      notify.success(`Solicitud ${approveData.Estatus.toLowerCase()}`);

      // Crear mapeo de nómina automáticamente cuando se aprueba
      if (approveData.Estatus === 'Aprobado') {
        try {
          await api.post(`/rh/payroll/create-mapping?vacaciones_id=${approvingId}`);
          notify.success('Mapeo de nómina creado automáticamente');
        } catch (mapErr) {
          // No bloquear si falla el mapeo — la aprobación ya se procesó
          console.warn('No se pudo crear mapeo de nómina:', mapErr?.response?.data?.detail);
        }
      }

      // Cancelar mapeo si se rechaza
      if (approveData.Estatus === 'Rechazado') {
        try {
          await api.post(`/rh/payroll/cancel-mapping/${approvingId}`);
        } catch {
          // Silencioso — puede no existir mapeo previo
        }
      }

      setApprovingId(null);
      setApproveData({ Estatus: 'Aprobado', Observaciones: '' });
      loadSolicitudes();
    } catch (error) {
      notify.error(error.response?.data?.detail || 'Error al procesar solicitud');
    }
  };

  // Eliminar solicitud
  const handleDelete = async (id) => {
    if (await confirm('¿Eliminar esta solicitud?')) {
      try {
        await vacacionesService.delete(id);
        notify.success('Solicitud eliminada');
        loadSolicitudes();
      } catch (error) {
        notify.error(error.response?.data?.detail || 'Error al eliminar');
      }
    }
  };

  // Renderizar estado con color
  const getStatusColor = (estatus) => {
    switch (estatus) {
      case 'Aprobado':
        return '#10b981'; // green
      case 'Rechazado':
        return '#ef4444'; // red
      case 'Pendiente':
        return '#f59e0b'; // amber
      default:
        return '#6b7280'; // gray
    }
  };

  return (
    <div className="vacaciones-container">
      {/* Tabs */}
      <div className="vacaciones-tabs">
        <button
          className={`tab-btn ${activeSection === 'lista' ? 'active' : ''}`}
          onClick={() => setActiveSection('lista')}
        >
          📋 Mis Solicitudes
        </button>
        <button
          className={`tab-btn ${activeSection === 'calendario' ? 'active' : ''}`}
          onClick={() => setActiveSection('calendario')}
        >
          📅 Calendario
        </button>
        <button
          className={`tab-btn ${activeSection === 'saldo' ? 'active' : ''}`}
          onClick={() => setActiveSection('saldo')}
        >
          ⚖️ Saldo
        </button>
        <button
          className={`tab-btn ${activeSection === 'nueva' ? 'active' : ''}`}
          onClick={() => {
            setActiveSection('nueva');
            handleCancelEdit();
          }}
        >
          ➕ Nueva Solicitud
        </button>
        {isAdmin && (
          <button
            className={`tab-btn ${activeSection === 'nomina' ? 'active' : ''}`}
            onClick={() => setActiveSection('nomina')}
          >
            💰 Sync Nómina
          </button>
        )}
        {isAdmin && (
          <button
            className={`tab-btn ${activeSection === 'reportes' ? 'active' : ''}`}
            onClick={() => setActiveSection('reportes')}
          >
            📊 Reportes
          </button>
        )}
      </div>

      {/* Sección: Lista de solicitudes */}
      {activeSection === 'lista' && (
        <div className="vacaciones-section">
          <h3>📋 Mis Solicitudes de Vacaciones</h3>

          {/* Filtros */}
          <div className="vacaciones-filters">
            <select
              name="estatus"
              value={filters.estatus}
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Aprobado">Aprobado</option>
              <option value="Rechazado">Rechazado</option>
            </select>
            <button onClick={handleApplyFilters} className="btn-filter">
              🔍 Filtrar
            </button>
          </div>

          {/* Tabla de solicitudes */}
          {loading ? (
            <p className="loading">Cargando...</p>
          ) : solicitudes.length === 0 ? (
            <p className="empty">No hay solicitudes de vacaciones</p>
          ) : (
            <div className="table-responsive">
              <table className="vacaciones-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Días</th>
                    <th>Razón</th>
                    <th>Estado</th>
                    <th>Solicitado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitudes.map(sol => (
                    <tr key={sol.Vacaciones_Id}>
                      <td>
                        <small>
                          {new Date(sol.FechaInicio).toLocaleDateString()} →{' '}
                          {new Date(sol.FechaFin).toLocaleDateString()}
                        </small>
                      </td>
                      <td className="text-center">{sol.Cantidad}</td>
                      <td>{sol.Razon || '—'}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(sol.Estatus) }}
                        >
                          {sol.Estatus}
                        </span>
                      </td>
                      <td>
                        <small>
                          {new Date(sol.CreatedAt).toLocaleDateString()}
                        </small>
                      </td>
                      <td className="actions">
                        {sol.Estatus === 'Pendiente' && (
                          <>
                            <button
                              className="btn-sm btn-edit"
                              onClick={() => handleEdit(sol)}
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              className="btn-sm btn-delete"
                              onClick={() => handleDelete(sol.Vacaciones_Id)}
                              title="Eliminar"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                        <button
                          className="btn-sm btn-info"
                          onClick={() => {
                            alert(
                              `Solicitud de ${sol.Cantidad} días\n` +
                              `Período: ${new Date(sol.FechaInicio).toLocaleDateString()} a ${new Date(sol.FechaFin).toLocaleDateString()}\n` +
                              `Estado: ${sol.Estatus}\n` +
                              `Observaciones: ${sol.Observaciones || 'Sin observaciones'}`
                            );
                          }}
                          title="Ver detalles"
                        >
                          ℹ️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sección: Nueva solicitud */}
      {activeSection === 'nueva' && (
        <div className="vacaciones-section">
          <h3>{editingId ? '✏️ Editar Solicitud' : '➕ Nueva Solicitud de Vacaciones'}</h3>

          <form onSubmit={handleSubmitForm} className="vacaciones-form">
            <div className="form-group">
              <label>Tipo de Licencia <span className="required">*</span></label>
              <LeaveTypeSelector 
                companyId={currentUser?.company_id || userCompanies?.[0]?.Company_Id}
                value={formData.LeaveTypeId}
                onChange={(typeId, typeData) => {
                  setFormData(prev => ({ 
                    ...prev, 
                    LeaveTypeId: typeId 
                  }));
                }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="FechaInicio">
                Fecha Inicio <span className="required">*</span>
              </label>
              <input
                type="date"
                id="FechaInicio"
                name="FechaInicio"
                value={formData.FechaInicio}
                onChange={handleFormChange}
                onBlur={calcularDias}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="FechaFin">
                Fecha Fin <span className="required">*</span>
              </label>
              <input
                type="date"
                id="FechaFin"
                name="FechaFin"
                value={formData.FechaFin}
                onChange={handleFormChange}
                onBlur={calcularDias}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="Cantidad">
                Días a Solicitar <span className="required">*</span>
              </label>
              <input
                type="number"
                id="Cantidad"
                name="Cantidad"
                value={formData.Cantidad}
                onChange={handleFormChange}
                min="1"
                required
              />
              <small>Se calcula automáticamente según las fechas</small>
            </div>

            <div className="form-group">
              <label htmlFor="Razon">Razón del Descanso</label>
              <input
                type="text"
                id="Razon"
                name="Razon"
                value={formData.Razon}
                onChange={handleFormChange}
                placeholder="Ej: Descanso personal, vacaciones familiares..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="Observaciones">Observaciones Adicionales</label>
              <textarea
                id="Observaciones"
                name="Observaciones"
                value={formData.Observaciones}
                onChange={handleFormChange}
                rows="4"
                placeholder="Información adicional que consideres relevante..."
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '⏳ Guardando...' : '✅ Enviar Solicitud'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelEdit}
              >
                ❌ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de aprobación */}
      {approvingId && (
        <div className="modal-overlay" onClick={() => setApprovingId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h4>Procesar Solicitud de Vacaciones</h4>

            <div className="form-group">
              <label>Acción</label>
              <select
                value={approveData.Estatus}
                onChange={e => setApproveData(prev => ({ ...prev, Estatus: e.target.value }))}
                className="full-width"
              >
                <option value="Aprobado">✅ Aprobar</option>
                <option value="Rechazado">❌ Rechazar</option>
              </select>
            </div>

            <div className="form-group">
              <label>Observaciones</label>
              <textarea
                value={approveData.Observaciones}
                onChange={e => setApproveData(prev => ({ ...prev, Observaciones: e.target.value }))}
                rows="3"
                placeholder="Escribe tus observaciones aquí..."
              />
            </div>

            <div className="modal-actions">
              <button onClick={handleApprove} className="btn btn-success">
                Confirmar
              </button>
              <button
                onClick={() => setApprovingId(null)}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sección: Calendario */}
      {activeSection === 'calendario' && (
        <div className="vacaciones-section">
          <h3>📅 Calendario de Vacaciones</h3>
          <VacacionesCalendar 
            currentUser={currentUser}
            onCreateClick={() => setActiveSection('nueva')}
          />
        </div>
      )}

      {/* Sección: Saldo */}
      {activeSection === 'saldo' && (
        <div className="vacaciones-section">
          <h3>⚖️ Mi Saldo de Vacaciones</h3>
          <BalanceWidget
            userId={currentUser?.user_id || currentUser?.User_Id}
            year={new Date().getFullYear()}
          />
        </div>
      )}

      {/* Sección: Sync Nómina (solo admins) */}
      {activeSection === 'nomina' && isAdmin && (
        <div className="vacaciones-section">
          <PayrollSyncPanel />
        </div>
      )}

      {/* Sección: Reportes analytics (solo admins) */}
      {activeSection === 'reportes' && isAdmin && (
        <div className="vacaciones-section">
          <VacacionesReports currentUser={currentUser} />
        </div>
      )}
    </div>
  );
};

export default VacacionesTab;
