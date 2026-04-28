/**
 * Hook principal del chat — mismo patrón que el proyecto de referencia.
 * Carga historial vía REST y escucha eventos en tiempo real por Socket.io.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { chatJoin, chatLeave, chatRead, chatSend, chatTyping } from '../services/chatSocket';
import { notify } from '../services/notify';

export function useChat(socket, canalId) {
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);   // alguien más está escribiendo
  const typingTimer = useRef(null);

  // ── Cargar historial y unirse a la sala ──────────────────────────────────
  useEffect(() => {
    if (!canalId) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/chat/canales/${canalId}/mensajes?limit=50`);
        setMensajes(res.data || []);
      } catch {
        setMensajes([]);
      } finally {
        setLoading(false);
      }
    };

    load();

    if (socket) {
      chatJoin(canalId);
      chatRead(canalId);
    }

    return () => {
      if (socket) chatLeave(canalId);
    };
  }, [canalId, socket]);

  // ── Escuchar eventos Socket.io ───────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onMensaje = (msg) => {
      if (msg.Canal_Id !== canalId) return;
      setMensajes((prev) => {
        // evitar duplicados
        if (prev.some((m) => m.Mensaje_Id === msg.Mensaje_Id)) return prev;
        return [...prev, msg];
      });
      chatRead(canalId);
    };

    const onTyping = ({ user_id, canal_id, is_typing }) => {
      if (canal_id !== canalId) return;
      setTyping(is_typing);
      if (is_typing) {
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 3000);
      }
    };

    const onChatError = (payload) => {
      const message = payload?.message || 'No se pudo enviar el mensaje';
      notify(message, 'error');
      console.error('chat:error', payload);
    };

    socket.on('chat:mensaje', onMensaje);
    socket.on('chat:typing', onTyping);
    socket.on('chat:error', onChatError);

    return () => {
      socket.off('chat:mensaje', onMensaje);
      socket.off('chat:typing', onTyping);
      socket.off('chat:error', onChatError);
      clearTimeout(typingTimer.current);
    };
  }, [socket, canalId]);

  // ── Acciones ─────────────────────────────────────────────────────────────
  const enviar = useCallback(
    ({ contenido, tipo, archivoUrl, archivoNombre }) => {
      if (!canalId) return;
      chatSend({ canalId, contenido: contenido || '', tipo, archivoUrl, archivoNombre });
    },
    [canalId]
  );

  const notificarEscritura = useCallback(
    (isTyping) => {
      if (canalId) chatTyping(canalId, isTyping);
    },
    [canalId]
  );

  const cargarMas = useCallback(async () => {
    if (!canalId || mensajes.length === 0) return;
    const oldestId = mensajes[0]?.Mensaje_Id;
    try {
      const res = await api.get(`/chat/canales/${canalId}/mensajes?limit=50&before_id=${oldestId}`);
      const mas = res.data || [];
      if (mas.length > 0) setMensajes((prev) => [...mas, ...prev]);
    } catch { /* silencioso */ }
  }, [canalId, mensajes]);

  return { mensajes, loading, typing, enviar, notificarEscritura, cargarMas };
}
