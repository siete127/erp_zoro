/**
 * Leave/Vacation API Service
 * Maneja todas las llamadas a los endpoints de licencias y vacaciones
 *
 * Base URL: /rh/leave
 */

import api from './api';

const BASE = '/rh/leave';

// ── Tipos de licencia ────────────────────────────────────────────────────────

export const getLeaveTypes = async (companyId, isActive = true) => {
  const response = await api.get(`${BASE}/types`, {
    params: { company_id: companyId, is_active: isActive }
  });
  return response.data;
};

export const getLeaveType = async (leaveTypeId) => {
  const response = await api.get(`${BASE}/types/${leaveTypeId}`);
  return response.data;
};

export const createLeaveType = async (data) => {
  const response = await api.post(`${BASE}/types`, data);
  return response.data;
};

// ── Saldo de licencias ───────────────────────────────────────────────────────

export const getLeaveBalance = async (year = new Date().getFullYear()) => {
  const response = await api.get(`${BASE}/balance`, { params: { year } });
  return response.data;
};

export const getEmployeeBalance = async (userId, year = new Date().getFullYear()) => {
  const response = await api.get(`${BASE}/balance`, {
    params: { user_id: userId, year }
  });
  return response.data;
};

// ── Festivos / días públicos ─────────────────────────────────────────────────

export const getPublicHolidays = async (companyId, year = new Date().getFullYear()) => {
  const response = await api.get(`${BASE}/public-holidays`, {
    params: { company_id: companyId, year }
  });
  return response.data;
};

export const createPublicHoliday = async (data) => {
  const response = await api.post(`${BASE}/public-holidays`, data);
  return response.data;
};

// ── Utilidades de cálculo ────────────────────────────────────────────────────

export const isWorkingDay = async (date, companyId) => {
  const response = await api.get(`${BASE}/is-working-day`, {
    params: { date, company_id: companyId }
  });
  return response.data;
};

export const calculateWorkingDays = async (startDate, endDate, companyId, includeWeekends = false) => {
  const response = await api.get(`${BASE}/working-days-count`, {
    params: {
      start_date: startDate,
      end_date: endDate,
      company_id: companyId,
      include_weekends: includeWeekends
    }
  });
  return response.data;
};

export const checkBalanceAvailability = async (leaveTypeId, daysRequested, year = new Date().getFullYear()) => {
  const response = await api.get(`${BASE}/balance-check`, {
    params: { leave_type_id: leaveTypeId, days_requested: daysRequested, year }
  });
  return response.data;
};

// ── Vacaciones – solicitudes ─────────────────────────────────────────────────

export const createVacationRequest = async (data) => {
  const response = await api.post('/rh/vacaciones', data);
  return response.data;
};

export const getApprovedVacations = async (companyId, startDate, endDate) => {
  const response = await api.get('/rh/vacaciones', {
    params: { company_id: companyId, start_date: startDate, end_date: endDate, status: 'Aprobado' }
  });
  return response.data;
};

export const getUserVacations = async (userId) => {
  const response = await api.get('/rh/vacaciones', { params: { user_id: userId } });
  return response.data;
};

export const getPendingVacations = async () => {
  const response = await api.get('/rh/vacaciones', { params: { status: 'Pendiente' } });
  return response.data;
};

export const approveVacation = async (vacacionesId) => {
  const response = await api.patch(`/rh/vacaciones/${vacacionesId}`, { status: 'Aprobado' });
  return response.data;
};

export const rejectVacation = async (vacacionesId, reason) => {
  const response = await api.patch(`/rh/vacaciones/${vacacionesId}`, {
    status: 'Rechazado',
    observaciones: reason
  });
  return response.data;
};

// ── Mock data (desarrollo sin backend) ──────────────────────────────────────

export const getMockLeaveTypes = () => [
  { id: 1, name: 'Vacaciones', description: 'Días de vacaciones regulares', color: '#10b981', defaultDays: 15, requires_document: false, isActive: true },
  { id: 2, name: 'Enfermedad', description: 'Licencia por enfermedad', color: '#ef4444', defaultDays: 5, requires_document: true, isActive: true },
  { id: 3, name: 'Licencia Personal', description: 'Licencia personal sin especificar motivo', color: '#f59e0b', defaultDays: 3, requires_document: false, isActive: true },
  { id: 4, name: 'Maternidad/Paternidad', description: 'Licencia por maternidad o paternidad', color: '#8b5cf6', defaultDays: 30, requires_document: true, isActive: true }
];

export const getMockBalance = () => [
  { id: 1, leave_type_id: 1, leave_type_name: 'Vacaciones', available_days: 15, used_days: 3, planned_days: 5, remaining_days: 7, year: 2026, negative_balance_allowed: false },
  { id: 2, leave_type_id: 2, leave_type_name: 'Enfermedad', available_days: 5, used_days: 2, planned_days: 0, remaining_days: 3, year: 2026, negative_balance_allowed: true },
  { id: 3, leave_type_id: 3, leave_type_name: 'Licencia Personal', available_days: 3, used_days: 0, planned_days: 0, remaining_days: 3, year: 2026, negative_balance_allowed: false }
];

export const getMockApprovedVacations = () => [
  { id: 1, user_id: 1, user_name: 'Juan Pérez', leave_type_id: 1, leave_type_name: 'Vacaciones', start_date: '2026-04-28', end_date: '2026-05-02', days: 3, status: 'Aprobado', reason: 'Descanso regular', approved_by: 5, approved_date: '2026-04-25' },
  { id: 2, user_id: 2, user_name: 'María García', leave_type_id: 1, leave_type_name: 'Vacaciones', start_date: '2026-05-10', end_date: '2026-05-15', days: 4, status: 'Aprobado', reason: 'Viaje', approved_by: 5, approved_date: '2026-05-01' }
];

export default {
  getLeaveTypes, getLeaveType, createLeaveType,
  getLeaveBalance, getEmployeeBalance,
  getPublicHolidays, createPublicHoliday,
  isWorkingDay, calculateWorkingDays, checkBalanceAvailability,
  createVacationRequest, getApprovedVacations, getUserVacations,
  getPendingVacations, approveVacation, rejectVacation,
  getMockLeaveTypes, getMockBalance, getMockApprovedVacations
};
