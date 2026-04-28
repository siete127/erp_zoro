import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoNotificationsOutline } from "react-icons/io5";
import { socket } from "../../services/socket";
import { notify } from "../../services/notify";
import { notificacionService } from "../../services/notificacionService";

const MAX_ITEMS = 20;

function normalizeNotification(item) {
  return {
    ...item,
    Leida: Boolean(item?.Leida),
  };
}

function formatWhen(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(0, Math.round(diffMs / 60000));

  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays} d`;

  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });
}

export default function NotifBell() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await notificacionService.listar({ limit: MAX_ITEMS });
      const nextItems = Array.isArray(response?.items)
        ? response.items.map(normalizeNotification)
        : [];
      setItems(nextItems);
      setUnreadCount(Number(response?.total_no_leidas || 0));
    } catch {
      if (!silent) {
        setItems([]);
        setUnreadCount(0);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const handleOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  useEffect(() => {
    const handleNewNotification = (payload) => {
      const item = normalizeNotification(payload || {});
      if (!item?.Notif_Id) return;

      setItems((prev) => [item, ...prev.filter((entry) => entry.Notif_Id !== item.Notif_Id)].slice(0, MAX_ITEMS));

      if (payload?.TotalNoLeidas !== undefined) {
        setUnreadCount(Number(payload.TotalNoLeidas || 0));
      } else {
        setUnreadCount((prev) => prev + (item.Leida ? 0 : 1));
      }

      if (item.Titulo) {
        notify.info(item.Titulo);
      }
    };

    socket.on("notificacion:nueva", handleNewNotification);
    return () => socket.off("notificacion:nueva", handleNewNotification);
  }, []);

  useEffect(() => {
    if (open) {
      loadNotifications({ silent: true });
    }
  }, [open]);

  const openNotification = async (item) => {
    if (!item) return;

    if (!item.Leida) {
      setItems((prev) =>
        prev.map((entry) =>
          entry.Notif_Id === item.Notif_Id ? { ...entry, Leida: true } : entry
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        const response = await notificacionService.marcarLeida(item.Notif_Id);
        setUnreadCount(Number(response?.total_no_leidas || 0));
      } catch {
        loadNotifications({ silent: true });
      }
    }

    setOpen(false);
    if (item.Link) {
      navigate(item.Link);
    }
  };

  const markAllRead = async () => {
    try {
      await notificacionService.marcarTodasLeidas();
      setItems((prev) => prev.map((item) => ({ ...item, Leida: true })));
      setUnreadCount(0);
    } catch {
      loadNotifications({ silent: true });
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center h-10 w-10 rounded-lg border border-[#e7e8e9] text-[#e7e8e9] hover:bg-[#0d2a63] transition"
        aria-label="Abrir notificaciones"
      >
        <IoNotificationsOutline size={22} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden z-[70]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div>
              <p className="text-sm font-semibold text-gray-800">Notificaciones</p>
              <p className="text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al dia"}
              </p>
            </div>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-xs font-semibold text-[#092052] disabled:text-gray-300"
            >
              Marcar todas
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-sm text-gray-500">Cargando notificaciones...</div>
            )}

            {!loading && items.length === 0 && (
              <div className="px-4 py-8 text-sm text-gray-500 text-center">
                No hay notificaciones recientes.
              </div>
            )}

            {!loading &&
              items.map((item) => (
                <button
                  key={item.Notif_Id}
                  onClick={() => openNotification(item)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition ${
                    item.Leida ? "bg-white" : "bg-amber-50/70"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.Leida ? "bg-gray-300" : "bg-amber-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {item.Titulo || "Notificacion"}
                        </p>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {formatWhen(item.FechaCreacion)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap break-words">
                        {item.Cuerpo || "Sin detalle"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
