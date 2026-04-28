import api from './api';

export const vacacionesService = {
  /**
   * Listar solicitudes de vacaciones
   */
  list: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.company_id) params.append('company_id', filters.company_id);
    if (filters.user_id) params.append('user_id', filters.user_id);
    if (filters.estatus) params.append('estatus', filters.estatus);

    const response = await api.get(`/rh/vacaciones?${params.toString()}`);
    return response.data;
  },

  /**
   * Obtener detalles de una solicitud
   */
  get: async (vacacionesId) => {
    const response = await api.get(`/rh/vacaciones/${vacacionesId}`);
    return response.data;
  },

  /**
   * Crear nueva solicitud de vacaciones
   */
  create: async (data) => {
    const response = await api.post('/rh/vacaciones', {
      FechaInicio: data.FechaInicio,
      FechaFin: data.FechaFin,
      Cantidad: data.Cantidad,
      Razon: data.Razon || '',
      Observaciones: data.Observaciones || '',
    });
    return response.data;
  },

  /**
   * Actualizar solicitud de vacaciones
   */
  update: async (vacacionesId, data) => {
    const response = await api.put(`/rh/vacaciones/${vacacionesId}`, {
      FechaInicio: data.FechaInicio || undefined,
      FechaFin: data.FechaFin || undefined,
      Cantidad: data.Cantidad || undefined,
      Razon: data.Razon || undefined,
      Observaciones: data.Observaciones || undefined,
    });
    return response.data;
  },

  /**
   * Aprobar o rechazar solicitud
   */
  approve: async (vacacionesId, estatus, observaciones = '') => {
    const response = await api.post(
      `/rh/vacaciones/${vacacionesId}/aprobar`,
      {
        Estatus: estatus, // "Aprobado" o "Rechazado"
        Observaciones: observaciones,
      }
    );
    return response.data;
  },

  /**
   * Eliminar solicitud
   */
  delete: async (vacacionesId) => {
    const response = await api.delete(`/rh/vacaciones/${vacacionesId}`);
    return response.data;
  },
};
