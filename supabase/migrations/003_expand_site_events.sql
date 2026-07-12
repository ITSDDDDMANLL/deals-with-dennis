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
