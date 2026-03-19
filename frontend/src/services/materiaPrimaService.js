import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const listMateriasPrimas = async (filters = {}) => {
  const response = await axios.get(`${API_URL}/materias-primas`, {
    headers: getAuthHeaders(),
    params: filters
  });
  return response.data;
};

export const getMateriaPrimaDetalle = async (id) => {
  const response = await axios.get(`${API_URL}/materias-primas/${id}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const createMateriaPrima = async (data) => {
  const response = await axios.post(`${API_URL}/materias-primas`, data, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const updateMateriaPrima = async (id, data) => {
  const response = await axios.put(`${API_URL}/materias-primas/${id}`, data, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const deleteMateriaPrima = async (id) => {
  const response = await axios.delete(`${API_URL}/materias-primas/${id}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};
