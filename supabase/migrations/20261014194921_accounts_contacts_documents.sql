-- Fase 1 del SaaS: cuentas, clientes/proveedores, pendientes ("Me deben" /
-- "Debo"), transferencias y cuentas de cobro / cotizaciones (sin factura
-- electrónica, D3). No destructiva.

-- ---------------------------------------------------------------------------
-- 1. Cuentas (banco, efectivo, tarjeta, billetera)
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('bank', 'cash', 'card', 'wallet')),
  opening_balance numeric(18,2) not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint accounts_id_workspace_key unique (id, workspace_id)
);
create index accounts_workspace_id_idx on public.accounts(workspace_id);

-- ---------------------------------------------------------------------------
-- 2. Clientes y proveedores
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('client', 'supplier', 'both')),
  name text not null check (char_length(name) between 1 and 120),
  document text,
  email text,
  phone text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint contacts_id_workspace_key unique (id, workspace_id)
);
create index contacts_workspace_id_idx on public.contacts(workspace_id);

-- ---------------------------------------------------------------------------
-- 3. Movimientos: cuenta, contacto y estado pagado/pendiente
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column account_id uuid,
  add column contact_id uuid,
  add column status text not null default 'paid' check (status in ('paid', 'pending')),
  add column due_date date,
  add constraint transactions_account_fkey foreign key (account_id, workspace_id)
    references public.accounts(id, workspace_id) on delete set null (account_id),
  add constraint transactions_contact_fkey foreign key (contact_id, workspace_id)
    references public.contacts(id, workspace_id) on delete set null (contact_id),
  add constraint transactions_id_workspace_key unique (id, workspace_id);
create index transactions_pending_idx on public.transactions(workspace_id, due_date)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 4. Transferencias entre cuentas (no son ingreso ni gasto)
-- ---------------------------------------------------------------------------
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount numeric(18,2) not null check (amount > 0),
  date date not null,
  description text not null default '',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint transfers_distinct_accounts check (from_account_id <> to_account_id),
  constraint transfers_from_fkey foreign key (from_account_id, workspace_id)
    references public.accounts(id, workspace_id) on delete cascade,
  constraint transfers_to_fkey foreign key (to_account_id, workspace_id)
    references public.accounts(id, workspace_id) on delete cascade
);
create index transfers_workspace_date_idx on public.transfers(workspace_id, date desc);

-- ---------------------------------------------------------------------------
-- 5. Cotizaciones y cuentas de cobro (PDF sin validez de factura electrónica)
-- ---------------------------------------------------------------------------
create table public.collection_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('quote', 'collection')),
  number integer not null,
  contact_id uuid,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'issued' check (status in ('draft', 'issued', 'paid', 'void')),
  notes text not null default '',
  external_invoice_number text,
  total numeric(18,2) not null default 0 check (total >= 0),
  transaction_id uuid,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint collection_documents_number_key unique (workspace_id, kind, number),
  constraint collection_documents_id_workspace_key unique (id, workspace_id),
  constraint collection_documents_contact_fkey foreign key (contact_id, workspace_id)
    references public.contacts(id, workspace_id) on delete set null (contact_id),
  constraint collection_documents_transaction_fkey foreign key (transaction_id, workspace_id)
    references public.transactions(id, workspace_id) on delete set null (transaction_id)
);
create index collection_documents_workspace_idx on public.collection_documents(workspace_id, issue_date desc);

create table public.collection_document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  workspace_id uuid not null,
  position integer not null default 0,
  description text not null check (char_length(description) between 1 and 300),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  constraint collection_document_items_document_fkey foreign key (document_id, workspace_id)
    references public.collection_documents(id, workspace_id) on delete cascade
);
create index collection_document_items_document_idx on public.collection_document_items(document_id);

-- Numeración consecutiva por negocio y tipo, asignada por el servidor.
create table public.workspace_counters (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null,
  last_number integer not null default 0,
  primary key (workspace_id, kind)
);

create function public.assign_document_number()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.workspace_counters as c (workspace_id, kind, last_number)
  values (new.workspace_id, new.kind, 1)
  on conflict (workspace_id, kind) do update set last_number = c.last_number + 1
  returning last_number into new.number;
  return new;
end;
$$;

create trigger collection_documents_number
  before insert on public.collection_documents
  for each row execute function public.assign_document_number();

revoke execute on function public.assign_document_number() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Cuentas por defecto para negocios nuevos y existentes
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.memberships (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  insert into public.accounts (workspace_id, name, kind) values
    (new.id, 'Efectivo', 'cash'),
    (new.id, 'Cuenta bancaria', 'bank');

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

revoke execute on function public.handle_new_workspace() from public, anon, authenticated;

insert into public.accounts (workspace_id, name, kind)
select w.id, a.name, a.kind
from public.workspaces w
cross join (values ('Efectivo', 'cash'), ('Cuenta bancaria', 'bank')) as a(name, kind)
where not exists (select 1 from public.accounts x where x.workspace_id = w.id);

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
--    Lectura: todos los miembros para cuentas/contactos (el rol "solo
--    registro" los necesita para registrar gastos); dueño/admin/editor/contador
--    para transferencias y documentos. Escritura: dueño, admin y editor.
-- ---------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.transfers enable row level security;
alter table public.collection_documents enable row level security;
alter table public.collection_document_items enable row level security;
alter table public.workspace_counters enable row level security;

create policy accounts_select on public.accounts for select
  using (public.is_workspace_member(workspace_id));
create policy accounts_manage on public.accounts for all
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]));

create policy contacts_select on public.contacts for select
  using (public.is_workspace_member(workspace_id));
create policy contacts_manage on public.contacts for all
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]));

create policy transfers_select on public.transfers for select
  using (public.has_workspace_role(workspace_id, array['accountant']::public.workspace_role[]));
create policy transfers_manage on public.transfers for all
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]));

create policy collection_documents_select on public.collection_documents for select
  using (public.has_workspace_role(workspace_id, array['accountant']::public.workspace_role[]));
create policy collection_documents_manage on public.collection_documents for all
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]));

create policy collection_document_items_select on public.collection_document_items for select
  using (public.has_workspace_role(workspace_id, array['accountant']::public.workspace_role[]));
create policy collection_document_items_manage on public.collection_document_items for all
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]));
-- workspace_counters: sin políticas; solo lo usa el trigger (SECURITY DEFINER).
