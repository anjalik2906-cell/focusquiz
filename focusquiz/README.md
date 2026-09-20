# FocusQuiz

A study companion that notices when your attention leaves the tab and quizzes you on the exact chunk you were reading. Built for the browser (React + Vite) with a small Node/Express backend that keeps the AI key private and stores session history in Supabase (or a local JSON file).

## Quick start

Requires Node 20 or newer.

```bash
npm run setup          # installs root, server and client dependencies
cp .env.example .env   # every value is optional
npm run dev            # API on :8787, app on http://localhost:5173
```

Open http://localhost:5173, click **Load sample text**, then **Start session**.

Production style (one process serves the built app and the API):

```bash
npm start              # builds the client, then serves everything on http://localhost:8787
```

## Configuration (`.env` in the project root)

| Variable | What it does | If empty |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Enables AI-written questions | App uses local fill-in-the-blank and self-check questions |
| `ANTHROPIC_MODEL` | Model for questions (default `claude-sonnet-5`) | Default is used |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Store session history in Supabase | History is saved to `server/data/sessions.json` |
| `PORT` | API port (default 8787) | Default is used |

### Supabase setup (optional)

1. Create a project at supabase.com.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Put the project URL and the **service role** key in `.env`. The key stays on the server and is never sent to the browser.

## Demo script (about 60 seconds)

1. **Load sample text**, leave **Demo mode** on, **Start session**. Demo mode shrinks every timer.
2. **Simulate a tab switch.** A "Welcome back" card appears under the chunk you were reading, with a recap and a question.
3. Answer wrong. **Re-read this chunk** scrolls back and flashes it.
4. **Simulate a long distraction.** You get a concept question instead of a recall question.
5. **Simulate quick switches.** Three fast switches trigger "Lots of quick switches" (fragmented attention).
6. Wait 15 to 30 seconds. The chunk you missed returns as a **Quick review** (adaptive spaced re-quiz).
7. **End session.** The dashboard shows the focus trace, score, per-chunk heat, insights and chunks to revisit. It is saved to Recent sessions.

Real tab switches, real window blur and real inactivity work the same way as the simulated ones.

## How detection works (no AI involved)

| Signal | Rule (real mode / demo mode) | Result |
| --- | --- | --- |
| Tab hidden or window blurred | away 15s or more / 3s or more | Distraction, quiz on the chunk being read |
| Long absence | away 2 min or more / 15s or more | Concept question instead of recall |
| Quick switches | 3 short switches within 60s / 30s | Fragmented attention |
| Inactivity | no mouse, key, scroll or touch for 60s / 10s | Idle flag and a check-in question |
| Flicker | under 300ms | Ignored |
| Current chunk | scroll position (chunk nearest the middle of the screen) plus dwell time | Decides which chunk is quizzed |

Only one quiz card is open at a time. Wrong answers return after half the review delay; right answers return after the full delay; a right answer on a review retires the chunk.

**Focus score** = 100, minus the percent of time away, minus 5 per fragmentation event, plus up to 10 for quiz accuracy (clamped 0 to 100).

## Project layout

```
server/
  index.js        Express API: /api/health, /api/quiz, /api/sessions, static hosting
  quiz.js         Anthropic Messages API call, JSON validation, option shuffling
  store.js        Supabase or JSON-file session storage
client/src/
  lib/engine.js   Focus engine (framework free, unit tested)
  lib/*.js        chunker, score, insights, config, api, local question fallback
  components/     Setup, Session, QuizCard, Dashboard, Trace, History
supabase/schema.sql
```

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | `{ ok, ai, storage }` |
| `POST /api/quiz` | `{ text, tier: "recall" or "concept" }` returns a question. 503 or 502 with `fallback: true` means the client should use a local question |
| `POST /api/sessions` | Save a session summary (needs `x-client-id` header) |
| `GET /api/sessions` | The last 20 sessions for that client id |

## Tests

```bash
npm test
```

Covers the chunker, the score formula and the focus engine (distraction, long absence, fragmentation window, flicker, one-quiz-at-a-time, idle, dwell time, spaced re-quiz, summary) using a fake clock.

## Privacy and limits

- Tracking is browser-only: tab visibility, window focus and input activity inside this page. It cannot see other apps.
- Only the chunk being quizzed is sent to the AI, through your server. The API key never reaches the browser.
- Saved history keeps a short preview of each chunk, not the full study text.
- History is tied to an anonymous id in the browser's localStorage. For real accounts, add Supabase Auth and row level security policies keyed on the user id.
- The quiz endpoint has a per-IP rate limit and the client caps AI calls at 10 per session.

## Ideas for next steps

- Browser extension for cross-tab tracking
- Full SM-2 spaced repetition and quiz history per topic
- Accounts with Supabase Auth, shareable reports for teachers or study groups
- PDF upload and text extraction
