import axios from "axios";

// Híbrido: controla si se usa la URL de producción o la de desarrollo
const useProdFlag = import.meta?.env?.VITE_USE_PROD === 'true';
const useDirectProdFlag = import.meta?.env?.VITE_USE_DIRECT_PROD === 'true';
const prodBase = import.meta?.env?.VITE_API_BASE_PROD;
const directProdBase = import.meta?.env?.VITE_API_BASE_PROD_DIRECT;
const devBase = import.meta?.env?.VITE_API_BASE_DEV;
const defaultDev = 'http://localhost:5000/api';

const selectedProdBase = useDirectProdFlag
  ? (directProdBase || prodBase)
  : prodBase;

const resolvedBase = useProdFlag
  ? (selectedProdBase || (process.env.NODE_ENV === 'production' ? '/api' : ''))
  : (devBase || defaultDev);

const api = axios.create({
  baseURL: resolvedBase
});

// Attach token from localStorage if present
const token = localStorage.getItem('token');
if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// Global response handler: if backend says user is desactivado (403) or unauthorized (401),
// clear local token and redirect to login so user cannot continue using the app.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('sessionId');
      } catch (e) {}
      // redirect to the app's login route (root '/'), avoid reload loops
      if (typeof window !== 'undefined') {
        try {
          const current = window.location.pathname;
          if (current !== '/') window.location.href = '/';
        } catch (e) {
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
