// Runs on the FocusQuiz page (localhost). Relays messages between the page and the extension.
function tellPage(type) {
  window.postMessage({ source: 'focusquiz-ext', type }, window.location.origin);
}

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || e.data.source !== 'focusquiz-app') return;
  const { type, awayMs, chunk } = e.data;
  if (type === 'ping') return tellPage('ready');
  if (type === 'away' || type === 'back' || type === 'end') {
    try {
      const sent = chrome.runtime.sendMessage({ type: `app-${type}`, awayMs: Number(awayMs) || 0, chunk: Number(chunk) || 0 });
      if (sent && sent.catch) sent.catch(() => {});
    } catch {} // the extension was reloaded; refresh the page
  }
});

tellPage('ready');