/**
 * Configuración centralizada para Socket.io
 * Obtiene la URL correcta del servidor según el ambiente
 */

export const getSocketUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'erp.ardabytec.vip' || host === 'qaerp.ardabytec.vip') {
      return window.location.origin;
    }
  }

  const useDirectProd = import.meta.env.VITE_USE_DIRECT_PROD === 'true';

  if (useDirectProd) {
    const directSocketEnv = import.meta.env.VITE_SOCKET_URL_PROD_DIRECT;
    if (directSocketEnv) {
      return directSocketEnv;
    }

    const directBaseEnv = import.meta.env.VITE_API_BASE_URL_PROD_DIRECT;
    if (directBaseEnv) {
      return directBaseEnv;
    }

    const directApiEnv = import.meta.env.VITE_API_BASE_PROD_DIRECT || import.meta.env.VITE_API_URL_PROD_DIRECT;
    if (directApiEnv) {
      return directApiEnv.replace(/\/api\/?$/, '');
    }
  }

  const socketEnv = import.meta.env.VITE_SOCKET_URL;
  if (socketEnv) {
    return socketEnv;
  }

  const baseEnv = import.meta.env.VITE_API_BASE_URL;
  if (baseEnv) {
    return baseEnv;
  }

  const apiEnv = import.meta.env.VITE_API_URL;
  if (apiEnv) {
    return apiEnv.replace(/\/api\/?$/, '');
  }

  const useProd = import.meta.env.VITE_USE_PROD === 'true';
  if (useProd) {
    return window.location.origin;
  }

  return 'http://localhost:5000';
};
