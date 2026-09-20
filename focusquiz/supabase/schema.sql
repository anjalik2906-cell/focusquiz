-- Run this once in the Supabase SQL editor.
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,
  created_at  timestamptz not null default now(),
  focus_score int not null,
  total_ms    bigint not null,
  summary     jsonb not null
);

create index if not exists sessions_client_idx
  on public.sessions (client_id, created_at desc);

-- Row level security on with no policies: the browser can never read this table.
-- Only the Node server, using the service role key, reads and writes it.
alter table public.sessions enable row level security;
