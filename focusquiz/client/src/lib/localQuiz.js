// Offline question generator used when the AI backend is unavailable.
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const sameAnswer = (a, b) => norm(a) === norm(b);

export function localQuestion(text, tier) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const open = {
    mode: 'open',
    question: 'In one or two sentences, what was the main idea of the paragraph you were reading?',
    answer: sentences[0] || text,
    explanation: "Compare your answer with the paragraph's opening idea.",
    source: 'local'
  };
  if (tier === 'concept' || !sentences.length) return open;
  const longest = sentences.reduce((a, b) => (b.length > a.length ? b : a));
  const words = longest.match(/[A-Za-z][A-Za-z-]{5,}/g);
  if (!words) return open;
  const target = words.reduce((a, b) => (b.length > a.length ? b : a));
  return {
    mode: 'blank',
    question: `Fill in the blank: ${longest.replace(target, '_____')}`,
    answer: target,
    explanation: longest,
    source: 'local'
  };
}
