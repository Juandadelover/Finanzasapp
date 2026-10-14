-- Fase 0 del SaaS: negocios (workspaces) con roles y esquema base de
-- suscripciones con pagos manuales. Ver docs/REQUISITOS-SAAS.md (D2, D4).
--
-- No destructiva: no borra filas, tablas, columnas, políticas ni restricciones.
-- Cada usuario existente recibe su negocio "Mi negocio" con sus categorías y
-- movimientos actuales. Quedan en desuso: user_settings, categories.user_id y
-- transactions.user_id (ahora opcionales; el creador va en created_by).

-- ---------------------------------------------------------------------------
-- 1. Negocios y membresías
-- ---------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'editor', 'accountant', 'recorder');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  document text,
  tax_regime text check (tax_regime in ('simple', 'ordinario', 'no_responsable_iva')),
  logo_url text,
  currency text not null default 'COP',
  monthly_budget numeric(18,2) check (monthly_budget is null or monthly_budget >= 0),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index workspaces_owner_id_idx on public.workspaces(owner_id);

create table public.memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index memberships_user_id_idx on public.memberships(user_id);
create unique index memberships_one_owner_idx on public.memberships(workspace_id) where role = 'owner';

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Helpers de autorización. SECURITY DEFINER para que las políticas puedan
-- consultar memberships sin recursión de RLS; solo responden sobre auth.uid().
create function public.has_workspace_role(ws uuid, roles public.workspace_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

create function public.is_workspace_member(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = auth.uid());
$$;

-- El dueño y la moneda de un negocio no se cambian desde el cliente.
create function public.protect_workspace_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id <> old.owner_id or new.currency <> old.currency then
    raise exception 'No se puede cambiar el dueño ni la moneda del negocio.';
  end if;
  return new;
end;
$$;

create trigger workspaces_protect_fields
  before update on public.workspaces
  for each row execute function public.protect_workspace_fields();

-- ---------------------------------------------------------------------------
-- 2. Planes y suscripciones (cobro por dueño, pagos manuales)
-- ---------------------------------------------------------------------------
create table public.plans (
  code text primary key,
  name text not null,
  monthly_price integer not null check (monthly_price >= 0), -- COP, sin IVA (D5)
  annual_price integer not null check (annual_price >= 0),
  sort_order integer not null default 0,
  active boolean not null default true
);

create table public.plan_limits (
  plan_code text not null references public.plans(code) on delete cascade,
  key text not null,
  value jsonb not null,
  primary key (plan_code, key)
);

create type public.subscription_status as enum
  ('trial', 'active', 'pending_review', 'grace', 'expired', 'canceled');

create table public.subscriptions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null references public.plans(code),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual')),
  status public.subscription_status not null,
  trial_end timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  provisional_until timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.payment_status as enum ('in_review', 'approved', 'rejected');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.plans(code),
  billing_cycle text not null check (billing_cycle in ('monthly', 'annual')),
  expected_amount integer not null check (expected_amount >= 0),
  declared_amount integer check (declared_amount >= 0),
  reference text not null unique,
  method text not null default 'manual' check (method in ('manual')),
  channel text check (channel in ('nequi', 'bancolombia', 'breb')),
  status public.payment_status not null default 'in_review',
  receipt_path text,
  receipt_sha256 text,
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  provider_transaction_id text unique,
  created_at timestamptz not null default now()
);
create index payments_owner_id_idx on public.payments(owner_id);
create index payments_in_review_idx on public.payments(created_at) where status = 'in_review';

-- Datos de pago que ve el cliente en "Cómo pagar" (D6). Los llena el admin.
create table public.payment_methods_config (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('nequi', 'bancolombia', 'breb')),
  holder_name text not null,
  value text not null,
  details text,
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.plans (code, name, monthly_price, annual_price, sort_order) values
  ('gratis',      'Gratis',            0,       0, 0),
  ('emprendedor', 'Emprendedor',   24900,  249000, 1),
  ('negocio',     'Negocio',       59900,  599000, 2),
  ('pro',         'Pro',          129900, 1299000, 3);

insert into public.plan_limits (plan_code, key, value) values
  ('gratis',      'max_workspaces_owned',  '1'),
  ('gratis',      'max_members',           '1'),
  ('gratis',      'max_tx_per_month',      '100'),
  ('gratis',      'feature.collection_docs', 'false'),
  ('emprendedor', 'max_workspaces_owned',  '1'),
  ('emprendedor', 'max_members',           '2'),
  ('emprendedor', 'max_tx_per_month',      'null'),
  ('emprendedor', 'feature.collection_docs', 'true'),
  ('negocio',     'max_workspaces_owned',  '3'),
  ('negocio',     'max_members',           '5'),
  ('negocio',     'max_tx_per_month',      'null'),
  ('negocio',     'feature.collection_docs', 'true'),
  ('pro',         'max_workspaces_owned',  '10'),
  ('pro',         'max_members',           '15'),
  ('pro',         'max_tx_per_month',      'null'),
  ('pro',         'feature.collection_docs', 'true');

-- ---------------------------------------------------------------------------
-- 3. Categorías y movimientos pasan a pertenecer a un negocio
-- ---------------------------------------------------------------------------
alter table public.categories
  add column workspace_id uuid references public.workspaces(id) on delete cascade,
  alter column user_id drop not null,
  alter column monthly_budget type numeric(18,2);

alter table public.transactions
  add column workspace_id uuid references public.workspaces(id) on delete cascade,
  add column created_by uuid default auth.uid() references auth.users(id) on delete set null,
  alter column user_id drop not null,
  alter column amount type numeric(18,2);

-- Cada usuario existente pasa a ser dueño de "Mi negocio" con sus datos actuales.
do $$
declare
  u record;
  ws uuid;
begin
  for u in
    select au.id, s.monthly_budget
    from auth.users au
    left join public.user_settings s on s.user_id = au.id
  loop
    insert into public.workspaces (name, owner_id, monthly_budget)
    values ('Mi negocio', u.id, u.monthly_budget)
    returning id into ws;

    insert into public.memberships (workspace_id, user_id, role) values (ws, u.id, 'owner');
    insert into public.subscriptions (owner_id, plan_code, status, trial_end)
    values (u.id, 'emprendedor', 'trial', now() + interval '14 days');

    update public.categories set workspace_id = ws where user_id = u.id;
    update public.transactions set workspace_id = ws, created_by = user_id where user_id = u.id;
  end loop;
end $$;

alter table public.categories
  alter column workspace_id set not null,
  add constraint categories_id_workspace_key unique (id, workspace_id);
create index categories_workspace_id_idx on public.categories(workspace_id);

alter table public.transactions
  alter column workspace_id set not null,
  -- La categoría debe ser del mismo negocio que el movimiento.
  add constraint transactions_category_workspace_fkey foreign key (category_id, workspace_id)
    references public.categories(id, workspace_id) on delete set null (category_id);
create index transactions_workspace_date_idx on public.transactions(workspace_id, date desc);

-- ---------------------------------------------------------------------------
-- 4. Arranque de usuarios y negocios nuevos
-- ---------------------------------------------------------------------------
create function public.handle_new_workspace()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.memberships (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  insert into public.categories (workspace_id, name, icon, color, type, is_default) values
    (new.id, 'Compras e inventario', 'shopping-bag', '#eab308', 'expense', true),
    (new.id, 'Arriendo', 'home', '#a855f7', 'expense', true),
    (new.id, 'Nómina y honorarios', 'wallet', '#f97316', 'expense', true),
    (new.id, 'Servicios públicos', 'zap', '#84cc16', 'expense', true),
    (new.id, 'Internet y telefonía', 'wifi', '#06b6d4', 'expense', true),
    (new.id, 'Transporte y envíos', 'car', '#3b82f6', 'expense', true),
    (new.id, 'Publicidad', 'trending-up', '#ec4899', 'expense', true),
    (new.id, 'Software y suscripciones', 'repeat', '#6366f1', 'expense', true),
    (new.id, 'Impuestos y trámites', 'briefcase', '#ef4444', 'expense', true),
    (new.id, 'Otros gastos', 'more-horizontal', '#64748b', 'expense', true),
    (new.id, 'Ventas', 'shopping-bag', '#10b981', 'income', true),
    (new.id, 'Servicios prestados', 'laptop', '#14b8a6', 'income', true),
    (new.id, 'Aportes del dueño', 'piggy-bank', '#34d399', 'income', true),
    (new.id, 'Otros ingresos', 'more-horizontal', '#64748b', 'income', true);

  return new;
end;
$$;

-- Se crea después del paso 3 para no duplicar categorías a los usuarios existentes.
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- Reemplaza la versión anterior (que creaba user_settings y categorías por usuario).
-- Los usuarios invitados a un negocio (metadata "invited") no reciben negocio propio.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');

  if coalesce((new.raw_user_meta_data->>'invited')::boolean, false) then
    return new;
  end if;

  insert into public.workspaces (name, owner_id) values ('Mi negocio', new.id);

  -- RF-SUB-03: 14 días de prueba del plan Emprendedor.
  insert into public.subscriptions (owner_id, plan_code, status, trial_end)
  values (new.id, 'emprendedor', 'trial', now() + interval '14 days');

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_workspace() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.platform_admins enable row level security;
alter table public.plans enable row level security;
alter table public.plan_limits enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_methods_config enable row level security;

-- Negocios: los ven sus miembros; editan dueño y admin; borra solo el dueño.
create policy workspaces_select on public.workspaces for select
  using (owner_id = auth.uid() or public.is_workspace_member(id));
create policy workspaces_insert on public.workspaces for insert
  with check (owner_id = auth.uid());
create policy workspaces_update on public.workspaces for update
  using (public.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]))
  with check (public.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]));
create policy workspaces_delete on public.workspaces for delete
  using (owner_id = auth.uid());

-- Membresías: las ven los miembros; dueño/admin gestionan las que no son de dueño;
-- cualquiera puede salirse de un negocio que no es suyo.
create policy memberships_select on public.memberships for select
  using (public.is_workspace_member(workspace_id));
create policy memberships_insert on public.memberships for insert
  with check (role <> 'owner'
    and public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
create policy memberships_update on public.memberships for update
  using (role <> 'owner'
    and public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
  with check (role <> 'owner'
    and public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
create policy memberships_delete on public.memberships for delete
  using (role <> 'owner' and (user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));

create policy platform_admins_select_self on public.platform_admins for select
  using (user_id = auth.uid());

-- Categorías: las leen todos los miembros; las gestionan dueño, admin y editor.
-- La política antigua "por usuario" se reutiliza como política de gestión.
alter policy categories_all_own on public.categories rename to categories_manage;
alter policy categories_manage on public.categories
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]));
create policy categories_select on public.categories for select
  using (public.is_workspace_member(workspace_id));

-- Movimientos:
--  * dueño/admin/editor: todo
--  * contador: solo lectura
--  * solo registro: crea gastos y ve únicamente los que registró
alter policy transactions_all_own on public.transactions rename to transactions_manage;
alter policy transactions_manage on public.transactions
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]));
create policy transactions_select on public.transactions for select
  using (public.has_workspace_role(workspace_id, array['accountant']::public.workspace_role[])
    or (created_by = auth.uid()
      and public.has_workspace_role(workspace_id, array['recorder']::public.workspace_role[])));
create policy transactions_insert_recorder on public.transactions for insert
  with check (created_by = auth.uid() and type = 'expense'
    and public.has_workspace_role(workspace_id, array['recorder']::public.workspace_role[]));

-- Planes: públicos (página de precios); los cambia solo el admin de plataforma.
create policy plans_select on public.plans for select using (true);
create policy plans_admin on public.plans for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy plan_limits_select on public.plan_limits for select using (true);
create policy plan_limits_admin on public.plan_limits for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Suscripciones: el dueño ve la suya; solo el admin de plataforma la modifica.
create policy subscriptions_select on public.subscriptions for select
  using (owner_id = auth.uid() or public.is_platform_admin());
create policy subscriptions_admin on public.subscriptions for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Pagos: el dueño crea solicitudes "en revisión" y ve las suyas; el admin revisa.
create policy payments_select on public.payments for select
  using (owner_id = auth.uid() or public.is_platform_admin());
create policy payments_insert_own on public.payments for insert
  with check (owner_id = auth.uid() and status = 'in_review'
    and reviewed_by is null and reviewed_at is null and provider_transaction_id is null);
create policy payments_admin on public.payments for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Medios de pago: los usuarios ven los activos; el admin los gestiona.
create policy payment_methods_select on public.payment_methods_config for select
  to authenticated using (active or public.is_platform_admin());
create policy payment_methods_admin on public.payment_methods_config for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
