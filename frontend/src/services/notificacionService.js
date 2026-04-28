import api from "./api";

export const notificacionService = {
  listar: async ({ limit = 20, soloNoLeidas = false } = {}) => {
    const response = await api.get("/notificaciones/", {
      params: {
        limit,
        solo_no_leidas: soloNoLeidas,
      },
    });
    return response.data;
  },

  marcarLeida: async (notifId) => {
    const response = await api.patch(`/notificaciones/${notifId}/leer`);
    return response.data;
  },

  marcarTodasLeidas: async () => {
    const response = await api.patch("/notificaciones/leer-todas");
    return response.data;
  },
};

export default notificacionService;
