import api from './api';

const API_URL = '/reporteria';

export const reporteriaService = {
  getFacturas: async (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.fechaInicio) params.append('fechaInicio', filtros.fechaInicio);
    if (filtros.fechaFin) params.append('fechaFin', filtros.fechaFin);
    if (filtros.cliente) params.append('cliente', filtros.cliente);
    if (filtros.status) params.append('status', filtros.status);
    
    const response = await api.get(`${API_URL}/facturas?${params.toString()}`);
    return response.data;
  },

  descargarPDF: async (facturaId) => {
    const response = await api.get(`${API_URL}/facturas/${facturaId}/pdf`, {
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
    const response = await api.get(`${API_URL}/facturas/${facturaId}/xml`, {
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

  cancelarFactura: async (facturaId, payload = {}) => {
    const response = await api.post(`/facturas/${facturaId}/cancelar`, payload);
    return response.data;
  },

  getEstadisticas: async (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.fechaInicio) params.append('fechaInicio', filtros.fechaInicio);
    if (filtros.fechaFin) params.append('fechaFin', filtros.fechaFin);
    
    const response = await api.get(`${API_URL}/estadisticas?${params.toString()}`);
    return response.data;
  }
};
