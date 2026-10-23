-- Venta (POS): confirmación atómica, precios del servidor, descuentos, pagos
-- mixtos, vueltas, crédito, anulación, stock negativo y RLS por rol.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

create function pg_temp.uid(p_email text) returns uuid
language sql security definer as $$ select id from auth.users where email = p_email $$;
create function pg_temp.act_as(p_email text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(p_email))::text, true)
$$;
create function pg_temp.mkuser(p_email text, p_plan text default 'gratis') returns uuid
language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email, '{}');
  update public.subscriptions
    set plan_code = p_plan, status = 'active', trial_end = null,
        current_period_end = case when p_plan = 'gratis' then null else now() + interval '1 month' end
    where owner_id = v;
  return v;
end $$;
create function pg_temp.ws_of(p_email text) returns uuid
language sql security definer as $$ select id from public.workspaces where owner_id = pg_temp.uid(p_email) $$;

create function pg_temp.w() returns uuid language sql as $$ select pg_temp.ws_of('pos.dueno@finanzasapp.test') $$;
create function pg_temp.pid(p_name text) returns uuid
language sql security definer as $$ select id from public.products where name = p_name limit 1 $$;
create function pg_temp.stock(p_name text) returns numeric
language sql security definer as $$ select stock from public.products where name = p_name limit 1 $$;
create function pg_temp.acc(p_name text) returns uuid
language sql security definer as $$ select id from public.accounts where workspace_id = pg_temp.w() and name = p_name $$;
create function pg_temp.client() returns uuid
language sql security definer as $$ select id from public.contacts where workspace_id = pg_temp.w() and name = 'Cliente POS' $$;
create function pg_temp.sale(p_number int) returns uuid
language sql security definer as $$ select id from public.sales where workspace_id = pg_temp.w() and number = p_number $$;
create function pg_temp.nsales() returns bigint
language sql security definer as $$ select count(*) from public.sales where workspace_id = pg_temp.w() $$;
-- Línea de venta; el cliente intenta colar un precio (debe ignorarse).
create function pg_temp.ln(p_name text, q numeric, d jsonb default null) returns jsonb
language sql as $$
  select jsonb_build_object('product_id', pg_temp.pid(p_name), 'quantity', q, 'discount', d, 'unit_price', 1)
$$;
create function pg_temp.pct(v numeric) returns jsonb language sql as $$ select jsonb_build_object('type', 'pct', 'value', v) $$;
create function pg_temp.amt(v numeric) returns jsonb language sql as $$ select jsonb_build_object('type', 'amount', 'value', v) $$;
create function pg_temp.pay(m text, a text, amount numeric) returns jsonb
language sql as $$ select jsonb_build_object('method', m, 'account_id', pg_temp.acc(a), 'amount', amount) $$;
-- Atajos de venta: contado (un pago) y crédito.
create function pg_temp.cash_sale(lines jsonb, payments jsonb, td jsonb default null) returns jsonb
language sql as $$
  select public.pos_confirm_sale(pg_temp.w(), 'cash', null, lines, td, payments, null, null)
$$;
create function pg_temp.credit_sale(lines jsonb, contact uuid, initial jsonb default null) returns jsonb
language sql as $$
  select public.pos_confirm_sale(pg_temp.w(), 'credit', contact, lines, null, '[]'::jsonb, initial, null)
$$;

select plan(75);

-- ===== Preparación (superusuario) =====
select pg_temp.mkuser('pos.dueno@finanzasapp.test', 'pro');
select pg_temp.mkuser('pos.admin@finanzasapp.test');
select pg_temp.mkuser('pos.editor@finanzasapp.test');
select pg_temp.mkuser('pos.contador@finanzasapp.test');
select pg_temp.mkuser('pos.registro@finanzasapp.test');
select pg_temp.mkuser('pos.otro@finanzasapp.test');
insert into public.memberships (workspace_id, user_id, role) values
  (pg_temp.w(), pg_temp.uid('pos.admin@finanzasapp.test'), 'admin'),
  (pg_temp.w(), pg_temp.uid('pos.editor@finanzasapp.test'), 'editor'),
  (pg_temp.w(), pg_temp.uid('pos.contador@finanzasapp.test'), 'accountant'),
  (pg_temp.w(), pg_temp.uid('pos.registro@finanzasapp.test'), 'recorder');
insert into public.contacts (workspace_id, kind, name, address) values (pg_temp.w(), 'client', 'Cliente POS', 'Calle 1 # 2-3');

reset role; select pg_temp.act_as('pos.dueno@finanzasapp.test'); set local role authenticated;
select lives_ok($$insert into public.products (workspace_id, name, unit, price_cash, price_credit) values
  (pg_temp.w(), 'Arroz', 'unidad', 5000, 5500), (pg_temp.w(), 'Harina', 'kg', 3000, 3000),
  (pg_temp.w(), 'Sal', 'unidad', 1000, 1000), (pg_temp.w(), 'Fideos', 'unidad', 2000, 2000)$$, 'productos de prueba');
select lives_ok($$select public.inventory_set_opening(pg_temp.pid('Arroz'), 10, 1000);
  select public.inventory_set_opening(pg_temp.pid('Harina'), 5, 1000);
  select public.inventory_set_opening(pg_temp.pid('Sal'), 3, 400);
  select public.inventory_set_opening(pg_temp.pid('Fideos'), 50, 500)$$, 'stock inicial');

-- ===== Contado mixto =====
select lives_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Arroz', 2)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 6000), pg_temp.pay('transfer', 'Cuenta bancaria', 4000)))$$,
  'venta de contado con dos medios de pago');
select is(pg_temp.stock('Arroz'), 8::numeric, 'la venta descuenta el stock');
select results_eq($$select t.amount, t.status, a.name from public.transactions t join public.accounts a on a.id = t.account_id
  where t.sale_id = pg_temp.sale(1) order by t.amount$$,
  $$values (4000.00::numeric, 'paid'::text, 'Cuenta bancaria'::text), (6000.00::numeric, 'paid'::text, 'Efectivo'::text)$$,
  'un ingreso pagado por medio de pago, en su cuenta');
select results_eq($$select kind, total, paid_now, balance, status from public.sales where id = pg_temp.sale(1)$$,
  $$values ('cash'::text, 10000.00::numeric, 10000.00::numeric, 0.00::numeric, 'active'::text)$$, 'totales de la venta 1');
select is((select unit_price from public.sale_items where sale_id = pg_temp.sale(1)), 5000.00::numeric,
  'el precio enviado por el cliente se ignora');
select results_eq($$select kind, quantity, stock_after, unit_cost from public.stock_movements
  where sale_id = pg_temp.sale(1)$$, $$values ('sale'::text, -2.000::numeric, 8.000::numeric, 1000.00::numeric)$$,
  'el kardex registra la salida con el costo promedio');
select is((select unit_cost from public.sale_item_costs where sale_item_id = (select id from public.sale_items where sale_id = pg_temp.sale(1))),
  1000.00::numeric, 'el costo de la línea queda en sale_item_costs');
select is((select c.name from public.transactions t join public.categories c on c.id = t.category_id
  where t.sale_id = pg_temp.sale(1) limit 1), 'Ventas', 'los ingresos van a la categoría Ventas');

-- ===== Vueltas =====
select lives_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Harina', 1)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 5000)))$$, 'efectivo mayor al total (vueltas)');
select results_eq($$select amount, received, change from public.sale_payments where sale_id = pg_temp.sale(2)$$,
  $$values (3000.00::numeric, 5000.00::numeric, 2000.00::numeric)$$, 'el pago guarda recibido y vueltas');
select is((select sum(amount) from public.transactions where sale_id = pg_temp.sale(2)), 3000.00::numeric,
  'solo el total se registra como ingreso');
select throws_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Harina', 1)),
  jsonb_build_array(pg_temp.pay('transfer', 'Cuenta bancaria', 4000)))$$, 'P0001', 'PAGO_NO_CUADRA',
  'el exceso solo puede venir de efectivo');
select throws_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Harina', 1)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 2000)))$$, 'P0001', 'PAGO_NO_CUADRA', 'pago que no alcanza');
select throws_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Harina', 1)),
  jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 3000)))$$, 'P0001', 'CUENTA_REQUERIDA', 'pago sin cuenta');

-- ===== Crédito =====
select lives_ok($$select pg_temp.credit_sale(jsonb_build_array(pg_temp.ln('Arroz', 1)), pg_temp.client(),
  pg_temp.pay('cash', 'Efectivo', 2000))$$, 'crédito con abono inicial');
select results_eq($$select kind, total, paid_now, balance from public.sales where id = pg_temp.sale(3)$$,
  $$values ('credit'::text, 5500.00::numeric, 2000.00::numeric, 3500.00::numeric)$$, 'a crédito usa price_credit');
select results_eq($$select status, amount, contact_id = pg_temp.client() from public.transactions
  where sale_id = pg_temp.sale(3) order by status$$,
  $$values ('paid'::text, 2000.00::numeric, true), ('pending'::text, 3500.00::numeric, true)$$,
  'abono pagado + saldo pendiente con el cliente');
select lives_ok($$select pg_temp.credit_sale(jsonb_build_array(pg_temp.ln('Arroz', 1)), pg_temp.client())$$, 'crédito sin abono');
select results_eq($$select status, amount from public.transactions where sale_id = pg_temp.sale(4)$$,
  $$values ('pending'::text, 5500.00::numeric)$$, 'sin abono solo hay saldo pendiente');
select throws_ok($$select pg_temp.credit_sale(jsonb_build_array(pg_temp.ln('Arroz', 1)), null)$$,
  'P0001', 'CLIENTE_REQUERIDO', 'crédito sin cliente falla');
select throws_ok($$select pg_temp.credit_sale(jsonb_build_array(pg_temp.ln('Arroz', 1)), pg_temp.client(),
  pg_temp.pay('cash', 'Efectivo', 9000))$$, 'P0001', 'PAGO_NO_CUADRA', 'abono mayor al total falla');

-- ===== Stock y cantidades =====
select throws_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Sal', 4)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 4000)))$$, 'P0001', 'STOCK_INSUFICIENTE:Sal', 'stock insuficiente indica el producto');
select is(pg_temp.stock('Sal'), 3::numeric, 'sin efectos tras el rechazo (stock igual)');
select is(pg_temp.nsales(), 4::bigint, 'sin efectos tras el rechazo (sin venta)');
select lives_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Harina', 0.5)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 1500)))$$, '0,5 kg es válido');
select throws_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Arroz', 0.5)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 2500)))$$, 'P0001', 'CANTIDAD_INVALIDA', '0,5 en unidad se rechaza');
select throws_ok($$select pg_temp.cash_sale('[]'::jsonb, '[]'::jsonb)$$, 'P0001', 'CANTIDAD_INVALIDA', 'venta sin líneas');

-- ===== Descuentos (dueño sin tope) =====
select lives_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Arroz', 2, pg_temp.pct(10))),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 8500)), pg_temp.amt(500))$$, 'descuento por línea y sobre el total');
select results_eq($$select subtotal, line_discount_total, total_discount, total from public.sales where id = pg_temp.sale(6)$$,
  $$values (10000.00::numeric, 1000.00::numeric, 500.00::numeric, 8500.00::numeric)$$, 'el descuento total se aplica sobre lo ya descontado');
select is((select line_total from public.sale_items where sale_id = pg_temp.sale(6)), 9000.00::numeric, 'total de la línea con descuento');
select lives_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Fideos', 1, pg_temp.amt(99999))),
  '[]'::jsonb)$$, 'una línea nunca baja de 0 (descuento topado)');
select is((select line_total from public.sale_items where sale_id = pg_temp.sale(7)), 0.00::numeric, 'línea en 0');
select throws_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Fideos', 1, pg_temp.amt(-5))),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 2000)))$$, 'P0001', 'PRECIO_NEGATIVO', 'descuento negativo se rechaza');

-- Categoría Ventas se crea si falta.
reset role;
delete from public.categories where workspace_id = pg_temp.w() and name = 'Ventas';
select pg_temp.act_as('pos.dueno@finanzasapp.test'); set local role authenticated;
select lives_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Fideos', 1)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 2000)))$$, 'vende sin categoría Ventas');
select is((select c.name || ':' || c.type from public.transactions t join public.categories c on c.id = t.category_id
  where t.sale_id = pg_temp.sale(8)), 'Ventas:income', 'se crea la categoría Ventas de ingreso');

-- ===== Editor: tope de descuento =====
reset role; select pg_temp.act_as('pos.editor@finanzasapp.test'); set local role authenticated;
select lives_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Fideos', 1, pg_temp.pct(10))),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 1800)))$$, 'editor vende con 10 %');
select throws_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Fideos', 1, pg_temp.pct(11))),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 1780)))$$, 'P0001', 'DESCUENTO_SOBRE_TOPE', 'editor con 11 % falla');
select throws_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Arroz', 1, pg_temp.pct(5))),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 4465)), pg_temp.pct(6))$$, 'P0001', 'DESCUENTO_SOBRE_TOPE',
  'el tope cuenta línea + total');
select throws_ok($$select public.pos_update_settings(pg_temp.w(), 20, false)$$, 'P0001', 'SIN_PERMISO', 'editor no cambia ajustes');

reset role; select pg_temp.act_as('pos.dueno@finanzasapp.test'); set local role authenticated;
select lives_ok($$select public.pos_update_settings(pg_temp.w(), 20, false)$$, 'dueño sube el tope a 20');
select throws_ok($$select public.pos_update_settings(pg_temp.w(), 120, false)$$, 'P0001', 'DESCUENTO_INVALIDO', 'tope fuera de rango');
reset role; select pg_temp.act_as('pos.editor@finanzasapp.test'); set local role authenticated;
select lives_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Fideos', 1, pg_temp.pct(15))),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 1700)))$$, 'con tope 20, el editor puede 15 %');
select ok((select count(*) from public.sale_item_costs) > 0, 'editor ve costos de venta');

-- ===== Solo registro =====
reset role; select pg_temp.act_as('pos.registro@finanzasapp.test'); set local role authenticated;
select lives_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Fideos', 1)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 2000)))$$, 'solo registro vende');
select ok((select count(*) from public.sales) > 0, 'solo registro ve las ventas');
select ok((select count(*) from public.sale_items) > 0, 'solo registro ve las líneas');
select is((select count(*) from public.sale_item_costs), 0::bigint, 'solo registro no ve costos de líneas');
select throws_ok($$select public.pos_void_sale(pg_temp.sale(1), 'x')$$, 'P0001', 'SIN_PERMISO', 'solo registro no anula');
select throws_ok($$insert into public.sales (workspace_id, number, kind, subtotal, total) values (pg_temp.w(), 99, 'cash', 1, 1)$$,
  '42501', null, 'no hay escritura directa en sales');

-- ===== Contador =====
reset role; select pg_temp.act_as('pos.contador@finanzasapp.test'); set local role authenticated;
select throws_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Fideos', 1)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 2000)))$$, 'P0001', 'SIN_PERMISO', 'contador no vende');
select ok((select count(*) from public.sales) > 0, 'contador ve ventas');
select ok((select count(*) from public.sale_item_costs) > 0, 'contador ve costos de líneas');

-- ===== Otro negocio =====
reset role; select pg_temp.act_as('pos.otro@finanzasapp.test'); set local role authenticated;
select is((select count(*) from public.sales), 0::bigint, 'otro negocio no ve estas ventas');
select throws_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Fideos', 1)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 2000)))$$, 'P0001', 'SIN_PERMISO', 'otro negocio no vende aquí');

-- ===== Anulación =====
reset role; select pg_temp.act_as('pos.editor@finanzasapp.test'); set local role authenticated;
select throws_ok($$select public.pos_void_sale(pg_temp.sale(1), 'error')$$, 'P0001', 'SIN_PERMISO', 'editor no anula');
reset role; select pg_temp.act_as('pos.admin@finanzasapp.test'); set local role authenticated;
select throws_ok($$select public.pos_void_sale(pg_temp.sale(1), '  ')$$, 'P0001', 'MOTIVO_REQUERIDO', 'anular exige motivo');
select is(pg_temp.stock('Arroz'), 4::numeric, 'stock de Arroz antes de anular');
select lives_ok($$select public.pos_void_sale(pg_temp.sale(1), 'Cliente devolvió')$$, 'admin anula');
select is(pg_temp.stock('Arroz'), 6::numeric, 'anular devuelve el stock');
select is((select count(*) from public.transactions where sale_id = pg_temp.sale(1)), 0::bigint, 'anular borra los movimientos de finanzas');
select results_eq($$select status, void_reason from public.sales where id = pg_temp.sale(1)$$,
  $$values ('void'::text, 'Cliente devolvió'::text)$$, 'la venta queda anulada con motivo');
select is((select quantity from public.stock_movements where sale_id = pg_temp.sale(1) and kind = 'sale_void'), 2.000::numeric,
  'el kardex registra sale_void');
select throws_ok($$select public.pos_void_sale(pg_temp.sale(1), 'otra vez')$$, 'P0001', 'VENTA_ANULADA', 'segunda anulación falla');
select is(pg_temp.stock('Arroz'), 6::numeric, 'la segunda anulación no devuelve stock otra vez');

reset role; select pg_temp.act_as('pos.dueno@finanzasapp.test'); set local role authenticated;
select lives_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Fideos', 1)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 2000)))$$, 'nueva venta tras anular');
select is((select max(number) from public.sales where workspace_id = pg_temp.w()), 12, 'el consecutivo no se reutiliza');

-- ===== Stock negativo configurable =====
select lives_ok($$select public.pos_update_settings(pg_temp.w(), 10, true)$$, 'dueño permite stock negativo');
select lives_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Sal', 5)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 5000)))$$, 'vende más de lo que hay');
select is(pg_temp.stock('Sal'), -2::numeric, 'el stock queda en -2');
select lives_ok($$select public.pos_update_settings(pg_temp.w(), 10, false)$$, 'dueño vuelve a bloquear');
select throws_ok($$select pg_temp.cash_sale(jsonb_build_array(pg_temp.ln('Sal', 1)),
  jsonb_build_array(pg_temp.pay('cash', 'Efectivo', 1000)))$$, 'P0001', 'STOCK_INSUFICIENTE:Sal', 'con stock negativo y bloqueo falla');
select lives_ok($$select public.pos_void_sale(pg_temp.sale(13), 'prueba')$$, 'dueño anula la venta con stock negativo');
select is(pg_temp.stock('Sal'), 3::numeric, 'anular restituye el stock');

select * from finish();
rollback;
