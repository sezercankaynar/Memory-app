-- Rotamız — Supabase şeması
-- Supabase Dashboard > SQL Editor'de bu dosyayı çalıştırın.
-- Ardından Storage'da "media" adında bir bucket oluşturun (aşağıdaki politika bloğu yardımcı olur).

-- ---------------------------------------------------------------------------
-- Profiller: her kullanıcının görünen adı ve harita rengi
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Gezgin',
  color text not null default '#c9702f',
  created_at timestamptz not null default now()
);

-- Yeni kullanıcı kaydolunca otomatik profil oluştur
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Albümler: bir çiftin paylaştığı ortak alan
-- ---------------------------------------------------------------------------
create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Rotamız',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Albüm üyeleri (çok kullanıcı, ortak albüm)
create table if not exists public.album_members (
  album_id uuid not null references public.albums(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (album_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Anılar: konum + tarih + medya
-- ---------------------------------------------------------------------------
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  place text,
  lat double precision not null,
  lon double precision not null,
  taken_at timestamptz not null,
  media_url text not null,
  media_type text not null default 'photo' check (media_type in ('photo','video')),
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists memories_album_idx on public.memories(album_id);
create index if not exists memories_taken_at_idx on public.memories(taken_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.albums enable row level security;
alter table public.album_members enable row level security;
alter table public.memories enable row level security;

-- Bir kullanıcının üyesi olduğu albümleri döndüren yardımcı
create or replace function public.is_album_member(a uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.album_members m
    where m.album_id = a and m.user_id = auth.uid()
  );
$$;

-- profiles: herkes okuyabilir (isim/renk göstermek için), kendi profilini günceller
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (id = auth.uid());

-- albums: üye olduğun albümü gör, kendi albümünü oluştur
drop policy if exists "albums read member" on public.albums;
create policy "albums read member" on public.albums for select using (public.is_album_member(id) or created_by = auth.uid());
drop policy if exists "albums insert own" on public.albums;
create policy "albums insert own" on public.albums for insert with check (created_by = auth.uid());

-- album_members: üyeliğini gör/ekle
drop policy if exists "members read" on public.album_members;
create policy "members read" on public.album_members for select using (user_id = auth.uid() or public.is_album_member(album_id));
drop policy if exists "members insert" on public.album_members;
create policy "members insert" on public.album_members for insert with check (user_id = auth.uid() or public.is_album_member(album_id));

-- memories: albüm üyesi tüm anıları görür; sadece kendi anını ekler/siler
drop policy if exists "memories read member" on public.memories;
create policy "memories read member" on public.memories for select using (public.is_album_member(album_id));
drop policy if exists "memories insert own" on public.memories;
create policy "memories insert own" on public.memories for insert with check (user_id = auth.uid() and public.is_album_member(album_id));
drop policy if exists "memories update own" on public.memories;
create policy "memories update own" on public.memories for update using (user_id = auth.uid());
drop policy if exists "memories delete own" on public.memories;
create policy "memories delete own" on public.memories for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: "media" bucket politikaları
-- Önce Dashboard > Storage > New bucket: "media" (public) oluşturun, sonra:
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media read" on storage.objects;
create policy "media read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media insert own" on storage.objects;
create policy "media insert own" on storage.objects for insert
  with check (bucket_id = 'media' and auth.uid() = owner);
drop policy if exists "media delete own" on storage.objects;
create policy "media delete own" on storage.objects for delete
  using (bucket_id = 'media' and auth.uid() = owner);
