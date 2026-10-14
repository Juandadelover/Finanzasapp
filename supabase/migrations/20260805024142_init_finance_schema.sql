-- Profiles: extra info per authenticated user
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Per-user settings
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'COP',
  monthly_budget numeric(14,2),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "user_settings_all_own" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'more-horizontal',
  color text not null default '#64748b',
  type text not null check (type in ('income','expense')),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "categories_all_own" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index categories_user_id_idx on public.categories(user_id);

-- Transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  description text not null default '',
  date date not null,
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;
create policy "transactions_all_own" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index transactions_user_id_date_idx on public.transactions(user_id, date desc);

-- Bootstrap a new user: profile row, default settings, default categories
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );

  insert into public.user_settings (user_id) values (new.id);

  insert into public.categories (user_id, name, icon, color, type, is_default) values
    (new.id, 'Comida', 'utensils', '#f97316', 'expense', true),
    (new.id, 'Transporte', 'car', '#3b82f6', 'expense', true),
    (new.id, 'Vivienda', 'home', '#a855f7', 'expense', true),
    (new.id, 'Entretenimiento', 'film', '#ec4899', 'expense', true),
    (new.id, 'Salud', 'heart-pulse', '#ef4444', 'expense', true),
    (new.id, 'Educación', 'graduation-cap', '#06b6d4', 'expense', true),
    (new.id, 'Compras', 'shopping-bag', '#eab308', 'expense', true),
    (new.id, 'Servicios', 'zap', '#84cc16', 'expense', true),
    (new.id, 'Suscripciones', 'repeat', '#6366f1', 'expense', true),
    (new.id, 'Mascotas', 'paw-print', '#f59e0b', 'expense', true),
    (new.id, 'Otros', 'more-horizontal', '#64748b', 'expense', true),
    (new.id, 'Salario', 'briefcase', '#10b981', 'income', true),
    (new.id, 'Freelance', 'laptop', '#14b8a6', 'income', true),
    (new.id, 'Inversiones', 'trending-up', '#22c55e', 'income', true),
    (new.id, 'Regalo', 'gift', '#f472b6', 'income', true),
    (new.id, 'Ahorros', 'piggy-bank', '#34d399', 'income', true),
    (new.id, 'Otros', 'more-horizontal', '#64748b', 'income', true);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
