-- ============================================================================
-- Al-Uqabi Cinema (سينما العقابي) - Supabase Schema & RLS Setup
-- Copy and run this script in your Supabase Project -> SQL Editor.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE (Roles: 'admin', 'moderator', 'user')
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    phone text,
    name text not null default 'User',
    role text not null default 'user' check (role in ('admin', 'moderator', 'user')),
    is_banned boolean not null default false,
    avatar_color bigint not null default 4293200148,
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper functions (SECURITY DEFINER avoids infinite recursion in RLS)
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select role from public.profiles where id = auth.uid()), 'user');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.current_user_role() = 'admin';
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.current_user_role() in ('admin', 'moderator');
$$;

create or replace function public.is_not_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select not is_banned from public.profiles where id = auth.uid()), true);
$$;

-- Automatically create a profile row with role='user' on every new signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    derived_name text;
begin
    derived_name := coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        nullif(new.phone, ''),
        'User'
    );

    insert into public.profiles (id, email, phone, name, role)
    values (new.id, new.email, new.phone, derived_name, 'user')
    on conflict (id) do update
        set email = coalesce(excluded.email, public.profiles.email),
            phone = coalesce(excluded.phone, public.profiles.phone);

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Prevent non-admin users from changing role or is_banned
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (new.role is distinct from old.role or new.is_banned is distinct from old.is_banned)
       and not public.is_admin() then
        raise exception 'Only administrators can change user roles or ban status';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
    before update on public.profiles
    for each row execute function public.prevent_role_self_escalation();

drop policy if exists "Profiles readable by authenticated users" on public.profiles;
create policy "Profiles readable by authenticated users"
    on public.profiles for select
    to authenticated
    using (true);

drop policy if exists "Users can insert own default profile" on public.profiles;
create policy "Users can insert own default profile"
    on public.profiles for insert
    to authenticated
    with check (auth.uid() = id and role = 'user' and is_banned = false);

drop policy if exists "Users update own profile or admin updates any" on public.profiles;
create policy "Users update own profile or admin updates any"
    on public.profiles for update
    to authenticated
    using (auth.uid() = id or public.is_admin())
    with check (auth.uid() = id or public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. MOVIES & SERIES CATALOG TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.movies_catalog (
    id uuid primary key default gen_random_uuid(),
    tmdb_id integer,
    media_type text not null check (media_type in ('MOVIE', 'SERIES')),
    title text not null,
    title_ar text not null default '',
    original_title text not null default '',
    overview text not null default '',
    poster_url text not null default '',
    backdrop_url text not null default '',
    year text not null default '',
    rating double precision not null default 0.0,
    genres jsonb not null default '[]'::jsonb,
    stream_url text not null default '',
    qualities jsonb not null default '[]'::jsonb,
    subtitles jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_movies_catalog_tmdb on public.movies_catalog(tmdb_id, media_type);

alter table public.movies_catalog enable row level security;

drop policy if exists "Catalog readable by everyone" on public.movies_catalog;
create policy "Catalog readable by everyone"
    on public.movies_catalog for select
    to anon, authenticated
    using (true);

drop policy if exists "Admin manages catalog" on public.movies_catalog;
create policy "Admin manages catalog"
    on public.movies_catalog for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. SERIES EPISODES TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.series_episodes (
    id uuid primary key default gen_random_uuid(),
    series_tmdb_id integer,
    catalog_item_id uuid references public.movies_catalog(id) on delete cascade,
    season_number integer not null default 1,
    episode_number integer not null default 1,
    title text not null default '',
    overview text not null default '',
    still_url text not null default '',
    stream_url text not null default '',
    qualities jsonb not null default '[]'::jsonb,
    subtitles jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_series_episodes_lookup
    on public.series_episodes(series_tmdb_id, season_number, episode_number);

alter table public.series_episodes enable row level security;

drop policy if exists "Episodes readable by everyone" on public.series_episodes;
create policy "Episodes readable by everyone"
    on public.series_episodes for select
    to anon, authenticated
    using (true);

drop policy if exists "Admin manages episodes" on public.series_episodes;
create policy "Admin manages episodes"
    on public.series_episodes for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. LIVE CHANNELS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.live_channels (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    group_title text not null default 'General',
    logo_url text not null default '',
    stream_url text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.live_channels enable row level security;

drop policy if exists "Live channels readable by everyone" on public.live_channels;
create policy "Live channels readable by everyone"
    on public.live_channels for select
    to anon, authenticated
    using (is_active = true or public.is_admin());

drop policy if exists "Admin manages live channels" on public.live_channels;
create policy "Admin manages live channels"
    on public.live_channels for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. REACTIONS TABLE (Like / Dislike - 1 per user per media)
-- ----------------------------------------------------------------------------
create table if not exists public.reactions (
    id uuid primary key default gen_random_uuid(),
    media_key text not null,
    user_id uuid not null references public.profiles(id) on delete cascade,
    reaction_type text not null check (reaction_type in ('LIKE', 'DISLIKE')),
    created_at timestamptz not null default now(),
    unique (media_key, user_id)
);

create index if not exists idx_reactions_media on public.reactions(media_key);

alter table public.reactions enable row level security;

drop policy if exists "Reactions readable by everyone" on public.reactions;
create policy "Reactions readable by everyone"
    on public.reactions for select
    to anon, authenticated
    using (true);

drop policy if exists "Authenticated users manage own reactions" on public.reactions;
create policy "Authenticated users manage own reactions"
    on public.reactions for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "Users update own reactions" on public.reactions;
create policy "Users update own reactions"
    on public.reactions for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users delete own reactions" on public.reactions;
create policy "Users delete own reactions"
    on public.reactions for delete
    to authenticated
    using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6. FAVORITES TABLE (Cloud Synced per User)
-- ----------------------------------------------------------------------------
create table if not exists public.favorites (
    id uuid primary key default gen_random_uuid(),
    media_key text not null,
    user_id uuid not null references public.profiles(id) on delete cascade,
    media_type text not null check (media_type in ('MOVIE', 'SERIES', 'LIVE_TV')),
    title text not null,
    poster_url text not null default '',
    backdrop_url text not null default '',
    year text not null default '',
    rating double precision not null default 0.0,
    tmdb_id integer,
    created_at timestamptz not null default now(),
    unique (media_key, user_id)
);

create index if not exists idx_favorites_user on public.favorites(user_id);

alter table public.favorites enable row level security;

drop policy if exists "Users read own favorites" on public.favorites;
create policy "Users read own favorites"
    on public.favorites for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Users insert own favorites" on public.favorites;
create policy "Users insert own favorites"
    on public.favorites for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "Users delete own favorites" on public.favorites;
create policy "Users delete own favorites"
    on public.favorites for delete
    to authenticated
    using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 7. COMMENTS TABLE (Staff badges + ban enforcement + moderation delete)
-- ----------------------------------------------------------------------------
create table if not exists public.comments (
    id uuid primary key default gen_random_uuid(),
    media_key text not null,
    user_id uuid not null references public.profiles(id) on delete cascade,
    content text not null check (char_length(trim(content)) > 0 and char_length(content) <= 1000),
    created_at timestamptz not null default now()
);

create index if not exists idx_comments_media on public.comments(media_key, created_at desc);

alter table public.comments enable row level security;

drop policy if exists "Comments readable by everyone" on public.comments;
create policy "Comments readable by everyone"
    on public.comments for select
    to anon, authenticated
    using (true);

drop policy if exists "Non-banned users can post own comments" on public.comments;
create policy "Non-banned users can post own comments"
    on public.comments for insert
    to authenticated
    with check (auth.uid() = user_id and public.is_not_banned());

drop policy if exists "Owners or staff can delete comments" on public.comments;
create policy "Owners or staff can delete comments"
    on public.comments for delete
    to authenticated
    using (auth.uid() = user_id or public.is_staff());
