create table if not exists public.site_content (
  content_key text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

drop policy if exists "Service role manages site content" on public.site_content;
create policy "Service role manages site content"
  on public.site_content
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
