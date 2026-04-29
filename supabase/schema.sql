create extension if not exists pgcrypto;

create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  page_url text,
  logo_url text,
  brand_color text not null default '#14b8a6',
  is_active boolean not null default true,
  posts_per_day integer not null default 1,
  time_slots text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pages add column if not exists logo_url text;
alter table pages add column if not exists brand_color text not null default '#14b8a6';

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  post_date date not null,
  time_slot text not null,
  image_path text,
  image_url text,
  caption text not null,
  ads_link text,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_page_id_idx on posts(page_id);
create index if not exists posts_post_date_idx on posts(post_date);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content text not null default '',
  color text not null default '#fef08a',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_sort_order_idx on notes(sort_order);

alter table pages enable row level security;
alter table posts enable row level security;
alter table notes enable row level security;

drop policy if exists "public can read pages" on pages;
drop policy if exists "public can insert pages" on pages;
drop policy if exists "public can update pages" on pages;
drop policy if exists "public can delete pages" on pages;
drop policy if exists "public can read posts" on posts;
drop policy if exists "public can insert posts" on posts;
drop policy if exists "public can update posts" on posts;
drop policy if exists "public can delete posts" on posts;
drop policy if exists "public can read notes" on notes;
drop policy if exists "public can insert notes" on notes;
drop policy if exists "public can update notes" on notes;
drop policy if exists "public can delete notes" on notes;

create policy "public can read pages"
on pages for select
to anon
using (true);

create policy "public can insert pages"
on pages for insert
to anon
with check (true);

create policy "public can update pages"
on pages for update
to anon
using (true)
with check (true);

create policy "public can delete pages"
on pages for delete
to anon
using (true);

create policy "public can read posts"
on posts for select
to anon
using (true);

create policy "public can insert posts"
on posts for insert
to anon
with check (true);

create policy "public can update posts"
on posts for update
to anon
using (true)
with check (true);

create policy "public can delete posts"
on posts for delete
to anon
using (true);

create policy "public can read notes"
on notes for select
to anon
using (true);

create policy "public can insert notes"
on notes for insert
to anon
with check (true);

create policy "public can update notes"
on notes for update
to anon
using (true)
with check (true);

create policy "public can delete notes"
on notes for delete
to anon
using (true);
