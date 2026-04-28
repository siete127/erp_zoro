/**
 * Wrappers de Socket.io para el chat interno.
 * Mismo patrón que el proyecto de referencia (services/socket.js).
 * Usa el socket global ya inicializado por el sistema de auth.
 */

let _socket = null;

export const setChatSocket = (socket) => {
  _socket = socket;
};

export const chatJoin = (canalId) => {
  _socket?.emit('chat:join', { canal_id: canalId });
};

export const chatLeave = (canalId) => {
  _socket?.emit('chat:leave', { canal_id: canalId });
};

export const chatSend = ({ canalId, contenido, tipo = 'texto', archivoUrl = null, archivoNombre = null }) => {
  _socket?.emit('chat:send', {
    canal_id: canalId,
    contenido,
    tipo,
    archivo_url: archivoUrl,
    archivo_nombre: archivoNombre,
  });
};

export const chatTyping = (canalId, isTyping) => {
  _socket?.emit('chat:typing', { canal_id: canalId, is_typing: isTyping });
};

export const chatRead = (canalId) => {
  _socket?.emit('chat:read', { canal_id: canalId });
};

export const chatGetOnline = () => {
  _socket?.emit('chat:online_users');
};
