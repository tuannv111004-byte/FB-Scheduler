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

create table if not exists vias (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  account_link text,
  account_password text not null,
  display_name text not null,
  two_factor_code text not null default '',
  outlook_email text not null default '',
  outlook_password text not null default '',
  via_email text not null default '',
  avatar_url text,
  status text not null default 'active',
  location text not null default 'personal_laptop',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table vias add column if not exists account_link text;

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  type text not null default 'website',
  description text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sources_type_idx on sources(type);
create index if not exists sources_active_idx on sources(is_active);

create table if not exists poster_lab_franchises (
  id uuid primary key default gen_random_uuid(),
  franchise_name text not null,
  latest_official_title text not null,
  genre text not null default 'other',
  notes text not null default '',
  tmdb_movie_id integer,
  tmdb_genre_ids integer[] not null default '{}',
  tmdb_genre_names text[] not null default '{}',
  release_date date,
  overview text,
  poster_path text,
  backdrop_path text,
  source_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table poster_lab_franchises add column if not exists tmdb_movie_id integer;
alter table poster_lab_franchises add column if not exists tmdb_genre_ids integer[] not null default '{}';
alter table poster_lab_franchises add column if not exists tmdb_genre_names text[] not null default '{}';
alter table poster_lab_franchises add column if not exists release_date date;
alter table poster_lab_franchises add column if not exists overview text;
alter table poster_lab_franchises add column if not exists poster_path text;
alter table poster_lab_franchises add column if not exists backdrop_path text;
alter table poster_lab_franchises add column if not exists source_category text;

create table if not exists poster_lab_sequels (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references poster_lab_franchises(id) on delete cascade,
  fake_title text not null,
  release_year integer not null,
  tagline text not null default '',
  synopsis text not null default '',
  visual_hook text not null default '',
  prompt text not null default '',
  caption text not null default '',
  is_used boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table poster_lab_sequels add column if not exists caption text not null default '';

create index if not exists poster_lab_franchises_genre_idx on poster_lab_franchises(genre);
create unique index if not exists poster_lab_franchises_tmdb_movie_id_idx
on poster_lab_franchises(tmdb_movie_id)
where tmdb_movie_id is not null;
create index if not exists poster_lab_sequels_franchise_idx on poster_lab_sequels(franchise_id);
create index if not exists poster_lab_sequels_used_idx on poster_lab_sequels(is_used);
create index if not exists poster_lab_sequels_release_year_idx on poster_lab_sequels(release_year);

create table if not exists page_vias (
  page_id uuid not null references pages(id) on delete cascade,
  via_id uuid not null references vias(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (page_id, via_id)
);

create index if not exists vias_status_idx on vias(status);
create index if not exists vias_location_idx on vias(location);
create index if not exists page_vias_via_id_idx on page_vias(via_id);

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update
set public = excluded.public;

alter table pages enable row level security;
alter table posts enable row level security;
alter table notes enable row level security;
alter table vias enable row level security;
alter table sources enable row level security;
alter table poster_lab_franchises enable row level security;
alter table poster_lab_sequels enable row level security;
alter table page_vias enable row level security;

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
drop policy if exists "public can read vias" on vias;
drop policy if exists "public can insert vias" on vias;
drop policy if exists "public can update vias" on vias;
drop policy if exists "public can delete vias" on vias;
drop policy if exists "public can read sources" on sources;
drop policy if exists "public can insert sources" on sources;
drop policy if exists "public can update sources" on sources;
drop policy if exists "public can delete sources" on sources;
drop policy if exists "public can read poster lab franchises" on poster_lab_franchises;
drop policy if exists "public can insert poster lab franchises" on poster_lab_franchises;
drop policy if exists "public can update poster lab franchises" on poster_lab_franchises;
drop policy if exists "public can delete poster lab franchises" on poster_lab_franchises;
drop policy if exists "public can read poster lab sequels" on poster_lab_sequels;
drop policy if exists "public can insert poster lab sequels" on poster_lab_sequels;
drop policy if exists "public can update poster lab sequels" on poster_lab_sequels;
drop policy if exists "public can delete poster lab sequels" on poster_lab_sequels;
drop policy if exists "public can read page vias" on page_vias;
drop policy if exists "public can insert page vias" on page_vias;
drop policy if exists "public can update page vias" on page_vias;
drop policy if exists "public can delete page vias" on page_vias;
drop policy if exists "public can read post images" on storage.objects;
drop policy if exists "public can insert post images" on storage.objects;
drop policy if exists "public can update post images" on storage.objects;
drop policy if exists "public can delete post images" on storage.objects;

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

create policy "public can read vias"
on vias for select
to anon
using (true);

create policy "public can insert vias"
on vias for insert
to anon
with check (true);

create policy "public can update vias"
on vias for update
to anon
using (true)
with check (true);

create policy "public can delete vias"
on vias for delete
to anon
using (true);

create policy "public can read sources"
on sources for select
to anon
using (true);

create policy "public can insert sources"
on sources for insert
to anon
with check (true);

create policy "public can update sources"
on sources for update
to anon
using (true)
with check (true);

create policy "public can delete sources"
on sources for delete
to anon
using (true);

create policy "public can read poster lab franchises"
on poster_lab_franchises for select
to anon
using (true);

create policy "public can insert poster lab franchises"
on poster_lab_franchises for insert
to anon
with check (true);

create policy "public can update poster lab franchises"
on poster_lab_franchises for update
to anon
using (true)
with check (true);

create policy "public can delete poster lab franchises"
on poster_lab_franchises for delete
to anon
using (true);

create policy "public can read poster lab sequels"
on poster_lab_sequels for select
to anon
using (true);

create policy "public can insert poster lab sequels"
on poster_lab_sequels for insert
to anon
with check (true);

create policy "public can update poster lab sequels"
on poster_lab_sequels for update
to anon
using (true)
with check (true);

create policy "public can delete poster lab sequels"
on poster_lab_sequels for delete
to anon
using (true);

create policy "public can read page vias"
on page_vias for select
to anon
using (true);

create policy "public can insert page vias"
on page_vias for insert
to anon
with check (true);

create policy "public can update page vias"
on page_vias for update
to anon
using (true)
with check (true);

create policy "public can delete page vias"
on page_vias for delete
to anon
using (true);

create policy "public can read post images"
on storage.objects for select
to anon
using (bucket_id = 'post-images');

create policy "public can insert post images"
on storage.objects for insert
to anon
with check (bucket_id = 'post-images');

create policy "public can update post images"
on storage.objects for update
to anon
using (bucket_id = 'post-images')
with check (bucket_id = 'post-images');

create policy "public can delete post images"
on storage.objects for delete
to anon
using (bucket_id = 'post-images');
