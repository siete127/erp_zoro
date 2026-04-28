import api from './api';

export const ventaService = {
  // Crear nueva venta
  createVenta: async (ventaData) => {
    const response = await api.post('/ventas/', ventaData);
    return response.data;
  },

  // Listar ventas
  getVentas: async (filters = {}) => {
    const response = await api.get('/ventas/', {
      params: filters
    });
    return response.data;
  },

  // Obtener venta con detalle
  getVentaDetalle: async (ventaId) => {
    const response = await api.get(`/ventas/${ventaId}`);
    return response.data;
  },

  // Agregar productos a la venta
  addProductos: async (ventaId, productos) => {
    const response = await api.post(
      `/ventas/${ventaId}/productos`,
      { Venta_Id: ventaId, productos }
    );
    return response.data;
  },

  // Facturar venta
  facturarVenta: async (ventaId, cfdiData) => {
    const response = await api.post(`/ventas/${ventaId}/facturar`, cfdiData);
    return response.data;
  },

  // Confirmar venta
  confirmarVenta: async (ventaId) => {
    const response = await api.put(`/ventas/${ventaId}/confirmar`, {});
    return response.data;
  },

  // Cancelar venta
  cancelarVenta: async (ventaId) => {
    const response = await api.put(`/ventas/${ventaId}/cancelar`, {});
    return response.data;
  },

  // Actualizar venta
  updateVenta: async (ventaId, ventaData) => {
    const response = await api.put(`/ventas/${ventaId}`, ventaData);
    return response.data;
  },

  // Eliminar venta
  deleteVenta: async (ventaId) => {
    const response = await api.delete(`/ventas/${ventaId}`);
    return response.data;
  },

  // Obtener estatus disponibles
  getVentaStatus: async () => {
    const response = await api.get('/ventas/status');
    return response.data;
  },

  // Descargar PDF de factura
  descargarFacturaPDF: async (ventaId) => {
    const response = await api.get(`/ventas/${ventaId}/factura/pdf`, {
      responseType: 'blob'
    });
    return response;
  },

  // Rentabilidad / margen por venta (solo Admin/Direccion)
  getRentabilidad: async (ventaId) => {
    const response = await api.get(`/ventas/${ventaId}/rentabilidad`);
    return response;
  }
};

