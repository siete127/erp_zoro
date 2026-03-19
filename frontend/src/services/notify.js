export function notify(message, type = 'success', userName = null) {
  try {
    let finalUserName = userName;

    if (!finalUserName) {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        finalUserName = user.Username || user.Name || user.FirstName || user.FullName || '';
      } catch (e) {
        finalUserName = '';
      }
    }

    window.dispatchEvent(new CustomEvent('app-notify', {
      detail: { message, type, userName: finalUserName }
    }));
  } catch (e) {
    console.warn('Could not dispatch notification', e);
  }
}

// Atajos de conveniencia para usar notify.success / notify.error
notify.success = (message, userName = null) => notify(message, 'success', userName);
notify.error = (message, userName = null) => notify(message, 'error', userName);
notify.info = (message, userName = null) => notify(message, 'info', userName);
