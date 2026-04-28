import api from './api';

export const getResumenVentasPorEmpresa = async () => {
  const response = await api.get('/ventas/resumen/por-empresa');
  return response.data;
};

export const getDashboardKpis = async () => {
  const response = await api.get('/ventas/dashboard/kpis');
  return response.data;
};

export default {
  getResumenVentasPorEmpresa,
  getDashboardKpis,
};
