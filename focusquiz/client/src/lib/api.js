const KEY = 'focusquiz.clientId';

// Anonymous per-browser id so history stays private without needing sign-in.
export function clientId() {
  let id = null;
  try {
    id = localStorage.getItem(KEY);
  } catch {}
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  }
  return id;
}

async function call(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', 'x-client-id': clientId(), ...(options.headers || {}) }
  });
  if (!res.ok) {
    const err = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const fetchHealth = () => call('/api/health');
export const fetchQuiz = (text, tier) => call('/api/quiz', { method: 'POST', body: JSON.stringify({ text, tier }) });
export const listSessions = () => call('/api/sessions');

// The full chunk text stays in the browser; only short previews are stored.
export function saveSession(summary) {
  const storable = { ...summary, chunks: summary.chunks.map(({ text, ...rest }) => rest) };
  return call('/api/sessions', { method: 'POST', body: JSON.stringify(storable) });
}
// ---- study material sources ----
async function readJson(res, fallback) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${fallback} (${res.status})`);
  return data;
}

// Upload .txt / .md / .pdf / .docx. Returns { title, text }.
export async function extractFile(file) {
  const form = new FormData();
  form.append('file', file); // no content-type header: the browser sets the multipart boundary
  return readJson(await fetch('/api/extract', { method: 'POST', body: form }), 'Upload failed');
}

// YouTube link -> transcript as timestamped paragraphs. Returns { title, videoId, text }.
export async function fetchYoutube(url) {
  return readJson(await fetch(`/api/youtube?url=${encodeURIComponent(url)}`), 'Could not fetch the transcript');
}