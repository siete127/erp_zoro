import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const ventaService = {
  // Crear nueva venta
  createVenta: async (ventaData) => {
    const response = await axios.post(`${API_URL}/ventas`, ventaData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  // Listar ventas
  getVentas: async (filters = {}) => {
    const response = await axios.get(`${API_URL}/ventas`, {
      headers: getAuthHeader(),
      params: filters
    });
    return response.data;
  },

  // Obtener venta con detalle
  getVentaDetalle: async (ventaId) => {
    const response = await axios.get(`${API_URL}/ventas/${ventaId}`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  // Agregar productos a la venta
  addProductos: async (ventaId, productos) => {
    const response = await axios.post(
      `${API_URL}/ventas/${ventaId}/productos`,
      { Venta_Id: ventaId, productos },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Facturar venta
  facturarVenta: async (ventaId, cfdiData) => {
    const response = await axios.post(
      `${API_URL}/ventas/${ventaId}/facturar`,
      cfdiData,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Cancelar venta
  cancelarVenta: async (ventaId) => {
    const response = await axios.put(
      `${API_URL}/ventas/${ventaId}/cancelar`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Actualizar venta
  updateVenta: async (ventaId, ventaData) => {
    const response = await axios.put(
      `${API_URL}/ventas/${ventaId}`,
      ventaData,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Eliminar venta
  deleteVenta: async (ventaId) => {
    const response = await axios.delete(
      `${API_URL}/ventas/${ventaId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Obtener estatus disponibles
  getVentaStatus: async () => {
    const response = await axios.get(`${API_URL}/ventas/status`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  // Descargar PDF de factura
  descargarFacturaPDF: async (ventaId) => {
    const response = await axios.get(`${API_URL}/ventas/${ventaId}/factura/pdf`, {
      headers: getAuthHeader()
    });
    return response.data;
  }
};
