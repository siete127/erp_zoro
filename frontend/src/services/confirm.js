export default function confirm(message, title, confirmText = 'Confirmar', cancelText = 'Cancelar') {
  return new Promise((resolve) => {
    const id = Date.now() + Math.random();
    window.__confirmResolvers = window.__confirmResolvers || {};
    window.__confirmResolvers[id] = resolve;
    try {
      window.dispatchEvent(new CustomEvent('app-confirm', { detail: { id, message, title, confirmText, cancelText } }));
    } catch (e) {
      // fallback to native confirm
      const ok = window.confirm(message);
      resolve(Boolean(ok));
      delete window.__confirmResolvers[id];
    }
  });
}
