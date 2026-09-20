// Split pasted text into chunks. Blank lines separate paragraphs; if the text has too
// few paragraphs, fall back to groups of three sentences.
export function chunkText(raw) {
  let parts = raw
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 3) {
    const sentences = raw.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/);
    parts = [];
    for (let i = 0; i < sentences.length; i += 3) parts.push(sentences.slice(i, i + 3).join(' '));
  }
  return parts.filter(Boolean);
}
