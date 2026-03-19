import { io } from "socket.io-client";
import { getSocketUrl } from "./socketConfig";

const baseUrl = getSocketUrl();
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const forcePollingInProd =
  import.meta.env.VITE_SOCKET_FORCE_POLLING === 'true'
  || hostname === 'erp.ardabytec.vip'
  || hostname === 'qaerp.ardabytec.vip';

export const socket = io(baseUrl, {
  autoConnect: true,
  withCredentials: true,
  transports: forcePollingInProd ? ["polling"] : ["websocket", "polling"],
  upgrade: !forcePollingInProd,
});

socket.on("connect", () => {
  console.log("Conectado a WebSocket ERP", socket.id);
});

socket.on("disconnect", () => {
  console.log("Desconectado de WebSocket ERP");
});
