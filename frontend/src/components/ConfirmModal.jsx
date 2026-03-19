import React, { useEffect, useState } from 'react';

export default function ConfirmModal() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const { id, message, title, confirmText, cancelText } = e.detail || {};
      if (!id) return;
      setQueue((q) => [...q, { 
        id, 
        message: message || '', 
        title: title || 'Confirmar',
        confirmText: confirmText || 'Confirmar',
        cancelText: cancelText || 'Cancelar',
        visible: false 
      }]);

      requestAnimationFrame(() => {
        setQueue((q) => q.map(x => x.id === id ? { ...x, visible: true } : x));
      });
    };

    window.addEventListener('app-confirm', handler);
    return () => window.removeEventListener('app-confirm', handler);
  }, []);

  const respond = (id, accepted) => {
    try {
      window.__confirmResolvers = window.__confirmResolvers || {};
      const resolver = window.__confirmResolvers[id];
      if (typeof resolver === 'function') resolver(accepted);
      delete window.__confirmResolvers[id];
    } catch (e) {
      console.warn('confirm response error', e);
    }

    // animate out
    setQueue((q) => q.map(x => x.id === id ? { ...x, visible: false } : x));
    setTimeout(() => setQueue((q) => q.filter(x => x.id !== id)), 250);
  };

  if (queue.length === 0) return null;
  const current = queue[0];

  const backdropClass = current.visible ? 'animate-backdrop-in' : 'animate-backdrop-out';
  const modalClass = current.visible ? 'animate-modal-in' : 'animate-modal-out';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div className={`absolute inset-0 bg-black/40 ${backdropClass}`} />

      <div className={`relative w-full max-w-lg pointer-events-auto ${modalClass}`}>
        <div className="rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-slate-900">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{current.title}</h3>
          </div>
          <div className="p-6 text-slate-900 dark:text-white">
            <div className="text-sm">{current.message}</div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => respond(current.id, false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-md font-medium">{current.cancelText}</button>
              <button onClick={() => respond(current.id, true)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium">{current.confirmText}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

