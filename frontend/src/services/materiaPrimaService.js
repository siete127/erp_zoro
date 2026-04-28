import api from './api';

export const listMateriasPrimas = async (filters = {}) => {
  const response = await api.get('/materias-primas/', { params: filters });
  return response.data;
};

export const getMateriaPrimaDetalle = async (id) => {
  const response = await api.get(`/materias-primas/${id}`);
  return response.data;
};

export const createMateriaPrima = async (data) => {
  const response = await api.post('/materias-primas/', data);
  return response.data;
};

export const updateMateriaPrima = async (id, data) => {
  const response = await api.put(`/materias-primas/${id}`, data);
  return response.data;
};

export const deleteMateriaPrima = async (id) => {
  const response = await api.delete(`/materias-primas/${id}`);
  return response.data;
};
