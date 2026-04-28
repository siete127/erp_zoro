import api from './api';

export const crmService = {
  // Etapas del pipeline CRM
  getEtapas: async () => {
    const response = await api.get('/crm/etapas');
    return response.data;
  },

  // Oportunidades
  createOportunidad: async (payload) => {
    const response = await api.post('/crm/oportunidades', payload);
    return response.data;
  },

  getOportunidades: async (filters = {}) => {
    const response = await api.get('/crm/oportunidades', { params: filters });
    return response.data;
  },

  getOportunidad: async (id) => {
    const response = await api.get(`/crm/oportunidades/${id}`);
    return response.data;
  },

  updateOportunidad: async (id, payload) => {
    const response = await api.put(`/crm/oportunidades/${id}`, payload);
    return response.data;
  },

  cambiarEtapa: async (id, etapaId) => {
    const response = await api.put(`/crm/oportunidades/${id}/etapa`, { Etapa_Id: etapaId });
    return response.data;
  },

  cerrarOportunidad: async (id, resultado, crearVentaDesdeCotizacion = true) => {
    const response = await api.put(
      `/crm/oportunidades/${id}/cerrar`,
      { Resultado: resultado, CrearVentaDesdeCotizacion: crearVentaDesdeCotizacion },
    );
    return response.data;
  },

  deleteOportunidad: async (id) => {
    const response = await api.delete(`/crm/oportunidades/${id}`);
    return response.data;
  },

  // Actividades
  getActividades: async (oportunidadId) => {
    const response = await api.get(`/crm/oportunidades/${oportunidadId}/actividades`);
    return response.data;
  },

  crearActividad: async (oportunidadId, payload) => {
    const response = await api.post(`/crm/oportunidades/${oportunidadId}/actividades`, payload);
    return response.data;
  },

  completarActividad: async (actividadId, payload = {}) => {
    const response = await api.put(`/crm/actividades/${actividadId}/completar`, payload);
    return response.data;
  },

  enviarActividadAProduccion: async (actividadId, productos) => {
    const response = await api.post(`/crm/actividades/${actividadId}/enviar-produccion`, { productos });
    return response.data;
  },
};
