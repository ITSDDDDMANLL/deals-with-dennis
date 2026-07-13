alter table public.contact_inquiries
  alter column phone drop not null,
  add column if not exists email text,
  add column if not exists preferred_contact_method text not null default 'phone'
    check (preferred_contact_method in ('phone', 'email', 'sms')),
  add column if not exists appointment_date date,
  add column if not exists appointment_time text,
  add column if not exists appointment_notes text,
  add column if not exists vehicle_year integer,
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_trim text,
  add column if not exists vehicle_condition text,
  add column if not exists vehicle_stock_number text,
  add column if not exists vehicle_vin text,
  add column if not exists clients_in_hands_deal_id text,
  add column if not exists clients_in_hands_status text,
  add column if not exists clients_in_hands_error text;

create index if not exists contact_inquiries_created_at_idx
  on public.contact_inquiries (created_at desc);

create index if not exists contact_inquiries_appointment_idx
  on public.contact_inquiries (appointment_date, appointment_time)
  where appointment_date is not null;
