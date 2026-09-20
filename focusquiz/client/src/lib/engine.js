import { computeScore } from './score.js';
import { buildInsights } from './insights.js';

// All focus-tracking logic lives here, free of React and the DOM, so it can be unit tested
// with a fake clock. The UI feeds it events (leave, comeBack, activity, tick) and renders
// getSnapshot(). Detection is plain rules over timestamps; no AI is involved.
export class SessionEngine {
  constructor({ chunks, cfg, goalMs, clock = Date.now }) {
    this.clock = clock;
    this.cfg = cfg;
    this.goalMs = goalMs;
    this.chunks = chunks.map((text) => ({ text, dwell: 0, distractions: 0, right: 0, wrong: 0 }));
    this.startAt = clock();
    this.endAt = 0;
    this.simMs = 0; // simulated time added by demo buttons
    this.awayMs = 0;
    this.events = []; // [{event, timestamp, ...}]
    this.segments = []; // away spans on the session clock: [{start, end}]
    this.distractTimes = [];
    this.leftAt = null;
    this.leftIdx = 0;
    this.cur = 0;
    this.idle = false;
    this.lastActivity = this.startAt;
    this.shortSwitches = [];
    this.distractions = 0;
    this.fragmented = 0;
    this.idleEvents = 0;
    this.aiCalls = 0;
    this.aiAvailable = true;
    this.queue = []; // spaced re-quiz queue: [{idx, dueAt}]
    this.quizBusy = false;
    this.quizLog = [];
    this.running = true;
    this.nextQuizId = 1;
    this.listeners = new Set();
    this.triggerHandler = () => {};
    this.subscribe = this.subscribe.bind(this);
    this.getSnapshot = this.getSnapshot.bind(this);
    this.log('start');
    this.snap = this.buildSnapshot();
  }

  // ---- plumbing for useSyncExternalStore ----
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  getSnapshot() {
    return this.snap;
  }
  setTriggerHandler(fn) {
    this.triggerHandler = fn;
  }
  emit() {
    this.snap = this.buildSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  // Session clock: real elapsed time plus any simulated time.
  vnow() {
    return this.clock() - this.startAt + this.simMs;
  }
  log(event, extra = {}) {
    this.events.push({ event, timestamp: this.clock(), ...extra });
  }

  // ---- focus events ----
  leave() {
    if (!this.running || this.leftAt != null) return;
    this.leftAt = this.clock();
    this.leftIdx = this.cur;
    this.log('leave');
    this.emit();
  }

  comeBack() {
    if (!this.running || this.leftAt == null) return;
    const away = this.clock() - this.leftAt;
    this.leftAt = null;
    this.lastActivity = this.clock();
    this.log('return', { awayMs: away });
    if (away < 300) return this.emit(); // ignore flicker
    this.registerAway(away, this.leftIdx);
  }

  // Demo helper: pretend the user was away for `ms` without waiting.
  simulateAway(ms) {
    if (!this.running) return;
    this.simMs += ms;
    this.log('simulated_away', { awayMs: ms });
    this.registerAway(ms, this.cur);
  }

  activity() {
    if (!this.running) return;
    this.lastActivity = this.clock();
    if (this.idle) {
      this.idle = false;
      this.log('active');
      this.emit();
    }
  }

  setCurrent(i) {
    if (!this.running || i === this.cur || i < 0 || i >= this.chunks.length) return;
    this.cur = i;
    this.emit();
  }

  // ---- distraction rules ----
  registerAway(away, idx) {
    const { distractMs, longMs, fragWindowMs, fragCount } = this.cfg;
    this.awayMs += away;
    const end = this.vnow();
    const start = Math.max(0, end - away);
    this.segments.push({ start, end });
    if (away >= distractMs) {
      // One long absence is a distraction.
      this.distractions++;
      this.chunks[idx].distractions++;
      this.distractTimes.push(start);
      this.log('distraction', { awayMs: away, chunk: idx });
      this.trigger(idx, 'Welcome back', away >= longMs ? 'concept' : 'recall', away);
    } else {
      // Several short switches inside a window is fragmented attention.
      const now = this.clock();
      this.shortSwitches = this.shortSwitches.filter((t) => now - t < fragWindowMs);
      this.shortSwitches.push(now);
      if (this.shortSwitches.length >= fragCount) {
        this.fragmented++;
        this.shortSwitches = [];
        this.chunks[idx].distractions++;
        this.log('fragmented', { chunk: idx });
        this.trigger(idx, 'Lots of quick switches', 'recall', away);
      }
    }
    this.emit();
  }

  // ---- quiz lifecycle ----
  trigger(idx, label, tier, awayMs, isRequiz = false) {
    if (this.quizBusy) return;
    this.quizBusy = true;
    this.triggerHandler({ id: this.nextQuizId++, idx, label, tier, awayMs, isRequiz });
  }

  grade(idx, correct, isRequiz) {
    const c = this.chunks[idx];
    if (correct === true) c.right++;
    else if (correct === false) c.wrong++;
    this.quizLog.push({ idx, correct, at: this.vnow() });
    this.queue = this.queue.filter((q) => q.idx !== idx);
    if (!(correct === true && isRequiz)) {
      // Wrong answers come back twice as soon as right ones.
      const delay = correct === false ? this.cfg.requizMs / 2 : this.cfg.requizMs;
      this.queue.push({ idx, dueAt: this.clock() + delay });
    }
    this.emit();
  }

  closeQuiz() {
    this.quizBusy = false;
    this.emit();
  }

  // ---- once per second ----
  tick() {
    if (!this.running) return;
    const now = this.clock();
    if (this.leftAt == null) {
      if (!this.idle && now - this.lastActivity > this.cfg.idleMs) {
        this.idle = true;
        this.idleEvents++;
        this.log('idle');
        this.trigger(this.cur, 'Still with us?', 'recall', 0);
      }
      if (!this.idle) this.chunks[this.cur].dwell += 1;
      if (!this.quizBusy) {
        const i = this.queue.findIndex((q) => q.dueAt <= now);
        if (i >= 0) {
          const [q] = this.queue.splice(i, 1);
          this.trigger(q.idx, 'Quick review', 'recall', 0, true);
        }
      }
    }
    this.emit();
  }

  end() {
    if (this.running) {
      this.running = false;
      this.endAt = this.clock();
      this.log('end');
      this.emit();
    }
    return this.summary();
  }

  // ---- read models ----
  buildSnapshot() {
    const now = this.clock();
    const awayNow = this.leftAt != null ? now - this.leftAt : 0;
    const total = (this.running ? now : this.endAt) - this.startAt + this.simMs;
    return {
      running: this.running,
      status: this.leftAt != null ? 'away' : this.idle ? 'idle' : 'focused',
      total,
      focused: Math.max(0, total - this.awayMs - awayNow),
      goalMs: this.goalMs,
      distractions: this.distractions,
      fragmented: this.fragmented,
      idleEvents: this.idleEvents,
      cur: this.cur,
      segments: this.segments.slice(),
      chunks: this.chunks.map((c) => ({ ...c }))
    };
  }

  summary() {
    const totalMs = (this.endAt || this.clock()) - this.startAt + this.simMs;
    const right = this.chunks.reduce((n, c) => n + c.right, 0);
    const wrong = this.chunks.reduce((n, c) => n + c.wrong, 0);
    const { score, awayPct, accuracy } = computeScore({
      totalMs,
      awayMs: this.awayMs,
      fragmented: this.fragmented,
      right,
      wrong
    });
    const queued = new Set(this.queue.map((q) => q.idx));
    const chunks = this.chunks.map((c, index) => ({
      index,
      preview: c.text.slice(0, 80),
      text: c.text,
      dwell: c.dwell,
      distractions: c.distractions,
      right: c.right,
      wrong: c.wrong
    }));
    const summary = {
      startedAt: this.startAt,
      totalMs,
      awayMs: this.awayMs,
      awayPct,
      distractions: this.distractions,
      fragmented: this.fragmented,
      idleEvents: this.idleEvents,
      focusScore: score,
      accuracy,
      quizRight: right,
      quizWrong: wrong,
      segments: this.segments.slice(),
      distractTimes: this.distractTimes.slice(),
      firstDistractionMs: this.distractTimes.length ? Math.min(...this.distractTimes) : null,
      chunks,
      revisit: chunks.filter((c) => c.wrong > 0 || c.distractions >= 2 || queued.has(c.index)).map((c) => c.index)
    };
    summary.insights = buildInsights(summary);
    return summary;
  }
}
