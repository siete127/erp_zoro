import React, { useEffect, useState } from 'react';

export default function Notification() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const { message, type, userName } = e.detail || {};
      if (!message) return;
      const id = Date.now() + Math.random();
      const item = { id, message, type: type || 'info', visible: false, userName: userName || '' };
      setQueue((q) => [...q, item]);

      // make visible next frame for animation
      requestAnimationFrame(() => {
        setQueue((q) => q.map(x => x.id === id ? { ...x, visible: true } : x));
      });

      // auto close after 3.5s (still allow manual close)
      setTimeout(() => close(id), 3500);
    };

    window.addEventListener('app-notify', handler);
    return () => window.removeEventListener('app-notify', handler);
  }, []);

  const close = (id) => {
    // animate out
    setQueue((q) => q.map(x => x.id === id ? { ...x, visible: false } : x));
    // remove after animation
    setTimeout(() => setQueue((q) => q.filter(x => x.id !== id)), 400);
  };

  if (queue.length === 0) return null;

  const current = queue[0];

  const headerBg = (type) => {
    switch (type) {
      case 'success': return 'bg-gradient-to-r from-green-600 to-green-500';
      case 'error': return 'bg-gradient-to-r from-red-600 to-red-500';
      case 'warn': return 'bg-gradient-to-r from-yellow-500 to-yellow-400';
      default: return 'bg-gradient-to-r from-slate-800 to-slate-700';
    }
  };

  // Reemplazar "Usuario" con el nombre real si está disponible
  let displayMessage = current.message;
  if (current.userName) {
    // Reemplazar cualquier ocurrencia de "Usuario" con el nombre real
    displayMessage = current.message.replace(/Usuario/g, current.userName);
  }

  const backdropClass = current.visible 
    ? 'opacity-100 transition-opacity duration-300 ease-out' 
    : 'opacity-0 transition-opacity duration-400 ease-in pointer-events-none';
  
  const modalClass = current.visible 
    ? 'opacity-100 scale-100 translate-y-0 transition-all duration-500 ease-out' 
    : 'opacity-0 scale-95 translate-y-8 transition-all duration-400 ease-in';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div className={`absolute inset-0 bg-black/40 ${backdropClass}`} />

      <div className={`relative w-full max-w-md pointer-events-auto ${modalClass}`}>
        <div className="rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-slate-900 backdrop-blur-sm border border-white/20">
          <div className={`${headerBg(current.type)} px-6 py-5 relative overflow-hidden group`}>
            <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"></div>
            <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
            <div className="relative h-1"></div>
          </div>
          <div className="p-6 text-slate-900 dark:text-white">
            <div className="text-lg font-semibold leading-relaxed mb-2">{displayMessage}</div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => close(current.id)} 
                className="px-6 py-2.5 bg-[#092052] hover:bg-[#0d3a7a] text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes slideOutDown {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        .animate-notification-in {
          animation: slideInUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .animate-notification-out {
          animation: slideOutDown 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
