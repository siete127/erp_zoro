import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const listBOM = async (filters = {}) => {
  const response = await axios.get(`${API_URL}/bom`, {
    headers: getAuthHeaders(),
    params: filters
  });
  return response.data;
};

export const getBOMDetalle = async (bomId) => {
  const response = await axios.get(`${API_URL}/bom/${bomId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const createBOM = async (bomData) => {
  const response = await axios.post(`${API_URL}/bom`, bomData, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const updateBOM = async (bomId, bomData) => {
  const response = await axios.put(`${API_URL}/bom/${bomId}`, bomData, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const deleteBOM = async (bomId) => {
  const response = await axios.delete(`${API_URL}/bom/${bomId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const clonarBOM = async (bomId, nuevaVersion) => {
  const response = await axios.post(`${API_URL}/bom/${bomId}/clonar`, 
    { nuevaVersion },
    { headers: getAuthHeaders() }
  );
  return response.data;
};

export const getVariacionCostosBOM = async (bomId) => {
  const response = await axios.get(`${API_URL}/bom/${bomId}/variacion-costos`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const deleteOperacionBOM = async (operacionId) => {
  const response = await axios.delete(`${API_URL}/bom/operaciones/${operacionId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const listMateriasPrimas = async (companyId) => {
  const response = await axios.get(`${API_URL}/bom/materias-primas`, {
    headers: getAuthHeaders(),
    params: { Company_Id: companyId }
  });
  return response.data;
};
