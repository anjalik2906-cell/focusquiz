// Shows a FocusQuiz alert on whichever tab you drifted to.

// This function is injected into the other tab, so it must be fully self-contained.
function showOverlay({ awayMs, chunk }) {
  const ID = 'focusquiz-alert-host';
  const old = document.getElementById(ID);
  if (old) old.remove();

  const s = Math.max(0, Math.round(awayMs / 1000));
  const time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'all:initial;position:fixed;top:16px;right:16px;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .box { width: 300px; box-sizing: border-box; padding: 14px 16px; color: #fff; background: #121826;
           border-left: 6px solid #e0533d; border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,.4);
           font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; animation: in .25s ease-out; }
    .title { margin: 0 0 4px; font-size: 15px; font-weight: 700; }
    .body { margin: 0 0 12px; opacity: .85; }
    .row { display: flex; gap: 8px; }
    button { font: inherit; font-weight: 600; padding: 7px 12px; border-radius: 6px; cursor: pointer; border: 1px solid #7c93ff; }
    .go { color: #0e1220; background: #7c93ff; }
    .no { color: #fff; background: transparent; border-color: #4a5370; }
    @keyframes in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .box { animation: none; } }`;

  const box = document.createElement('div');
  box.className = 'box';
  box.setAttribute('role', 'alert');
  const title = document.createElement('p');
  title.className = 'title';
  title.textContent = 'You drifted from your study';
  const body = document.createElement('p');
  body.className = 'body';
  body.textContent = `Away ${time}. You were on chunk ${chunk}.`;
  const row = document.createElement('div');
  row.className = 'row';
  const go = document.createElement('button');
  go.className = 'go';
  go.textContent = 'Back to study';
  go.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'focus-app' }));
  const no = document.createElement('button');
  no.className = 'no';
  no.textContent = 'Dismiss';
  no.addEventListener('click', () => host.remove());
  row.append(go, no);
  box.append(title, body, row);
  root.append(style, box);
  (document.body || document.documentElement).appendChild(host);
}

function hideOverlay() {
  const el = document.getElementById('focusquiz-alert-host');
  if (el) el.remove();
}

// The service worker can be shut down at any time, so state lives in session storage.
async function getState() {
  const { fq } = await chrome.storage.session.get('fq');
  return fq || { appTab: null, alert: null, shown: [] };
}
const setState = (fq) => chrome.storage.session.set({ fq });

async function inject(tabId, state) {
  const awayMs = Date.now() - state.alert.since;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: showOverlay, args: [{ awayMs, chunk: state.alert.chunk }] });
    if (!state.shown.includes(tabId)) state.shown.push(tabId);
  } catch {
    // chrome:// pages, the Web Store and some viewers cannot be scripted. The desktop notification still fires.
  }
}

async function onAway(msg, sender) {
  if (!sender.tab) return;
  const state = await getState();
  state.appTab = { tabId: sender.tab.id, windowId: sender.tab.windowId };
  state.alert = { since: Date.now() - Math.max(0, msg.awayMs), chunk: Math.max(1, Math.min(9999, Math.round(msg.chunk) || 1)) };
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active && active.id !== state.appTab.tabId) await inject(active.id, state);
  await setState(state);
}

async function onBack() {
  const state = await getState();
  for (const tabId of state.shown) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, func: hideOverlay });
    } catch {} // tab closed or navigated away
  }
  state.alert = null;
  state.shown = [];
  await setState(state);
}

async function onFocusApp() {
  const { appTab } = await getState();
  if (!appTab) return;
  try {
    await chrome.tabs.update(appTab.tabId, { active: true });
    await chrome.windows.update(appTab.windowId, { focused: true });
  } catch {} // the FocusQuiz tab was closed
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'app-away') onAway({ awayMs: Number(msg.awayMs) || 0, chunk: Number(msg.chunk) || 1 }, sender);
  else if (msg.type === 'app-back' || msg.type === 'app-end') onBack();
  else if (msg.type === 'focus-app') onFocusApp();
});

// Still drifting: if you hop to yet another tab while the alert is active, follow you there.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const state = await getState();
  if (!state.alert || !state.appTab || tabId === state.appTab.tabId) return;
  await inject(tabId, state);
  await setState(state);
});