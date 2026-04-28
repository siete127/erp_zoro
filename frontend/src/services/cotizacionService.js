import api from './api';

export const cotizacionService = {
  createCotizacion: async (payload) => {
    const response = await api.post('/cotizaciones/', payload);
    return response.data;
  },

  listCotizaciones: async (filters = {}) => {
    const response = await api.get('/cotizaciones/', { params: filters });
    return response.data;
  },

  getCotizacion: async (id) => {
    const response = await api.get(`/cotizaciones/${id}`);
    return response.data;
  },

  aprobarCotizacion: async (id, payload = {}) => {
    const response = await api.post(`/cotizaciones/${id}/aprobar`, payload);
    return response.data;
  },

  confirmarPedido: async (id) => {
    const response = await api.post(`/cotizaciones/${id}/confirmar-pedido`, {});
    return response.data;
  },
};
