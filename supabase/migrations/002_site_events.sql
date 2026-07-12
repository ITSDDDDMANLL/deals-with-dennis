create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (
      event_type in (
        'page_view',
        'inventory_search',
        'inventory_filter',
        'inventory_sort',
        'view_mode_change',
        'filter_reset',
        'vehicle_view',
        'photo_browse',
        'contact_click',
        'contact_submit'
      )
    ),
  vehicle_id text,
  vehicle_stock_number text,
  vehicle_label text,
  page_path text,
  referrer text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.site_events
  drop constraint if exists site_events_event_type_check;

alter table public.site_events
  add constraint site_events_event_type_check
  check (
    event_type in (
      'page_view',
      'inventory_search',
      'inventory_filter',
      'inventory_sort',
      'view_mode_change',
      'filter_reset',
      'vehicle_view',
      'photo_browse',
      'contact_click',
      'contact_submit'
    )
  );

create index if not exists site_events_created_at_idx
  on public.site_events (created_at desc);

create index if not exists site_events_event_type_idx
  on public.site_events (event_type, created_at desc);

create index if not exists site_events_vehicle_idx
  on public.site_events (vehicle_id, created_at desc);

alter table public.site_events enable row level security;

drop policy if exists "Service role manages site events" on public.site_events;
create policy "Service role manages site events"
  on public.site_events
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
