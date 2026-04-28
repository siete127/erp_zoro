import api from './api';

export const listBOM = async (filters = {}) => {
  const response = await api.get('/bom/', { params: filters });
  return response.data;
};

export const getBOMDetalle = async (bomId) => {
  const response = await api.get(`/bom/${bomId}`);
  return response.data;
};

export const createBOM = async (bomData) => {
  const response = await api.post('/bom/', bomData);
  return response.data;
};

export const updateBOM = async (bomId, bomData) => {
  const response = await api.put(`/bom/${bomId}`, bomData);
  return response.data;
};

export const deleteBOM = async (bomId) => {
  const response = await api.delete(`/bom/${bomId}`);
  return response.data;
};

export const clonarBOM = async (bomId, nuevaVersion) => {
  const response = await api.post(`/bom/${bomId}/clonar`, { nuevaVersion });
  return response.data;
};

export const getVariacionCostosBOM = async (bomId) => {
  const response = await api.get(`/bom/${bomId}/variacion-costos`);
  return response.data;
};

export const deleteOperacionBOM = async (operacionId) => {
  const response = await api.delete(`/bom/operaciones/${operacionId}`);
  return response.data;
};

export const listMateriasPrimas = async (companyId) => {
  const response = await api.get('/bom/materias-primas', {
    params: { Company_Id: companyId }
  });
  return response.data;
};
