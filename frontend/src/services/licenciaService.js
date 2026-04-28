import api from "./api";

export const licenciaService = {
  listar: async (companyId = null) => {
    const response = await api.get("/licencias/", {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data?.items || [];
  },

  listarTipos: async () => {
    const response = await api.get("/licencias/tipos");
    return response.data?.items || [];
  },

  crear: async (payload) => {
    const response = await api.post("/licencias/", payload);
    return response.data;
  },

  actualizar: async (licenciaId, payload) => {
    const response = await api.put(`/licencias/${licenciaId}`, payload);
    return response.data;
  },

  eliminar: async (licenciaId) => {
    const response = await api.delete(`/licencias/${licenciaId}`);
    return response.data;
  },
};

export default licenciaService;
