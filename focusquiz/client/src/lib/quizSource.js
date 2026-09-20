import { fetchQuiz } from './api.js';
import { localQuestion } from './localQuiz.js';

export const MAX_AI_CALLS = 10; // per session, so a long study block cannot burn the API budget

export async function getQuestion(text, tier, engine) {
  if (engine.aiAvailable && engine.aiCalls < MAX_AI_CALLS) {
    engine.aiCalls++;
    try {
      return { ...(await fetchQuiz(text, tier)), source: 'ai' };
    } catch (err) {
      if (err.status === 503) engine.aiAvailable = false; // server has no key; stop asking
    }
  }
  return localQuestion(text, tier);
}
