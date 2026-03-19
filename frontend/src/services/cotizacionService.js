import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const cotizacionService = {
  createCotizacion: async (payload) => {
    const response = await axios.post(`${API_URL}/cotizaciones`, payload, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  listCotizaciones: async (filters = {}) => {
    const response = await axios.get(`${API_URL}/cotizaciones`, {
      headers: getAuthHeader(),
      params: filters,
    });
    return response.data;
  },

  getCotizacion: async (id) => {
    const response = await axios.get(`${API_URL}/cotizaciones/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  aprobarCotizacion: async (id, payload = {}) => {
    const response = await axios.post(`${API_URL}/cotizaciones/${id}/aprobar`, payload, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  confirmarPedido: async (id) => {
    const response = await axios.post(`${API_URL}/cotizaciones/${id}/confirmar-pedido`, {}, {
      headers: getAuthHeader(),
    });
    return response.data;
  },
};
