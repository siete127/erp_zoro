import { io } from "socket.io-client";
import { getSocketUrl } from "./socketConfig";

const baseUrl = getSocketUrl();
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const forcePollingInProd =
  import.meta.env.VITE_SOCKET_FORCE_POLLING === 'true'
  || hostname === 'erp.ardabytec.vip'
  || hostname === 'qaerp.ardabytec.vip';

const getToken = () => {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

export const socket = io(baseUrl, {
  autoConnect: false,
  withCredentials: true,
  transports: forcePollingInProd ? ["polling"] : ["websocket", "polling"],
  upgrade: !forcePollingInProd,
  auth: { token: getToken() },
});

// Conecta o reconecta actualizando el token desde localStorage
export const connectSocket = () => {
  socket.auth = { token: getToken() };
  if (!socket.connected) socket.connect();
};

// Si ya hay token al cargar (refresh de página estando logueado), conectar de inmediato
if (getToken()) {
  socket.connect();
}

socket.on("connect", () => {
  console.log("Conectado a WebSocket ERP", socket.id);
});

socket.on("disconnect", () => {
  console.log("Desconectado de WebSocket ERP");
});
