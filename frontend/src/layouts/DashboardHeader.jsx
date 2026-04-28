import React, { useEffect, useState } from "react";
import { FaDoorOpen } from "react-icons/fa";
import { IoChatbubblesOutline } from "react-icons/io5";
import ChatDrawer, { useChatBadge } from "../components/Chat/ChatDrawer";
import NotifBell from "../components/Notificaciones/NotifBell";

const greetings = [
  "\u00a1Hola",
  "\u00a1Qu\u00e9 gusto verte",
  "\u00a1Bienvenido",
  "\u00a1Excelente verte",
  "\u00a1Hola, que tengas un gran d\u00eda",
];

function getStoredUserName() {
  const user = localStorage.getItem("user");
  if (!user) return "Usuario";

  try {
    const userData = JSON.parse(user);
    return userData.Username || userData.Name || userData.FirstName || userData.FullName || "Usuario";
  } catch {
    return "Usuario";
  }
}

export default function DashboardHeader({ title, onLogout, menuOpen, onToggleMenu }) {
  const [userName] = useState(getStoredUserName);
  const [greeting] = useState(() => greetings[Math.floor(Math.random() * greetings.length)]);
  const [chatOpen, setChatOpen] = useState(false);
  const { total: totalNoLeidos, clear: clearBadge } = useChatBadge(chatOpen);

  useEffect(() => {
    if (chatOpen) clearBadge();
  }, [chatOpen, clearBadge]);

  const actionButtonClass =
    "relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm transition hover:bg-white/16 hover:border-white/25";

  return (
    <header className="sticky top-0 z-50 border-b border-[#0f2f61] bg-[linear-gradient(180deg,_#092052_0%,_#0d2c61_58%,_#12356e_100%)] px-4 py-3 shadow-[0_14px_34px_rgba(9,32,82,0.18)] md:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onToggleMenu}
            className={`${actionButtonClass} ${menuOpen ? "bg-white/18 border-white/30" : ""}`}
            aria-label={"Abrir men\u00fa"}
            aria-expanded={menuOpen}
          >
            <span className="sr-only">{"Abrir men\u00fa"}</span>
            <div className="flex flex-col gap-1">
              <span className="h-0.5 w-5 rounded bg-white" />
              <span className="h-0.5 w-5 rounded bg-white/90" />
              <span className="h-0.5 w-5 rounded bg-white/80" />
            </div>
          </button>

          <div className="hidden min-w-0 md:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Panel activo</p>
            <h1 className="truncate text-lg font-semibold text-white">{title}</h1>
          </div>
        </div>

        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="rounded-2xl border border-white/12 bg-white/8 px-5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm">
            <p className="truncate text-sm font-semibold text-white">
              {greeting} {userName}!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotifBell />

          <button
            onClick={() => setChatOpen(true)}
            className={actionButtonClass}
            aria-label="Abrir chat"
          >
            <IoChatbubblesOutline size={21} />
            {totalNoLeidos > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[20px] min-w-[20px] items-center justify-center rounded-full border border-white/25 bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-[0_8px_18px_rgba(239,68,68,0.45)]">
                {totalNoLeidos > 99 ? "99+" : totalNoLeidos}
              </span>
            )}
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/30 bg-red-500 text-white shadow-[0_12px_24px_rgba(239,68,68,0.28)] transition hover:bg-red-600"
              aria-label={"Cerrar sesi\u00f3n"}
            >
              <FaDoorOpen size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 md:hidden">
        <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          <p className="mt-0.5 truncate text-xs text-white/70">
            {greeting} {userName}!
          </p>
        </div>
      </div>

      <ChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </header>
  );
}
