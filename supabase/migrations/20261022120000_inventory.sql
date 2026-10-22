-- Bloque 1 del módulo de inventario: productos, categorías de producto,
-- entradas de mercancía, ajustes, kardex, costo promedio e importación.
-- El kardex (stock_movements) es la fuente de verdad; products.stock solo lo
-- cambian las funciones de este archivo. No destructiva.

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------
create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  constraint product_categories_id_workspace_key unique (id, workspace_id)
);
create unique index product_categories_name_key on public.product_categories(workspace_id, lower(name));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  barcode text check (barcode is null or char_length(barcode) between 1 and 64),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  category_id uuid,
  unit text not null default 'unidad' check (unit in ('unidad', 'caja', 'kg', 'g', 'litro', 'ml', 'metro')),
  price_cash numeric(18,2) not null default 0 check (price_cash >= 0),
  price_credit numeric(18,2) not null default 0 check (price_credit >= 0),
  stock numeric(14,3) not null default 0 check (stock >= 0),
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_id_workspace_key unique (id, workspace_id),
  constraint products_category_fkey foreign key (category_id, workspace_id)
    references public.product_categories(id, workspace_id) on delete set null (category_id),
  constraint products_integer_units check (
    unit not in ('unidad', 'caja') or (stock = trunc(stock) and min_stock = trunc(min_stock)))
);
create unique index products_barcode_key on public.products(workspace_id, barcode) where barcode is not null;
create index products_workspace_name_idx on public.products(workspace_id, lower(name));
create index products_category_idx on public.products(category_id);

-- Costo promedio ponderado, separado de products para ocultarlo con RLS.
create table public.product_costs (
  product_id uuid primary key,
  workspace_id uuid not null,
  avg_cost numeric(18,2) not null default 0 check (avg_cost >= 0),
  updated_at timestamptz not null default now(),
  constraint product_costs_product_fkey foreign key (product_id, workspace_id)
    references public.products(id, workspace_id) on delete cascade
);
create index product_costs_workspace_idx on public.product_costs(workspace_id);

create table public.stock_receipts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  number integer not null,
  supplier_id uuid,
  date date not null default current_date,
  status text not null default 'complete' check (status in ('complete', 'pending_cost')),
  total_cost numeric(18,2) check (total_cost is null or total_cost >= 0),
  transaction_id uuid,
  notes text not null default '',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_receipts_number_key unique (workspace_id, number),
  constraint stock_receipts_id_workspace_key unique (id, workspace_id),
  constraint stock_receipts_supplier_fkey foreign key (supplier_id, workspace_id)
    references public.contacts(id, workspace_id) on delete set null (supplier_id),
  constraint stock_receipts_transaction_fkey foreign key (transaction_id, workspace_id)
    references public.transactions(id, workspace_id) on delete set null (transaction_id)
);
create index stock_receipts_workspace_idx on public.stock_receipts(workspace_id, date desc);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null,
  kind text not null check (kind in ('opening', 'receipt', 'adjustment', 'sale', 'sale_void')),
  quantity numeric(14,3) not null check (quantity <> 0),
  stock_after numeric(14,3) not null check (stock_after >= 0),
  unit_cost numeric(18,2),
  avg_cost_after numeric(18,2),
  reason text check (reason in ('damage', 'loss', 'count', 'other')),
  note text,
  receipt_id uuid,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_movements_reason_kind_check check ((kind = 'adjustment') = (reason is not null)),
  constraint stock_movements_product_fkey foreign key (product_id, workspace_id)
    references public.products(id, workspace_id) on delete cascade,
  constraint stock_movements_receipt_fkey foreign key (receipt_id, workspace_id)
    references public.stock_receipts(id, workspace_id)
);
create index stock_movements_product_idx on public.stock_movements(product_id, id desc);
create index stock_movements_receipt_idx on public.stock_movements(receipt_id) where receipt_id is not null;
create index stock_movements_workspace_idx on public.stock_movements(workspace_id, created_at desc);

create table public.product_price_changes (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  old_cash numeric(18,2) not null,
  new_cash numeric(18,2) not null,
  old_credit numeric(18,2) not null,
  new_credit numeric(18,2) not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index product_price_changes_product_idx on public.product_price_changes(product_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- 2. Triggers: protección de stock, costos, precios, borrado
-- ---------------------------------------------------------------------------
create function public.products_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.stock <> 0 then
      raise exception 'STOCK_SOLO_POR_FUNCION';
    end if;
  else
    if new.workspace_id <> old.workspace_id then
      raise exception 'SIN_PERMISO';
    end if;
    if new.stock is distinct from old.stock
       and coalesce(current_setting('app.inventory_write', true), '') <> 'on' then
      raise exception 'STOCK_SOLO_POR_FUNCION';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger products_guard before insert or update on public.products
  for each row execute function public.products_guard();

create function public.products_after_insert()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.product_costs (product_id, workspace_id) values (new.id, new.workspace_id);
  return new;
end;
$$;
create trigger products_after_insert after insert on public.products
  for each row execute function public.products_after_insert();

create function public.products_price_history()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.price_cash is distinct from old.price_cash or new.price_credit is distinct from old.price_credit then
    insert into public.product_price_changes
      (workspace_id, product_id, old_cash, new_cash, old_credit, new_credit, changed_by)
    values (new.workspace_id, new.id, old.price_cash, new.price_cash, old.price_credit, new.price_credit, auth.uid());
  end if;
  return new;
end;
$$;
create trigger products_price_history after update on public.products
  for each row execute function public.products_price_history();

-- Un producto con movimientos no se borra (se desactiva). Si se borra el
-- negocio completo, el borrado en cascada sí se permite.
create function public.products_no_delete_with_movements()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.stock_movements where product_id = old.id)
     and exists (select 1 from public.workspaces where id = old.workspace_id) then
    raise exception 'PRODUCTO_CON_MOVIMIENTOS';
  end if;
  return old;
end;
$$;
create trigger products_no_delete before delete on public.products
  for each row execute function public.products_no_delete_with_movements();

revoke execute on function public.products_guard() from public, anon, authenticated;
revoke execute on function public.products_after_insert() from public, anon, authenticated;
revoke execute on function public.products_price_history() from public, anon, authenticated;
revoke execute on function public.products_no_delete_with_movements() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Límite de plan: productos activos (insert y reactivación)
-- ---------------------------------------------------------------------------
insert into public.plan_limits (plan_code, key, value) values
  ('gratis',      'max_active_products', '30'),
  ('emprendedor', 'max_active_products', 'null'),
  ('negocio',     'max_active_products', 'null'),
  ('pro',         'max_active_products', 'null')
on conflict (plan_code, key) do nothing;

create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_limit jsonb;
  v_count integer;
begin
  if tg_table_name = 'workspaces' then
    v_limit := public.plan_limit(new.owner_id, 'max_workspaces_owned');
    select count(*) into v_count from public.workspaces where owner_id = new.owner_id;
    if v_limit is not null and v_limit <> 'null'::jsonb and v_count >= (v_limit #>> '{}')::int then
      raise exception 'LIMITE_PLAN:max_workspaces_owned';
    end if;

  elsif tg_table_name = 'memberships' then
    if new.role = 'owner' then return new; end if;
    select owner_id into v_owner from public.workspaces where id = new.workspace_id;
    v_limit := public.plan_limit(v_owner, 'max_members');
    select count(*) into v_count from public.memberships where workspace_id = new.workspace_id;
    if v_limit is not null and v_limit <> 'null'::jsonb and v_count >= (v_limit #>> '{}')::int then
      raise exception 'LIMITE_PLAN:max_members';
    end if;

  elsif tg_table_name = 'transactions' then
    select owner_id into v_owner from public.workspaces where id = new.workspace_id;
    v_limit := public.plan_limit(v_owner, 'max_tx_per_month');
    if v_limit is not null and v_limit <> 'null'::jsonb then
      select count(*) into v_count from public.transactions t join public.workspaces w on w.id = t.workspace_id
      where w.owner_id = v_owner and t.created_at >= date_trunc('month', now());
      if v_count >= (v_limit #>> '{}')::int then
        raise exception 'LIMITE_PLAN:max_tx_per_month';
      end if;
    end if;

  elsif tg_table_name = 'collection_documents' then
    if new.kind <> 'collection' then return new; end if;
    select owner_id into v_owner from public.workspaces where id = new.workspace_id;
    v_limit := public.plan_limit(v_owner, 'max_collection_docs_per_month');
    if v_limit is not null and v_limit <> 'null'::jsonb then
      select count(*) into v_count from public.collection_documents d join public.workspaces w on w.id = d.workspace_id
      where w.owner_id = v_owner and d.kind = 'collection' and d.created_at >= date_trunc('month', now());
      if v_count >= (v_limit #>> '{}')::int then
        raise exception 'LIMITE_PLAN:max_collection_docs_per_month';
      end if;
    end if;

  elsif tg_table_name = 'products' then
    -- Solo cuenta al crear activo o al reactivar; el producto actual aún está inactivo.
    select owner_id into v_owner from public.workspaces where id = new.workspace_id;
    v_limit := public.plan_limit(v_owner, 'max_active_products');
    if v_limit is not null and v_limit <> 'null'::jsonb then
      perform pg_advisory_xact_lock(hashtextextended('max_active_products:' || v_owner::text, 0));
      select count(*) into v_count from public.products p join public.workspaces w on w.id = p.workspace_id
      where w.owner_id = v_owner and p.active;
      if v_count >= (v_limit #>> '{}')::int then
        raise exception 'LIMITE_PLAN:max_active_products';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger products_plan_limits_insert before insert on public.products
  for each row when (new.active) execute function public.enforce_plan_limits();
create trigger products_plan_limits_reactivate before update of active on public.products
  for each row when (new.active and not old.active) execute function public.enforce_plan_limits();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
--    Productos y categorías: leen todos los miembros; escriben dueño, admin y
--    editor. Costos, kardex, entradas e historial de precios: dueño, admin,
--    editor y contador. Esas tablas solo se escriben con las funciones.
-- ---------------------------------------------------------------------------
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.stock_receipts enable row level security;
alter table public.stock_movements enable row level security;
alter table public.product_price_changes enable row level security;

create policy product_categories_select on public.product_categories for select
  using (public.is_workspace_member(workspace_id));
create policy product_categories_manage on public.product_categories for all
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]));

create policy products_select on public.products for select
  using (public.is_workspace_member(workspace_id));
create policy products_manage on public.products for all
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]));

create policy product_costs_select on public.product_costs for select
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor', 'accountant']::public.workspace_role[]));
create policy stock_receipts_select on public.stock_receipts for select
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor', 'accountant']::public.workspace_role[]));
create policy stock_movements_select on public.stock_movements for select
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor', 'accountant']::public.workspace_role[]));
create policy product_price_changes_select on public.product_price_changes for select
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor', 'accountant']::public.workspace_role[]));

-- Defensa en profundidad: sin escritura directa en las tablas que manejan las funciones.
revoke insert, update, delete, truncate on public.product_costs from anon, authenticated;
revoke insert, update, delete, truncate on public.stock_receipts from anon, authenticated;
revoke insert, update, delete, truncate on public.stock_movements from anon, authenticated;
revoke insert, update, delete, truncate on public.product_price_changes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Ayudantes internos (no expuestos)
-- ---------------------------------------------------------------------------
create function public.inv_valid_qty(p_unit text, p_qty numeric, p_allow_zero boolean default false)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_qty is not null
    and (p_qty > 0 or (p_allow_zero and p_qty = 0))
    and p_qty < 10000000000
    and case when p_unit in ('unidad', 'caja') then p_qty = trunc(p_qty) else p_qty = round(p_qty, 3) end;
$$;

create function public.inv_next_counter(p_workspace uuid, p_kind text)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v integer;
begin
  insert into public.workspace_counters as c (workspace_id, kind, last_number)
  values (p_workspace, p_kind, 1)
  on conflict (workspace_id, kind) do update set last_number = c.last_number + 1
  returning last_number into v;
  return v;
end;
$$;

-- Aplica un movimiento a un producto ya bloqueado con "for update".
create function public.inv_move(
  p_product uuid, p_kind text, p_qty numeric, p_unit_cost numeric, p_new_avg numeric,
  p_reason text, p_note text, p_receipt uuid
) returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  p public.products;
  v_stock numeric;
  v_avg numeric;
begin
  select * into p from public.products where id = p_product;
  v_stock := p.stock + p_qty;
  if v_stock < 0 then
    raise exception 'STOCK_NEGATIVO';
  end if;

  select avg_cost into v_avg from public.product_costs where product_id = p_product;
  if p_new_avg is not null then
    v_avg := p_new_avg;
    update public.product_costs set avg_cost = p_new_avg, updated_at = now() where product_id = p_product;
  end if;

  perform set_config('app.inventory_write', 'on', true);
  update public.products set stock = v_stock where id = p_product;
  perform set_config('app.inventory_write', 'off', true);

  insert into public.stock_movements
    (workspace_id, product_id, kind, quantity, stock_after, unit_cost, avg_cost_after, reason, note, receipt_id)
  values (p.workspace_id, p_product, p_kind, p_qty, v_stock, p_unit_cost, v_avg, p_reason, p_note, p_receipt);
end;
$$;

-- Gasto de una entrada en "Compras e inventario". Devuelve null si no se pide
-- o si el total es 0.
create function public.inv_create_expense(
  p_workspace uuid, p_supplier uuid, p_date date, p_total numeric, p_number integer, p_expense jsonb
) returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_status text;
  v_account uuid;
  v_due date;
  v_cat uuid;
  v_tx uuid;
begin
  if coalesce((p_expense->>'create')::boolean, false) is not true or coalesce(p_total, 0) <= 0 then
    return null;
  end if;
  v_status := coalesce(p_expense->>'status', 'paid');
  if v_status not in ('paid', 'pending') then
    raise exception 'ESTADO_INVALIDO';
  end if;
  v_account := nullif(p_expense->>'account_id', '')::uuid;
  v_due := nullif(p_expense->>'due_date', '')::date;
  if v_status = 'paid' and v_account is null then
    raise exception 'CUENTA_REQUERIDA';
  end if;

  select id into v_cat from public.categories
  where workspace_id = p_workspace and type = 'expense' and name = 'Compras e inventario'
  order by created_at limit 1;
  if v_cat is null then
    insert into public.categories (workspace_id, name, icon, color, type, is_default)
    values (p_workspace, 'Compras e inventario', 'shopping-bag', '#eab308', 'expense', true)
    returning id into v_cat;
  end if;

  insert into public.transactions
    (workspace_id, type, amount, category_id, description, date, account_id, contact_id, status, due_date)
  values (p_workspace, 'expense', p_total, v_cat, 'Entrada de mercancía #' || p_number, p_date,
          v_account, p_supplier, v_status, case when v_status = 'pending' then v_due end)
  returning id into v_tx;
  return v_tx;
end;
$$;

revoke execute on function public.inv_valid_qty(text, numeric, boolean) from public, anon, authenticated;
revoke execute on function public.inv_next_counter(uuid, text) from public, anon, authenticated;
revoke execute on function public.inv_move(uuid, text, numeric, numeric, numeric, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.inv_create_expense(uuid, uuid, date, numeric, integer, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Funciones expuestas (RPC)
-- ---------------------------------------------------------------------------

-- Entrada de mercancía. Líneas: [{product_id, quantity, unit_cost|null}].
create function public.inventory_receive(
  p_workspace uuid, p_supplier uuid, p_date date, p_lines jsonb, p_expense jsonb
) returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_full boolean;
  v_ids uuid[];
  v_receipt uuid;
  v_number integer;
  v_all_costed boolean := true;
  v_total numeric := 0;
  v_tx uuid;
  r record;
  p public.products;
  v_cost numeric;
  v_avg numeric;
  v_new_avg numeric;
begin
  if not public.has_workspace_role(p_workspace,
       array['owner', 'admin', 'editor', 'recorder']::public.workspace_role[]) then
    raise exception 'SIN_PERMISO';
  end if;
  v_full := public.has_workspace_role(p_workspace, array['owner', 'admin', 'editor']::public.workspace_role[]);

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'CANTIDAD_INVALIDA';
  end if;

  -- Bloqueo en orden de id para que entradas simultáneas no se crucen.
  select array_agg(distinct (l->>'product_id')::uuid) into v_ids from jsonb_array_elements(p_lines) l;
  perform 1 from public.products where id = any (v_ids) and workspace_id = p_workspace order by id for update;
  if (select count(*) from public.products where id = any (v_ids) and workspace_id = p_workspace)
     <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'PRODUCTO_NO_ENCONTRADO';
  end if;

  -- Validación completa antes de escribir.
  for r in
    select (l->>'product_id')::uuid as product_id, (l->>'quantity')::numeric as quantity,
           case when v_full then (l->>'unit_cost')::numeric end as unit_cost
    from jsonb_array_elements(p_lines) l
  loop
    select * into p from public.products where id = r.product_id;
    if not public.inv_valid_qty(p.unit, r.quantity) then
      raise exception 'CANTIDAD_INVALIDA';
    end if;
    if r.unit_cost is null then
      v_all_costed := false;
    elsif r.unit_cost < 0 or r.unit_cost >= 100000000000000 then
      raise exception 'COSTO_INVALIDO';
    else
      v_total := v_total + round(r.quantity * r.unit_cost, 2);
    end if;
  end loop;

  v_number := public.inv_next_counter(p_workspace, 'stock_receipt');
  insert into public.stock_receipts (workspace_id, number, supplier_id, date, status, total_cost)
  values (p_workspace, v_number, p_supplier, coalesce(p_date, current_date),
          case when v_all_costed then 'complete' else 'pending_cost' end,
          case when v_all_costed then v_total end)
  returning id into v_receipt;

  if v_all_costed then
    v_tx := public.inv_create_expense(p_workspace, p_supplier, coalesce(p_date, current_date),
                                      v_total, v_number, p_expense);
    if v_tx is not null then
      update public.stock_receipts set transaction_id = v_tx where id = v_receipt;
    end if;
  end if;

  for r in
    select (l->>'product_id')::uuid as product_id, (l->>'quantity')::numeric as quantity,
           case when v_full then (l->>'unit_cost')::numeric end as unit_cost
    from jsonb_array_elements(p_lines) with ordinality as t(l, n)
    order by n
  loop
    select * into p from public.products where id = r.product_id;
    v_new_avg := null;
    if r.unit_cost is not null then
      select avg_cost into v_avg from public.product_costs where product_id = r.product_id;
      v_new_avg := round((p.stock * v_avg + r.quantity * r.unit_cost) / (p.stock + r.quantity), 2);
    end if;
    perform public.inv_move(r.product_id, 'receipt', r.quantity, r.unit_cost, v_new_avg, null, null, v_receipt);
  end loop;

  return v_receipt;
end;
$$;

-- Completa el costo de una entrada "pending_cost". Costos: [{product_id, unit_cost}].
create function public.inventory_complete_receipt(p_receipt uuid, p_costs jsonb, p_expense jsonb)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  rc public.stock_receipts;
  m record;
  p public.products;
  v_cost numeric;
  v_avg numeric;
  v_eff numeric;
  v_new_avg numeric;
  v_total numeric;
  v_tx uuid;
begin
  select * into rc from public.stock_receipts where id = p_receipt for update;
  if not found or not public.has_workspace_role(rc.workspace_id,
       array['owner', 'admin', 'editor']::public.workspace_role[]) then
    raise exception 'SIN_PERMISO';
  end if;
  if rc.status <> 'pending_cost' then
    raise exception 'ENTRADA_COMPLETA';
  end if;
  if p_costs is null or jsonb_typeof(p_costs) <> 'array' then
    raise exception 'COSTO_REQUERIDO';
  end if;

  perform 1 from public.products
  where id in (select product_id from public.stock_movements where receipt_id = p_receipt)
  order by id for update;

  -- Validar que cada línea sin costo tenga uno válido.
  for m in
    select sm.product_id from public.stock_movements sm
    where sm.receipt_id = p_receipt and sm.unit_cost is null
  loop
    select (c->>'unit_cost')::numeric into v_cost
    from jsonb_array_elements(p_costs) c where (c->>'product_id')::uuid = m.product_id limit 1;
    if v_cost is null then
      raise exception 'COSTO_REQUERIDO';
    elsif v_cost < 0 or v_cost >= 100000000000000 then
      raise exception 'COSTO_INVALIDO';
    end if;
  end loop;

  for m in
    select sm.id, sm.product_id, sm.quantity from public.stock_movements sm
    where sm.receipt_id = p_receipt and sm.unit_cost is null order by sm.id
  loop
    select (c->>'unit_cost')::numeric into v_cost
    from jsonb_array_elements(p_costs) c where (c->>'product_id')::uuid = m.product_id limit 1;
    select * into p from public.products where id = m.product_id;
    select avg_cost into v_avg from public.product_costs where product_id = m.product_id;

    -- Costo tardío: avg + q·(c − avg)/stock_actual. Si ya salió parte de esas
    -- unidades, q se limita al stock actual para que el promedio no se salga de [avg, c].
    if p.stock > 0 then
      v_eff := least(m.quantity, p.stock);
      v_new_avg := round(v_avg + v_eff * (v_cost - v_avg) / p.stock, 2);
    else
      v_new_avg := round(v_cost, 2);
    end if;

    update public.product_costs set avg_cost = v_new_avg, updated_at = now() where product_id = m.product_id;
    update public.stock_movements set unit_cost = v_cost where id = m.id;
  end loop;

  select coalesce(sum(round(quantity * unit_cost, 2)), 0) into v_total
  from public.stock_movements where receipt_id = p_receipt;

  if rc.transaction_id is null then
    v_tx := public.inv_create_expense(rc.workspace_id, rc.supplier_id, rc.date, v_total, rc.number, p_expense);
  end if;

  update public.stock_receipts
    set status = 'complete', total_cost = v_total, transaction_id = coalesce(v_tx, transaction_id)
    where id = p_receipt;
end;
$$;

-- Ajuste manual: 'count' (conteo físico) o 'out' (salida). Solo dueño y admin.
create function public.inventory_adjust(
  p_product uuid, p_mode text, p_quantity numeric, p_reason text, p_note text
) returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  p public.products;
  v_reason text;
  v_delta numeric;
begin
  select * into p from public.products where id = p_product for update;
  if not found or not public.has_workspace_role(p.workspace_id, array['owner', 'admin']::public.workspace_role[]) then
    raise exception 'SIN_PERMISO';
  end if;
  if p_mode not in ('count', 'out') then
    raise exception 'CANTIDAD_INVALIDA';
  end if;

  v_reason := coalesce(nullif(btrim(p_reason), ''), case when p_mode = 'count' then 'count' end);
  if v_reason is null or v_reason not in ('damage', 'loss', 'count', 'other') then
    raise exception 'MOTIVO_REQUERIDO';
  end if;

  if not public.inv_valid_qty(p.unit, p_quantity, p_mode = 'count') then
    raise exception 'CANTIDAD_INVALIDA';
  end if;

  v_delta := case p_mode when 'count' then p_quantity - p.stock else -p_quantity end;
  if v_delta = 0 then
    return;
  end if;

  perform public.inv_move(p_product, 'adjustment', v_delta, null, null, v_reason, nullif(btrim(p_note), ''), null);
end;
$$;

-- Stock inicial: solo si el producto aún no tiene movimientos.
create function public.inventory_set_opening(p_product uuid, p_quantity numeric, p_unit_cost numeric)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  p public.products;
  v_cost numeric := coalesce(p_unit_cost, 0);
begin
  select * into p from public.products where id = p_product for update;
  if not found or not public.has_workspace_role(p.workspace_id,
       array['owner', 'admin', 'editor']::public.workspace_role[]) then
    raise exception 'SIN_PERMISO';
  end if;
  if exists (select 1 from public.stock_movements where product_id = p_product) then
    raise exception 'PRODUCTO_CON_MOVIMIENTOS';
  end if;
  if not public.inv_valid_qty(p.unit, p_quantity, true) then
    raise exception 'CANTIDAD_INVALIDA';
  end if;
  if v_cost < 0 or v_cost >= 100000000000000 then
    raise exception 'COSTO_INVALIDO';
  end if;

  if p_quantity = 0 then
    update public.product_costs set avg_cost = round(v_cost, 2), updated_at = now() where product_id = p_product;
  else
    perform public.inv_move(p_product, 'opening', p_quantity, round(v_cost, 2), round(v_cost, 2), null, null, null);
  end if;
end;
$$;

-- Importación de catálogo. Todo o nada: con un solo error no guarda nada.
-- "row" es la posición (desde 1) de la fila dentro de p_rows.
create function public.inventory_import(p_workspace uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_errors jsonb := '[]'::jsonb;
  v_seen text[] := array[]::text[];
  v_created integer := 0;
  r record;
  v_barcode text;
  v_name text;
  v_unit text;
  v_cat text;
  v_cash numeric;
  v_credit numeric;
  v_cost numeric;
  v_stock numeric;
  v_min numeric;
  v_cat_id uuid;
  v_product uuid;
  v_bad boolean;
begin
  if not public.has_workspace_role(p_workspace, array['owner', 'admin', 'editor']::public.workspace_role[]) then
    raise exception 'SIN_PERMISO';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('ok', false, 'errors',
      jsonb_build_array(jsonb_build_object('row', 0, 'message', 'No hay filas para importar.')));
  end if;

  -- Pasada 1: validar todo.
  for r in select l, n from jsonb_array_elements(p_rows) with ordinality as t(l, n) order by n loop
    v_bad := false;
    v_name := btrim(coalesce(r.l->>'name', ''));
    v_barcode := nullif(btrim(coalesce(r.l->>'barcode', '')), '');
    v_unit := coalesce(nullif(btrim(coalesce(r.l->>'unit', '')), ''), 'unidad');

    if v_name = '' then
      v_errors := v_errors || jsonb_build_object('row', r.n, 'message', 'Falta el nombre.');
    end if;
    if v_unit not in ('unidad', 'caja', 'kg', 'g', 'litro', 'ml', 'metro') then
      v_errors := v_errors || jsonb_build_object('row', r.n, 'message', 'Unidad no válida: ' || v_unit || '.');
      v_bad := true;
    end if;

    begin
      v_cash := coalesce(nullif(r.l->>'price_cash', '')::numeric, 0);
      v_credit := coalesce(nullif(r.l->>'price_credit', '')::numeric, v_cash);
      v_cost := coalesce(nullif(r.l->>'cost', '')::numeric, 0);
      v_stock := coalesce(nullif(r.l->>'stock', '')::numeric, 0);
      v_min := coalesce(nullif(r.l->>'min_stock', '')::numeric, 0);
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', r.n, 'message', 'Hay un número que no se entiende.');
      v_bad := true;
    end;

    if not v_bad then
      if v_cash < 0 or v_credit < 0 or v_cost < 0 or v_stock < 0 or v_min < 0 then
        v_errors := v_errors || jsonb_build_object('row', r.n, 'message', 'No se permiten números negativos.');
      elsif v_cash >= 1e16 or v_credit >= 1e16 or v_cost >= 1e16 or v_stock >= 1e10 or v_min >= 1e10 then
        v_errors := v_errors || jsonb_build_object('row', r.n, 'message', 'Un número es demasiado grande.');
      elsif not public.inv_valid_qty(v_unit, v_stock, true) or not public.inv_valid_qty(v_unit, v_min, true) then
        v_errors := v_errors || jsonb_build_object('row', r.n, 'message',
          'CANTIDAD_INVALIDA: la unidad ' || v_unit || ' no admite esos decimales.');
      end if;
    end if;

    if v_barcode is not null then
      if v_barcode = any (v_seen) then
        v_errors := v_errors || jsonb_build_object('row', r.n, 'message',
          'CODIGO_DUPLICADO: el código ' || v_barcode || ' está repetido en el archivo.');
      elsif exists (select 1 from public.products where workspace_id = p_workspace and barcode = v_barcode) then
        v_errors := v_errors || jsonb_build_object('row', r.n, 'message',
          'CODIGO_DUPLICADO: el código ' || v_barcode || ' ya existe en el negocio.');
      end if;
      v_seen := v_seen || v_barcode;
    end if;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object('ok', false, 'errors', v_errors);
  end if;

  -- Pasada 2: guardar.
  for r in select l, n from jsonb_array_elements(p_rows) with ordinality as t(l, n) order by n loop
    v_name := btrim(r.l->>'name');
    v_barcode := nullif(btrim(coalesce(r.l->>'barcode', '')), '');
    v_unit := coalesce(nullif(btrim(coalesce(r.l->>'unit', '')), ''), 'unidad');
    v_cat := nullif(btrim(coalesce(r.l->>'category', '')), '');
    v_cash := coalesce(nullif(r.l->>'price_cash', '')::numeric, 0);
    v_credit := coalesce(nullif(r.l->>'price_credit', '')::numeric, v_cash);
    v_cost := coalesce(nullif(r.l->>'cost', '')::numeric, 0);
    v_stock := coalesce(nullif(r.l->>'stock', '')::numeric, 0);
    v_min := coalesce(nullif(r.l->>'min_stock', '')::numeric, 0);

    v_cat_id := null;
    if v_cat is not null then
      select id into v_cat_id from public.product_categories
      where workspace_id = p_workspace and lower(name) = lower(v_cat);
      if v_cat_id is null then
        insert into public.product_categories (workspace_id, name) values (p_workspace, v_cat)
        returning id into v_cat_id;
      end if;
    end if;

    insert into public.products
      (workspace_id, barcode, name, category_id, unit, price_cash, price_credit, min_stock)
    values (p_workspace, v_barcode, v_name, v_cat_id, v_unit, v_cash, v_credit, v_min)
    returning id into v_product;

    if v_stock > 0 then
      perform public.inv_move(v_product, 'opening', v_stock, round(v_cost, 2), round(v_cost, 2), null, null, null);
    elsif v_cost > 0 then
      update public.product_costs set avg_cost = round(v_cost, 2), updated_at = now() where product_id = v_product;
    end if;
    v_created := v_created + 1;
  end loop;

  return jsonb_build_object('ok', true, 'created', v_created);
end;
$$;

-- Código interno EAN-13: '20' + consecutivo de 10 dígitos + dígito de control GS1.
create function public.inventory_next_internal_barcode(p_workspace uuid)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  v_body text;
  v_sum integer;
  v_code text;
begin
  if not public.has_workspace_role(p_workspace, array['owner', 'admin', 'editor']::public.workspace_role[]) then
    raise exception 'SIN_PERMISO';
  end if;
  loop
    v_body := '20' || lpad(public.inv_next_counter(p_workspace, 'internal_barcode')::text, 10, '0');
    -- Pesos 3,1,3,1... contados desde el dígito más a la derecha del cuerpo.
    select sum(substr(v_body, i, 1)::int * case when (12 - i) % 2 = 0 then 3 else 1 end) into v_sum
    from generate_series(1, 12) i;
    v_code := v_body || ((10 - v_sum % 10) % 10)::text;
    exit when not exists (select 1 from public.products where workspace_id = p_workspace and barcode = v_code);
  end loop;
  return v_code;
end;
$$;

revoke execute on function public.inventory_receive(uuid, uuid, date, jsonb, jsonb) from public, anon;
revoke execute on function public.inventory_complete_receipt(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.inventory_adjust(uuid, text, numeric, text, text) from public, anon;
revoke execute on function public.inventory_set_opening(uuid, numeric, numeric) from public, anon;
revoke execute on function public.inventory_import(uuid, jsonb) from public, anon;
revoke execute on function public.inventory_next_internal_barcode(uuid) from public, anon;
grant execute on function public.inventory_receive(uuid, uuid, date, jsonb, jsonb) to authenticated;
grant execute on function public.inventory_complete_receipt(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.inventory_adjust(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.inventory_set_opening(uuid, numeric, numeric) to authenticated;
grant execute on function public.inventory_import(uuid, jsonb) to authenticated;
grant execute on function public.inventory_next_internal_barcode(uuid) to authenticated;
