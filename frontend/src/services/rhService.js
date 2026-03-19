import api from './api';

export const rhService = {
  async listPerfiles(params = {}) {
    const res = await api.get('/rh/perfiles', { params });
    return res.data || [];
  },

  async getPerfil(userId) {
    const res = await api.get(`/rh/perfiles/${userId}`);
    return res.data || {};
  },

  async upsertPerfil(userId, payload) {
    const res = await api.put(`/rh/perfiles/${userId}`, payload);
    return res.data;
  },

  async uploadFotoPerfil(userId, file) {
    const formData = new FormData();
    formData.append('fotoPerfil', file);
    const res = await api.post(`/rh/perfiles/${userId}/foto`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  async listDocumentos(userId) {
    const res = await api.get(`/rh/perfiles/${userId}/documentos`);
    return res.data || [];
  },

  async uploadDocumento(userId, payload) {
    const formData = new FormData();
    formData.append('documento', payload.file);
    if (payload.TipoDocumento) formData.append('TipoDocumento', payload.TipoDocumento);
    if (payload.Descripcion) formData.append('Descripcion', payload.Descripcion);

    const res = await api.post(`/rh/perfiles/${userId}/documentos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  async deleteDocumento(documentoId) {
    const res = await api.delete(`/rh/documentos/${documentoId}`);
    return res.data;
  },

  async createContactoEmergencia(userId, payload) {
    const res = await api.post(`/rh/perfiles/${userId}/contactos-emergencia`, payload);
    return res.data;
  },

  async updateContactoEmergencia(contactoId, payload) {
    const res = await api.put(`/rh/contactos-emergencia/${contactoId}`, payload);
    return res.data;
  },

  async deleteContactoEmergencia(contactoId) {
    const res = await api.delete(`/rh/contactos-emergencia/${contactoId}`);
    return res.data;
  },

  async createCuentaBancaria(userId, payload) {
    const res = await api.post(`/rh/perfiles/${userId}/cuentas-bancarias`, payload);
    return res.data;
  },

  async updateCuentaBancaria(cuentaId, payload) {
    const res = await api.put(`/rh/cuentas-bancarias/${cuentaId}`, payload);
    return res.data;
  },

  async deleteCuentaBancaria(cuentaId) {
    const res = await api.delete(`/rh/cuentas-bancarias/${cuentaId}`);
    return res.data;
  }
};
