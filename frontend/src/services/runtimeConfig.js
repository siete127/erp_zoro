const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

const isBrowser = typeof window !== "undefined";

const isLoopbackUrl = (value) => {
  if (!value) return false;
  try {
    const url = new URL(value, isBrowser ? window.location.origin : "http://localhost");
    return LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
};

const toOrigin = (value) => {
  if (!value) {
    return isBrowser ? window.location.origin : "http://localhost:5173";
  }

  if (value.startsWith("/")) {
    return isBrowser ? window.location.origin : "http://localhost:5173";
  }

  try {
    return new URL(value).origin;
  } catch {
    return isBrowser ? window.location.origin : "http://localhost:5173";
  }
};

export const getApiBase = () => {
  const useProd = import.meta.env.VITE_USE_PROD === "true";
  const useDirectProd = import.meta.env.VITE_USE_DIRECT_PROD === "true";

  if (useProd) {
    const prodBase = useDirectProd
      ? (import.meta.env.VITE_API_BASE_PROD_DIRECT || import.meta.env.VITE_API_URL_PROD_DIRECT)
      : (import.meta.env.VITE_API_BASE_PROD || import.meta.env.VITE_API_URL);
    return prodBase || "/api";
  }

  const devBase = import.meta.env.VITE_API_BASE_DEV || import.meta.env.VITE_API_URL;
  if (!devBase || isLoopbackUrl(devBase)) {
    return "/api";
  }

  return devBase;
};

export const getApiOrigin = () => {
  const apiBase = getApiBase();
  if (apiBase.startsWith("/")) {
    return isBrowser ? window.location.origin : "http://localhost:5173";
  }
  return toOrigin(apiBase);
};

export const getSocketBase = () => {
  const useProd = import.meta.env.VITE_USE_PROD === "true";
  const useDirectProd = import.meta.env.VITE_USE_DIRECT_PROD === "true";

  if (useProd) {
    const prodSocket = useDirectProd
      ? (
          import.meta.env.VITE_SOCKET_URL_PROD_DIRECT
          || import.meta.env.VITE_API_BASE_URL_PROD_DIRECT
          || import.meta.env.VITE_API_BASE_PROD_DIRECT
          || import.meta.env.VITE_API_URL_PROD_DIRECT
        )
      : (
          import.meta.env.VITE_SOCKET_URL_PROD
          || import.meta.env.VITE_API_BASE_URL_PROD
          || import.meta.env.VITE_API_BASE_PROD
          || import.meta.env.VITE_API_URL
        );
    return prodSocket
      ? prodSocket.replace(/\/api\/?$/, "")
      : (isBrowser ? window.location.origin : "http://localhost:5173");
  }

  const devSocket =
    import.meta.env.VITE_SOCKET_URL
    || import.meta.env.VITE_API_BASE_URL
    || import.meta.env.VITE_API_BASE_DEV
    || import.meta.env.VITE_API_URL;

  if (!devSocket || isLoopbackUrl(devSocket)) {
    return isBrowser ? window.location.origin : "http://localhost:5173";
  }

  return devSocket.replace(/\/api\/?$/, "");
};
