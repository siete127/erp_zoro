import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const crmService = {
  // Etapas del pipeline CRM
  getEtapas: async () => {
    const response = await axios.get(`${API_URL}/crm/etapas`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // Oportunidades
  createOportunidad: async (payload) => {
    const response = await axios.post(`${API_URL}/crm/oportunidades`, payload, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  getOportunidades: async (filters = {}) => {
    const response = await axios.get(`${API_URL}/crm/oportunidades`, {
      headers: getAuthHeader(),
      params: filters,
    });
    return response.data;
  },

  getOportunidad: async (id) => {
    const response = await axios.get(`${API_URL}/crm/oportunidades/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  updateOportunidad: async (id, payload) => {
    const response = await axios.put(`${API_URL}/crm/oportunidades/${id}`, payload, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  cambiarEtapa: async (id, etapaId) => {
    const response = await axios.put(
      `${API_URL}/crm/oportunidades/${id}/etapa`,
      { Etapa_Id: etapaId },
      { headers: getAuthHeader() },
    );
    return response.data;
  },

  cerrarOportunidad: async (id, resultado, crearVentaDesdeCotizacion = true) => {
    const response = await axios.put(
      `${API_URL}/crm/oportunidades/${id}/cerrar`,
      { Resultado: resultado, CrearVentaDesdeCotizacion: crearVentaDesdeCotizacion },
      { headers: getAuthHeader() },
    );
    return response.data;
  },

  deleteOportunidad: async (id) => {
    const response = await axios.delete(`${API_URL}/crm/oportunidades/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // Actividades
  getActividades: async (oportunidadId) => {
    const response = await axios.get(`${API_URL}/crm/oportunidades/${oportunidadId}/actividades`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  crearActividad: async (oportunidadId, payload) => {
    const response = await axios.post(
      `${API_URL}/crm/oportunidades/${oportunidadId}/actividades`,
      payload,
      { headers: getAuthHeader() },
    );
    return response.data;
  },

  completarActividad: async (actividadId, payload = {}) => {
    const response = await axios.put(
      `${API_URL}/crm/actividades/${actividadId}/completar`,
      payload,
      { headers: getAuthHeader() },
    );
    return response.data;
  },

  enviarActividadAProduccion: async (actividadId, productos) => {
    const response = await axios.post(
      `${API_URL}/crm/actividades/${actividadId}/enviar-produccion`,
      { productos },
      { headers: getAuthHeader() },
    );
    return response.data;
  },
};
