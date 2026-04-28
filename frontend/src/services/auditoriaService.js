import api from "./api";

export const auditoriaService = {
  async listar(params = {}) {
    const response = await api.get("/auditoria/", { params });
    return response.data?.items || [];
  },

  async listarModulos() {
    const response = await api.get("/auditoria/modulos");
    return response.data?.items || [];
  },
};

export default auditoriaService;
