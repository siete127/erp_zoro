import axios from 'axios';

const API_URL = '/api/reporteria';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const reporteriaService = {
  getFacturas: async (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.fechaInicio) params.append('fechaInicio', filtros.fechaInicio);
    if (filtros.fechaFin) params.append('fechaFin', filtros.fechaFin);
    if (filtros.cliente) params.append('cliente', filtros.cliente);
    if (filtros.status) params.append('status', filtros.status);
    
    const response = await axios.get(`${API_URL}/facturas?${params.toString()}`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  descargarPDF: async (facturaId) => {
    const response = await axios.get(`${API_URL}/facturas/${facturaId}/pdf`, {
      headers: getAuthHeader(),
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `factura-${facturaId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  descargarXML: async (facturaId) => {
    const response = await axios.get(`${API_URL}/facturas/${facturaId}/xml`, {
      headers: getAuthHeader(),
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `factura-${facturaId}.xml`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  getEstadisticas: async (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.fechaInicio) params.append('fechaInicio', filtros.fechaInicio);
    if (filtros.fechaFin) params.append('fechaFin', filtros.fechaFin);
    
    const response = await axios.get(`${API_URL}/estadisticas?${params.toString()}`, {
      headers: getAuthHeader()
    });
    return response.data;
  }
};
