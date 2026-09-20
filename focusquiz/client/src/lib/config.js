// Detection thresholds. Demo mode shrinks every timer so a full walkthrough fits in a minute.
export function makeConfig(demo) {
  return demo
    ? { demo: true, distractMs: 3000, longMs: 15000, fragWindowMs: 30000, fragCount: 3, idleMs: 10000, requizMs: 30000 }
    : { demo: false, distractMs: 15000, longMs: 120000, fragWindowMs: 60000, fragCount: 3, idleMs: 60000, requizMs: 600000 };
}
