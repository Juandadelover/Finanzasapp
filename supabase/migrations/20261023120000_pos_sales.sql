-- Bloque 2: venta (POS). Ventas, líneas, pagos, costos por línea y funciones
-- atómicas para confirmar y anular. No destructiva.

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------------
alter table public.workspaces
  add column pos_max_discount_pct numeric(5,2) not null default 10
    check (pos_max_discount_pct between 0 and 100),
  add column pos_allow_negative_stock boolean not null default false;

alter table public.contacts add column address text;

-- El stock negativo es configurable por negocio: se quitan los CHECK >= 0.
-- inv_move y las demás funciones de inventario siguen rechazándolo (STOCK_NEGATIVO);
-- products_guard impide cambiar el stock fuera de las funciones.
alter table public.products drop constraint products_stock_check;
alter table public.stock_movements drop constraint stock_movements_stock_after_check;

-- ---------------------------------------------------------------------------
-- 2. Tablas
-- ---------------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  number integer not null,
  kind text not null check (kind in ('cash', 'credit')),
  contact_id uuid,
  subtotal numeric(18,2) not null check (subtotal >= 0),
  line_discount_total numeric(18,2) not null default 0 check (line_discount_total >= 0),
  total_discount numeric(18,2) not null default 0 check (total_discount >= 0),
  total numeric(18,2) not null check (total >= 0),
  paid_now numeric(18,2) not null default 0 check (paid_now >= 0),
  balance numeric(18,2) not null default 0 check (balance >= 0),
  status text not null default 'active' check (status in ('active', 'void')),
  void_reason text,
  voided_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sales_number_key unique (workspace_id, number),
  constraint sales_id_workspace_key unique (id, workspace_id),
  constraint sales_amounts_check check (balance = total - paid_now),
  constraint sales_void_check check (status = 'active' or void_reason is not null),
  constraint sales_contact_fkey foreign key (contact_id, workspace_id)
    references public.contacts(id, workspace_id) on delete set null (contact_id)
);
create index sales_workspace_idx on public.sales(workspace_id, created_at desc);
create index sales_contact_idx on public.sales(contact_id) where contact_id is not null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null,
  workspace_id uuid not null,
  position integer not null default 0,
  product_id uuid not null,
  name text not null,
  unit text not null check (unit in ('unidad', 'caja', 'kg', 'g', 'litro', 'ml', 'metro')),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  discount jsonb,
  line_total numeric(18,2) not null check (line_total >= 0),
  constraint sale_items_id_workspace_key unique (id, workspace_id),
  constraint sale_items_sale_fkey foreign key (sale_id, workspace_id)
    references public.sales(id, workspace_id) on delete cascade,
  constraint sale_items_product_fkey foreign key (product_id, workspace_id)
    references public.products(id, workspace_id)
);
create index sale_items_sale_idx on public.sale_items(sale_id);
create index sale_items_product_idx on public.sale_items(product_id);

-- Costo por línea, separado para ocultarlo al rol "solo registro" (como product_costs).
create table public.sale_item_costs (
  sale_item_id uuid primary key,
  workspace_id uuid not null,
  unit_cost numeric(18,2) not null check (unit_cost >= 0),
  constraint sale_item_costs_item_fkey foreign key (sale_item_id, workspace_id)
    references public.sale_items(id, workspace_id) on delete cascade
);
create index sale_item_costs_workspace_idx on public.sale_item_costs(workspace_id);

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null,
  workspace_id uuid not null,
  method text not null check (method in ('cash', 'transfer', 'nequi', 'daviplata', 'card')),
  account_id uuid,
  amount numeric(18,2) not null check (amount > 0),
  received numeric(18,2) not null check (received >= amount),
  change numeric(18,2) not null default 0 check (change >= 0),
  constraint sale_payments_sale_fkey foreign key (sale_id, workspace_id)
    references public.sales(id, workspace_id) on delete cascade,
  constraint sale_payments_account_fkey foreign key (account_id, workspace_id)
    references public.accounts(id, workspace_id) on delete set null (account_id)
);
create index sale_payments_sale_idx on public.sale_payments(sale_id);

-- Referencias desde finanzas y kardex para ubicar y revertir una venta.
alter table public.transactions add column sale_id uuid,
  add constraint transactions_sale_fkey foreign key (sale_id, workspace_id)
    references public.sales(id, workspace_id) on delete set null (sale_id);
create index transactions_sale_idx on public.transactions(sale_id) where sale_id is not null;

alter table public.stock_movements add column sale_id uuid,
  add constraint stock_movements_sale_fkey foreign key (sale_id, workspace_id)
    references public.sales(id, workspace_id);
create index stock_movements_sale_idx on public.stock_movements(sale_id) where sale_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_item_costs enable row level security;
alter table public.sale_payments enable row level security;

create policy sales_select on public.sales for select using (public.is_workspace_member(workspace_id));
create policy sale_items_select on public.sale_items for select using (public.is_workspace_member(workspace_id));
create policy sale_payments_select on public.sale_payments for select using (public.is_workspace_member(workspace_id));
create policy sale_item_costs_select on public.sale_item_costs for select
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor', 'accountant']::public.workspace_role[]));

revoke insert, update, delete, truncate on public.sales from anon, authenticated;
revoke insert, update, delete, truncate on public.sale_items from anon, authenticated;
revoke insert, update, delete, truncate on public.sale_item_costs from anon, authenticated;
revoke insert, update, delete, truncate on public.sale_payments from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Ayudantes internos
-- ---------------------------------------------------------------------------
-- Monto de un descuento {type: 'pct'|'amount', value} sobre una base; nunca
-- supera la base. Redondea a pesos enteros.
create function public.pos_discount_amount(p_base numeric, p_discount jsonb)
returns numeric
language plpgsql immutable set search_path = ''
as $$
declare
  v_value numeric;
  v_amount numeric;
begin
  if p_discount is null or jsonb_typeof(p_discount) <> 'object' then
    return 0;
  end if;
  v_value := coalesce((p_discount->>'value')::numeric, 0);
  if v_value < 0 then
    raise exception 'PRECIO_NEGATIVO';
  end if;
  case p_discount->>'type'
    when 'pct' then v_amount := round(p_base * v_value / 100, 0);
    when 'amount' then v_amount := round(v_value, 0);
    else raise exception 'DESCUENTO_INVALIDO';
  end case;
  return least(v_amount, p_base);
end;
$$;

-- Movimiento de stock de una venta sobre un producto ya bloqueado. A diferencia
-- de inv_move, permite stock negativo (la función que llama ya lo validó).
create function public.pos_move_stock(
  p_product uuid, p_kind text, p_qty numeric, p_unit_cost numeric, p_sale uuid
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
  select avg_cost into v_avg from public.product_costs where product_id = p_product;

  perform set_config('app.inventory_write', 'on', true);
  update public.products set stock = v_stock where id = p_product;
  perform set_config('app.inventory_write', 'off', true);

  insert into public.stock_movements
    (workspace_id, product_id, kind, quantity, stock_after, unit_cost, avg_cost_after, sale_id)
  values (p.workspace_id, p_product, p_kind, p_qty, v_stock, p_unit_cost, v_avg, p_sale);
end;
$$;

revoke execute on function public.pos_discount_amount(numeric, jsonb) from public, anon, authenticated;
revoke execute on function public.pos_move_stock(uuid, text, numeric, numeric, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Funciones expuestas (RPC)
-- ---------------------------------------------------------------------------
create function public.pos_confirm_sale(
  p_workspace uuid, p_kind text, p_contact uuid, p_lines jsonb, p_total_discount jsonb,
  p_payments jsonb, p_initial_payment jsonb, p_notes text
) returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  ws public.workspaces;
  v_limited boolean;
  v_ids uuid[];
  v_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_line_disc numeric := 0;
  v_total_disc numeric;
  v_net numeric;
  v_total numeric;
  v_paid numeric;
  v_balance numeric;
  v_sum numeric := 0;
  v_cash_sum numeric := 0;
  v_excess numeric;
  v_left numeric;
  v_sale uuid;
  v_number integer;
  v_cat uuid;
  v_date date := (now() at time zone 'America/Bogota')::date;
  v_item_id uuid;
  v_pay_rows jsonb := '[]'::jsonb;
  r record;
  p public.products;
  v_price numeric;
  v_gross numeric;
  v_disc numeric;
  v_cost numeric;
  v_method text;
  v_account uuid;
  v_amount numeric;
  v_change numeric;
begin
  if not public.has_workspace_role(p_workspace,
       array['owner', 'admin', 'editor', 'recorder']::public.workspace_role[]) then
    raise exception 'SIN_PERMISO';
  end if;
  v_limited := not public.has_workspace_role(p_workspace, array['owner', 'admin']::public.workspace_role[]);
  select * into ws from public.workspaces where id = p_workspace;

  if p_kind is null or p_kind not in ('cash', 'credit') then
    raise exception 'CANTIDAD_INVALIDA';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'CANTIDAD_INVALIDA';
  end if;

  -- Bloqueo en orden de id: ventas simultáneas no se cruzan ni dejan stock negativo.
  select array_agg(distinct (l->>'product_id')::uuid) into v_ids from jsonb_array_elements(p_lines) l;
  perform 1 from public.products where id = any (v_ids) and workspace_id = p_workspace order by id for update;
  if (select count(*) from public.products where id = any (v_ids) and workspace_id = p_workspace and active)
     <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'PRODUCTO_NO_ENCONTRADO';
  end if;

  -- Cliente (obligatorio a crédito).
  if p_contact is not null and not exists (
       select 1 from public.contacts
       where id = p_contact and workspace_id = p_workspace and kind in ('client', 'both')) then
    raise exception 'CLIENTE_REQUERIDO';
  end if;
  if p_kind = 'credit' and p_contact is null then
    raise exception 'CLIENTE_REQUERIDO';
  end if;

  -- Líneas: el precio sale siempre de products, nunca del cliente.
  for r in
    select (l->>'product_id')::uuid as product_id, (l->>'quantity')::numeric as quantity,
           l->'discount' as discount, n
    from jsonb_array_elements(p_lines) with ordinality as t(l, n)
    order by n
  loop
    select * into p from public.products where id = r.product_id;
    if not public.inv_valid_qty(p.unit, r.quantity) then
      raise exception 'CANTIDAD_INVALIDA';
    end if;
    v_price := case p_kind when 'cash' then p.price_cash else p.price_credit end;
    v_gross := round(r.quantity * v_price, 0);
    v_disc := public.pos_discount_amount(v_gross, r.discount);
    select avg_cost into v_cost from public.product_costs where product_id = p.id;
    v_subtotal := v_subtotal + v_gross;
    v_line_disc := v_line_disc + v_disc;
    v_items := v_items || jsonb_build_object(
      'position', r.n, 'product_id', p.id, 'name', p.name, 'unit', p.unit, 'quantity', r.quantity,
      'unit_price', v_price, 'discount', case when v_disc > 0 then r.discount end,
      'line_total', v_gross - v_disc, 'cost', coalesce(v_cost, 0));
  end loop;

  -- Stock (suma por producto, por si el producto está en varias líneas).
  if not ws.pos_allow_negative_stock then
    for r in
      select i->>'product_id' as product_id, sum((i->>'quantity')::numeric) as qty
      from jsonb_array_elements(v_items) i group by 1
    loop
      select * into p from public.products where id = r.product_id::uuid;
      if p.stock < r.qty then
        raise exception 'STOCK_INSUFICIENTE:%', p.name;
      end if;
    end loop;
  end if;

  v_net := v_subtotal - v_line_disc;
  v_total_disc := public.pos_discount_amount(v_net, p_total_discount);
  v_total := v_net - v_total_disc;

  if v_limited and (v_line_disc + v_total_disc) * 100 > ws.pos_max_discount_pct * v_subtotal then
    raise exception 'DESCUENTO_SOBRE_TOPE';
  end if;

  -- Pagos. Cada fila: {method, account_id, amount (registrado), received, change}.
  if p_kind = 'cash' then
    if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
      p_payments := '[]'::jsonb;
    end if;
    for r in select pm, n from jsonb_array_elements(p_payments) with ordinality as t(pm, n) order by n loop
      v_method := r.pm->>'method';
      v_amount := (r.pm->>'amount')::numeric;
      v_account := nullif(r.pm->>'account_id', '')::uuid;
      if v_method is null or v_method not in ('cash', 'transfer', 'nequi', 'daviplata', 'card')
         or v_amount is null or v_amount <= 0 then
        raise exception 'PAGO_NO_CUADRA';
      end if;
      if v_account is null or not exists (
           select 1 from public.accounts where id = v_account and workspace_id = p_workspace and not archived) then
        raise exception 'CUENTA_REQUERIDA';
      end if;
      v_sum := v_sum + v_amount;
      if v_method = 'cash' then v_cash_sum := v_cash_sum + v_amount; end if;
      v_pay_rows := v_pay_rows || jsonb_build_object(
        'method', v_method, 'account_id', v_account, 'received', v_amount, 'amount', v_amount, 'change', 0);
    end loop;
    if v_sum < v_total or v_sum - v_total > v_cash_sum then
      raise exception 'PAGO_NO_CUADRA';
    end if;
    -- Las vueltas salen de los pagos en efectivo, del último al primero.
    v_excess := v_sum - v_total;
    v_left := v_excess;
    for r in select pm, n from jsonb_array_elements(v_pay_rows) with ordinality as t(pm, n)
             where pm->>'method' = 'cash' order by n desc loop
      exit when v_left <= 0;
      v_change := least(v_left, (r.pm->>'amount')::numeric);
      if v_change >= (r.pm->>'amount')::numeric then
        raise exception 'PAGO_NO_CUADRA';
      end if;
      v_left := v_left - v_change;
      v_pay_rows := jsonb_set(v_pay_rows, array[(r.n - 1)::text],
        r.pm || jsonb_build_object('change', v_change, 'amount', (r.pm->>'amount')::numeric - v_change));
    end loop;
    v_paid := v_total;
  else
    v_paid := 0;
    if p_initial_payment is not null and jsonb_typeof(p_initial_payment) = 'object'
       and coalesce((p_initial_payment->>'amount')::numeric, 0) > 0 then
      v_method := p_initial_payment->>'method';
      v_amount := (p_initial_payment->>'amount')::numeric;
      v_account := nullif(p_initial_payment->>'account_id', '')::uuid;
      if v_method is null or v_method not in ('cash', 'transfer', 'nequi', 'daviplata', 'card')
         or v_amount > v_total then
        raise exception 'PAGO_NO_CUADRA';
      end if;
      if v_account is null or not exists (
           select 1 from public.accounts where id = v_account and workspace_id = p_workspace and not archived) then
        raise exception 'CUENTA_REQUERIDA';
      end if;
      v_paid := v_amount;
      v_pay_rows := jsonb_build_array(jsonb_build_object(
        'method', v_method, 'account_id', v_account, 'received', v_amount, 'amount', v_amount, 'change', 0));
    end if;
  end if;
  v_balance := v_total - v_paid;

  -- Escritura.
  v_number := public.inv_next_counter(p_workspace, 'sale');
  insert into public.sales
    (workspace_id, number, kind, contact_id, subtotal, line_discount_total, total_discount, total,
     paid_now, balance, notes)
  values (p_workspace, v_number, p_kind, p_contact, v_subtotal, v_line_disc, v_total_disc, v_total,
          v_paid, v_balance, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_sale;

  select id into v_cat from public.categories
  where workspace_id = p_workspace and type = 'income' and name = 'Ventas' order by created_at limit 1;
  if v_cat is null then
    insert into public.categories (workspace_id, name, icon, color, type, is_default)
    values (p_workspace, 'Ventas', 'shopping-bag', '#10b981', 'income', true)
    returning id into v_cat;
  end if;

  for r in select i from jsonb_array_elements(v_items) i loop
    insert into public.sale_items
      (sale_id, workspace_id, position, product_id, name, unit, quantity, unit_price, discount, line_total)
    values (v_sale, p_workspace, (r.i->>'position')::int, (r.i->>'product_id')::uuid, r.i->>'name',
            r.i->>'unit', (r.i->>'quantity')::numeric, (r.i->>'unit_price')::numeric,
            case when jsonb_typeof(r.i->'discount') = 'object' then r.i->'discount' end,
            (r.i->>'line_total')::numeric)
    returning id into v_item_id;
    insert into public.sale_item_costs (sale_item_id, workspace_id, unit_cost)
    values (v_item_id, p_workspace, (r.i->>'cost')::numeric);
  end loop;

  -- Kardex: una salida por línea, en orden de producto.
  for r in
    select (i->>'product_id')::uuid as product_id, sum((i->>'quantity')::numeric) as qty,
           max((i->>'cost')::numeric) as cost
    from jsonb_array_elements(v_items) i group by 1 order by 1
  loop
    perform public.pos_move_stock(r.product_id, 'sale', -r.qty, r.cost, v_sale);
  end loop;

  for r in select pm from jsonb_array_elements(v_pay_rows) pm loop
    insert into public.sale_payments (sale_id, workspace_id, method, account_id, amount, received, change)
    values (v_sale, p_workspace, r.pm->>'method', (r.pm->>'account_id')::uuid,
            (r.pm->>'amount')::numeric, (r.pm->>'received')::numeric, (r.pm->>'change')::numeric);
    insert into public.transactions
      (workspace_id, type, amount, category_id, description, date, account_id, contact_id, status, sale_id)
    values (p_workspace, 'income', (r.pm->>'amount')::numeric, v_cat, 'Venta #' || v_number, v_date,
            (r.pm->>'account_id')::uuid, p_contact, 'paid', v_sale);
  end loop;

  if v_balance > 0 then
    insert into public.transactions
      (workspace_id, type, amount, category_id, description, date, contact_id, status, sale_id)
    values (p_workspace, 'income', v_balance, v_cat, 'Venta #' || v_number || ' (saldo)', v_date,
            p_contact, 'pending', v_sale);
  end if;

  return jsonb_build_object('sale_id', v_sale, 'number', v_number, 'total', v_total, 'balance', v_balance);
end;
$$;

create function public.pos_void_sale(p_sale uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  s public.sales;
  r record;
begin
  select * into s from public.sales where id = p_sale for update;
  if not found or not public.has_workspace_role(s.workspace_id, array['owner', 'admin']::public.workspace_role[]) then
    raise exception 'SIN_PERMISO';
  end if;
  if s.status = 'void' then
    raise exception 'VENTA_ANULADA';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'MOTIVO_REQUERIDO';
  end if;

  perform 1 from public.products
  where id in (select product_id from public.sale_items where sale_id = p_sale) order by id for update;

  for r in
    select i.product_id, sum(i.quantity) as qty, max(c.unit_cost) as cost
    from public.sale_items i left join public.sale_item_costs c on c.sale_item_id = i.id
    where i.sale_id = p_sale group by i.product_id order by i.product_id
  loop
    perform public.pos_move_stock(r.product_id, 'sale_void', r.qty, r.cost, p_sale);
  end loop;

  delete from public.transactions where sale_id = p_sale;
  update public.sales
    set status = 'void', void_reason = btrim(p_reason), voided_by = auth.uid(), voided_at = now()
    where id = p_sale;
end;
$$;

create function public.pos_update_settings(
  p_workspace uuid, p_max_discount_pct numeric, p_allow_negative_stock boolean
) returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.has_workspace_role(p_workspace, array['owner', 'admin']::public.workspace_role[]) then
    raise exception 'SIN_PERMISO';
  end if;
  if p_max_discount_pct is null or p_max_discount_pct < 0 or p_max_discount_pct > 100 then
    raise exception 'DESCUENTO_INVALIDO';
  end if;
  update public.workspaces
    set pos_max_discount_pct = p_max_discount_pct,
        pos_allow_negative_stock = coalesce(p_allow_negative_stock, false)
    where id = p_workspace;
end;
$$;

revoke execute on function public.pos_confirm_sale(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, text) from public, anon;
revoke execute on function public.pos_void_sale(uuid, text) from public, anon;
revoke execute on function public.pos_update_settings(uuid, numeric, boolean) from public, anon;
grant execute on function public.pos_confirm_sale(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, text) to authenticated;
grant execute on function public.pos_void_sale(uuid, text) to authenticated;
grant execute on function public.pos_update_settings(uuid, numeric, boolean) to authenticated;
