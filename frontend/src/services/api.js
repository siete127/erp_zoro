import axios from "axios";
import { getApiBase } from "./runtimeConfig";

// Híbrido: controla si se usa la URL de producción o la de desarrollo
const useProdFlag = import.meta?.env?.VITE_USE_PROD === 'true';
const useDirectProdFlag = import.meta?.env?.VITE_USE_DIRECT_PROD === 'true';
const prodBase = import.meta?.env?.VITE_API_BASE_PROD;
const directProdBase = import.meta?.env?.VITE_API_BASE_PROD_DIRECT;
const selectedProdBase = useDirectProdFlag
  ? (directProdBase || prodBase)
  : prodBase;

const resolvedBase = useProdFlag
  ? (selectedProdBase || (process.env.NODE_ENV === 'production' ? '/api' : ''))
  : getApiBase();

const api = axios.create({
  baseURL: resolvedBase
});

const getStoredToken = () => {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
};

const clearStoredSession = () => {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("sessionId");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    if (api.defaults?.headers?.common?.Authorization) {
      delete api.defaults.headers.common.Authorization;
    }
  } catch {}
};

const forceLoginRedirect = () => {
  if (typeof window === "undefined") return;
  // No redirigir si estamos en proceso de impersonación
  try {
    if (localStorage.getItem("superadmin_original_token")) return;
  } catch {}
  try {
    const current = window.location.pathname;
    if (current !== "/") window.location.href = "/";
  } catch {
    window.location.href = "/";
  }
};

const shouldForceLogout = (err) => {
  const status = err?.response?.status;
  if (status === 401) return true;
  if (status !== 403) return false;

  const detail = String(
    err?.response?.data?.detail
      || err?.response?.data?.message
      || ""
  ).toLowerCase();

  return (
    detail.includes("token invalido")
    || detail.includes("no autorizado")
    || detail.includes("token faltante")
    || detail.includes("usuario desactivado")
    || detail.includes("acceso denegado por licencia")
  );
};

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers.Authorization) {
    delete config.headers.Authorization;
  }

  // Limpiar "?" vacío al final de la URL (ej: "/api/productos?" → "/api/productos")
  if (config.url && config.url.endsWith('?')) {
    config.url = config.url.slice(0, -1);
  }

  return config;
});

// Global response handler: if backend says user is desactivado (403) or unauthorized (401),
// clear local token and redirect to login so user cannot continue using the app.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (shouldForceLogout(err)) {
      // Si estamos impersonando, no limpiar sesión ni redirigir — el token
      // de impersonación puede fallar en endpoints de superadmin, y eso es esperado.
      const isImpersonating = (() => {
        try { return !!localStorage.getItem("superadmin_original_token"); } catch { return false; }
      })();
      if (!isImpersonating) {
        clearStoredSession();
        forceLoginRedirect();
      }
    }
    return Promise.reject(err);
  }
);

export default api;
