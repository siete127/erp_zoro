import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getResumenVentasPorEmpresa = async () => {
  try {
    const response = await axiosInstance.get('/ventas/resumen/por-empresa');
    return response.data;
  } catch (error) {
    console.error('Error al obtener resumen de ventas por empresa:', error);
    throw error;
  }
};

export default {
  getResumenVentasPorEmpresa,
};
