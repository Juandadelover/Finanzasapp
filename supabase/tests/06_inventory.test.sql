-- Inventario: RLS por rol, protección de stock, costo promedio, entradas con
-- gasto, ajustes, límites de plan, importación y códigos internos.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

create function pg_temp.uid(p_email text) returns uuid
language sql security definer as $$ select id from auth.users where email = p_email $$;
create function pg_temp.act_as(p_email text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(p_email))::text, true)
$$;
create function pg_temp.n(p_sql text) returns int language plpgsql as $$
declare c int; begin execute p_sql; get diagnostics c = row_count; return c; end $$;
-- Crea un usuario nuevo (el trigger le crea negocio y prueba) y fija su plan.
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

-- Atajos de esta prueba.
create function pg_temp.w() returns uuid language sql as $$ select pg_temp.ws_of('inv.dueno@finanzasapp.test') $$;
create function pg_temp.gw() returns uuid language sql as $$ select pg_temp.ws_of('inv.gratis@finanzasapp.test') $$;
create function pg_temp.pid(p_name text) returns uuid
language sql security definer as $$ select id from public.products where name = p_name limit 1 $$;
create function pg_temp.stock(p_name text) returns numeric
language sql security definer as $$ select stock from public.products where name = p_name limit 1 $$;
create function pg_temp.avg(p_name text) returns numeric
language sql security definer as $$
  select c.avg_cost from public.product_costs c join public.products p on p.id = c.product_id where p.name = p_name limit 1 $$;
create function pg_temp.nmov(p_name text) returns bigint
language sql security definer as $$
  select count(*) from public.stock_movements m join public.products p on p.id = m.product_id where p.name = p_name $$;
create function pg_temp.line(p_name text, q numeric, c numeric default null) returns jsonb
language sql as $$
  select jsonb_build_array(jsonb_build_object('product_id', pg_temp.pid(p_name), 'quantity', q, 'unit_cost', c))
$$;
create function pg_temp.acct() returns uuid
language sql security definer as $$ select id from public.accounts where workspace_id = pg_temp.w() order by name limit 1 $$;
create function pg_temp.supplier() returns uuid
language sql security definer as $$ select id from public.contacts where workspace_id = pg_temp.w() and name = 'Proveedor Inv' $$;
create function pg_temp.receipt_of(p_name text) returns uuid
language sql security definer as $$
  select r.id from public.stock_receipts r
  join public.stock_movements m on m.receipt_id = r.id
  join public.products p on p.id = m.product_id
  where p.name = p_name and r.status = 'pending_cost' order by r.number desc limit 1 $$;

select plan(88);

-- ===== Preparación (superusuario) =====
select pg_temp.mkuser('inv.dueno@finanzasapp.test', 'pro');
select pg_temp.mkuser('inv.admin@finanzasapp.test');
select pg_temp.mkuser('inv.editor@finanzasapp.test');
select pg_temp.mkuser('inv.contador@finanzasapp.test');
select pg_temp.mkuser('inv.registro@finanzasapp.test');
select pg_temp.mkuser('inv.gratis@finanzasapp.test', 'gratis');
insert into public.memberships (workspace_id, user_id, role) values
  (pg_temp.w(), pg_temp.uid('inv.admin@finanzasapp.test'), 'admin'),
  (pg_temp.w(), pg_temp.uid('inv.editor@finanzasapp.test'), 'editor'),
  (pg_temp.w(), pg_temp.uid('inv.contador@finanzasapp.test'), 'accountant'),
  (pg_temp.w(), pg_temp.uid('inv.registro@finanzasapp.test'), 'recorder');
insert into public.contacts (workspace_id, kind, name) values (pg_temp.w(), 'supplier', 'Proveedor Inv');

-- ===== Dueño: productos, protección de stock, costo promedio =====
reset role; select pg_temp.act_as('inv.dueno@finanzasapp.test'); set local role authenticated;
select lives_ok($$insert into public.product_categories (workspace_id, name) values (pg_temp.w(), 'Granos')$$, 'dueño crea categoría de producto');
select lives_ok($$insert into public.products (workspace_id, name, unit, price_cash, price_credit) values
  (pg_temp.w(), 'Arroz', 'unidad', 5000, 5500), (pg_temp.w(), 'Harina', 'kg', 3000, 3000),
  (pg_temp.w(), 'Fideos', 'unidad', 2000, 2000), (pg_temp.w(), 'Sal', 'unidad', 1000, 1000),
  (pg_temp.w(), 'Aceite', 'unidad', 9000, 9000)$$, 'dueño crea productos con stock 0');
select throws_ok($$insert into public.products (workspace_id, name, stock) values (pg_temp.w(), 'Trampa', 5)$$,
  'P0001', 'STOCK_SOLO_POR_FUNCION', 'insertar con stock <> 0 falla');
select throws_ok($$update public.products set stock = 99 where name = 'Arroz'$$,
  'P0001', 'STOCK_SOLO_POR_FUNCION', 'actualizar stock directo falla');
select lives_ok($$update public.products set price_cash = 5200 where name = 'Arroz'$$, 'dueño cambia el precio');
select is((select count(*) from public.product_price_changes where product_id = pg_temp.pid('Arroz')), 1::bigint, 'el cambio de precio queda en el historial');
select throws_ok($$insert into public.stock_movements (workspace_id, product_id, kind, quantity, stock_after)
  values (pg_temp.w(), pg_temp.pid('Arroz'), 'receipt', 1, 1)$$, '42501', null, 'no se inserta en el kardex directamente');

-- Dos entradas seguidas del mismo producto: costo promedio y stock encadenado.
select lives_ok($$select public.inventory_receive(pg_temp.w(), null, current_date, pg_temp.line('Arroz', 10, 1000), '{}'::jsonb)$$, 'primera entrada 10 a 1000');
select lives_ok($$select public.inventory_receive(pg_temp.w(), null, current_date, pg_temp.line('Arroz', 10, 2000), '{}'::jsonb)$$, 'segunda entrada 10 a 2000');
select is(pg_temp.stock('Arroz'), 20::numeric, 'el stock es la suma de las dos entradas');
select is(pg_temp.avg('Arroz'), 1500.00::numeric, 'el costo promedio es 1500');
select results_eq($$select m.stock_after from public.stock_movements m where m.product_id = pg_temp.pid('Arroz') order by m.id$$,
  $$values (10.000::numeric), (20.000::numeric)$$, 'stock_after encadenado 10 y 20');
select throws_ok($$update public.products set stock = 99 where name = 'Arroz'$$,
  'P0001', 'STOCK_SOLO_POR_FUNCION', 'tras una función el stock sigue protegido');

-- Entrada con gasto.
select lives_ok($$select public.inventory_receive(pg_temp.w(), pg_temp.supplier(), current_date, pg_temp.line('Sal', 5, 1000),
  jsonb_build_object('create', true, 'account_id', pg_temp.acct(), 'status', 'paid'))$$, 'entrada con gasto pagado');
select results_eq($$select t.amount, t.status, c.name, t.type, t.contact_id = pg_temp.supplier()
  from public.transactions t join public.categories c on c.id = t.category_id
  where t.workspace_id = pg_temp.w() and t.description like 'Entrada de mercancía #%'$$,
  $$values (5000.00::numeric, 'paid'::text, 'Compras e inventario'::text, 'expense'::text, true)$$,
  'el gasto queda pagado, en Compras e inventario y con el proveedor');
select lives_ok($$select public.inventory_receive(pg_temp.w(), pg_temp.supplier(), current_date, pg_temp.line('Sal', 2, 1000),
  jsonb_build_object('create', true, 'status', 'pending', 'due_date', current_date + 30))$$, 'entrada con gasto pendiente');
select is((select count(*) from public.transactions where workspace_id = pg_temp.w() and status = 'pending' and contact_id = pg_temp.supplier() and amount = 2000), 1::bigint, 'el gasto pendiente queda como pendiente');
select throws_ok($$select public.inventory_receive(pg_temp.w(), null, current_date, pg_temp.line('Aceite', 3, 500),
  jsonb_build_object('create', true, 'status', 'paid'))$$, 'P0001', 'CUENTA_REQUERIDA', 'gasto pagado sin cuenta falla');
select is(pg_temp.stock('Aceite'), 0::numeric, 'si falla el gasto, la entrada no se guarda (atómico)');

-- Cantidades por unidad.
select throws_ok($$select public.inventory_receive(pg_temp.w(), null, current_date, pg_temp.line('Arroz', 1.5, 1000), '{}'::jsonb)$$,
  'P0001', 'CANTIDAD_INVALIDA', '1,5 en un producto por unidad se rechaza');
select lives_ok($$select public.inventory_receive(pg_temp.w(), null, current_date, pg_temp.line('Harina', 1.5, 1000), '{}'::jsonb)$$, '1,5 en kg se acepta');

-- ===== Ajustes =====
select throws_ok($$select public.inventory_adjust(pg_temp.pid('Arroz'), 'out', 25, 'damage', null)$$,
  'P0001', 'STOCK_NEGATIVO', 'salida mayor al stock falla');
select is(pg_temp.stock('Arroz'), 20::numeric, 'tras el rechazo el stock no cambia');
select throws_ok($$select public.inventory_adjust(pg_temp.pid('Arroz'), 'out', 1, null, null)$$,
  'P0001', 'MOTIVO_REQUERIDO', 'la salida exige motivo');
select lives_ok($$select public.inventory_adjust(pg_temp.pid('Arroz'), 'out', 2, 'damage', 'se mojaron')$$, 'salida por daño');
select is(pg_temp.stock('Arroz'), 18::numeric, 'la salida descuenta el stock');
select lives_ok($$select public.inventory_adjust(pg_temp.pid('Arroz'), 'count', 18, null, null)$$, 'conteo igual al stock no falla');
select is(pg_temp.nmov('Arroz'), 3::bigint, 'conteo con diferencia 0 no crea movimiento');
select lives_ok($$select public.inventory_adjust(pg_temp.pid('Arroz'), 'count', 15, null, null)$$, 'conteo con diferencia');
select results_eq($$select quantity, stock_after, reason from public.stock_movements
  where product_id = pg_temp.pid('Arroz') order by id desc limit 1$$,
  $$values (-3.000::numeric, 15.000::numeric, 'count'::text)$$, 'el conteo registra la diferencia -3');

-- ===== Stock inicial =====
select throws_ok($$select public.inventory_set_opening(pg_temp.pid('Arroz'), 5, 100)$$,
  'P0001', 'PRODUCTO_CON_MOVIMIENTOS', 'stock inicial con movimientos falla');
select lives_ok($$select public.inventory_set_opening(pg_temp.pid('Fideos'), 10, 1000)$$, 'stock inicial en producto nuevo');
select is(pg_temp.avg('Fideos'), 1000.00::numeric, 'el stock inicial fija el costo promedio');
select throws_ok($$select public.inventory_set_opening(pg_temp.pid('Fideos'), 3, 100)$$,
  'P0001', 'PRODUCTO_CON_MOVIMIENTOS', 'segundo stock inicial falla');

-- ===== Solo registro =====
reset role; select pg_temp.act_as('inv.registro@finanzasapp.test'); set local role authenticated;
select lives_ok($$select public.inventory_receive(pg_temp.w(), null, current_date, pg_temp.line('Fideos', 10, 99999), '{}'::jsonb)$$, 'solo registro recibe (ignora el costo que mande)');
select is(pg_temp.stock('Fideos'), 20::numeric, 'la entrada de solo registro suma stock');
select is(pg_temp.avg('Fideos'), 1000.00::numeric, 'solo registro no cambia el costo promedio');
select is((select count(*) from public.products where workspace_id = pg_temp.w()), 5::bigint, 'solo registro ve los productos');
select is((select count(*) from public.product_costs), 0::bigint, 'solo registro no ve costos');
select is((select count(*) from public.stock_movements), 0::bigint, 'solo registro no ve el kardex');
select is((select count(*) from public.stock_receipts), 0::bigint, 'solo registro no ve entradas');
select throws_ok($$insert into public.products (workspace_id, name) values (pg_temp.w(), 'X')$$, '42501', null, 'solo registro no crea productos');
select throws_ok($$select public.inventory_adjust(pg_temp.pid('Fideos'), 'out', 1, 'loss', null)$$, 'P0001', 'SIN_PERMISO', 'solo registro no ajusta');
select throws_ok($$select public.inventory_import(pg_temp.w(), '[]'::jsonb)$$, 'P0001', 'SIN_PERMISO', 'solo registro no importa');
select throws_ok($$select public.inventory_next_internal_barcode(pg_temp.w())$$, 'P0001', 'SIN_PERMISO', 'solo registro no genera códigos');

-- ===== Costo tardío =====
reset role; select pg_temp.act_as('inv.dueno@finanzasapp.test'); set local role authenticated;
select is((select status from public.stock_receipts where id = pg_temp.receipt_of('Fideos')), 'pending_cost', 'la entrada sin costo queda pending_cost');
select is((select transaction_id from public.stock_receipts where id = pg_temp.receipt_of('Fideos')), null, 'sin costo no se crea gasto');
select lives_ok($$select public.inventory_complete_receipt(pg_temp.receipt_of('Fideos'),
  jsonb_build_array(jsonb_build_object('product_id', pg_temp.pid('Fideos'), 'unit_cost', 2000)),
  jsonb_build_object('create', true, 'account_id', pg_temp.acct(), 'status', 'paid'))$$, 'dueño completa el costo');
select is(pg_temp.avg('Fideos'), 1500.00::numeric, 'costo tardío: 1000 + 10*(2000-1000)/20 = 1500');
select results_eq($$select status, total_cost, transaction_id is not null from public.stock_receipts
  where id = (select receipt_id from public.stock_movements where product_id = pg_temp.pid('Fideos') and receipt_id is not null limit 1)$$,
  $$values ('complete'::text, 20000.00::numeric, true)$$, 'la entrada queda completa con total y gasto');
select throws_ok($$select public.inventory_complete_receipt((select receipt_id from public.stock_movements where product_id = pg_temp.pid('Fideos') and receipt_id is not null limit 1), '[]'::jsonb, '{}'::jsonb)$$,
  'P0001', 'ENTRADA_COMPLETA', 'no se completa dos veces');

-- ===== Costo tardío con stock en cero =====
select lives_ok($$select public.inventory_receive(pg_temp.w(), null, current_date, pg_temp.line('Aceite', 4), '{}'::jsonb)$$, 'dueño recibe sin costo');
select lives_ok($$select public.inventory_adjust(pg_temp.pid('Aceite'), 'out', 4, 'loss', null)$$, 'se pierde todo el aceite');
select lives_ok($$select public.inventory_complete_receipt(pg_temp.receipt_of('Aceite'),
  jsonb_build_array(jsonb_build_object('product_id', pg_temp.pid('Aceite'), 'unit_cost', 800)), '{}'::jsonb)$$, 'completa con stock 0');
select is(pg_temp.avg('Aceite'), 800.00::numeric, 'con stock 0 el promedio es el costo nuevo');

-- ===== Roles =====
reset role; select pg_temp.act_as('inv.editor@finanzasapp.test'); set local role authenticated;
select lives_ok($$insert into public.products (workspace_id, name) values (pg_temp.w(), 'Editor1')$$, 'editor crea productos');
select lives_ok($$select public.inventory_receive(pg_temp.w(), null, current_date, pg_temp.line('Editor1', 3, 100), '{}'::jsonb)$$, 'editor recibe con costo');
select throws_ok($$select public.inventory_adjust(pg_temp.pid('Editor1'), 'out', 1, 'loss', null)$$, 'P0001', 'SIN_PERMISO', 'editor no ajusta');
select ok((select count(*) from public.product_costs) > 0, 'editor ve costos');

reset role; select pg_temp.act_as('inv.admin@finanzasapp.test'); set local role authenticated;
select lives_ok($$select public.inventory_adjust(pg_temp.pid('Editor1'), 'out', 1, 'loss', null)$$, 'admin ajusta');

reset role; select pg_temp.act_as('inv.contador@finanzasapp.test'); set local role authenticated;
select ok((select count(*) from public.stock_movements) > 0, 'contador ve el kardex');
select ok((select count(*) from public.product_costs) > 0, 'contador ve costos');
select ok((select count(*) from public.stock_receipts) > 0, 'contador ve entradas');
select throws_ok($$insert into public.products (workspace_id, name) values (pg_temp.w(), 'X')$$, '42501', null, 'contador no crea productos');
select throws_ok($$select public.inventory_receive(pg_temp.w(), null, current_date, pg_temp.line('Arroz', 1, 1), '{}'::jsonb)$$, 'P0001', 'SIN_PERMISO', 'contador no recibe');

-- ===== Importación y códigos =====
reset role; select pg_temp.act_as('inv.dueno@finanzasapp.test'); set local role authenticated;
select lives_ok($$insert into public.products (workspace_id, barcode, name) values (pg_temp.w(), '7702004003508', 'Con código')$$, 'producto con código');
select throws_ok($$insert into public.products (workspace_id, barcode, name) values (pg_temp.w(), '7702004003508', 'Otro')$$, '23505', null, 'código repetido en el negocio falla');
select is(
  (public.inventory_import(pg_temp.w(), '[{"barcode":"111","name":"A1"},{"barcode":"111","name":"A2"}]'::jsonb)->>'ok')::boolean,
  false, 'código repetido en el archivo: ok = false');
select is((select count(*) from public.products where name in ('A1', 'A2')), 0::bigint, 'no se guardó nada');
select is(
  jsonb_array_length(public.inventory_import(pg_temp.w(), '[{"barcode":"7702004003508","name":"B1"}]'::jsonb)->'errors'),
  1, 'código ya existente: se reporta la fila');
select is(
  (public.inventory_import(pg_temp.w(), '[{"name":"C1","unit":"unidad","stock":1.5}]'::jsonb)->>'ok')::boolean,
  false, 'decimal en unidad: se rechaza en la importación');
select is(
  (public.inventory_import(pg_temp.w(), '[{"name":"D1","unit":"litros"},{"name":""}]'::jsonb)->'errors'->1->>'row')::int,
  2, 'se reporta el número de fila con error');
select is(public.inventory_import(pg_temp.w(),
  '[{"barcode":"901","name":"I1","category":"Lácteos","unit":"litro","price_cash":2500,"cost":1200,"stock":5,"min_stock":2},
    {"name":"I2","category":"lácteos","price_cash":900}]'::jsonb),
  '{"ok": true, "created": 2}'::jsonb, 'importación válida crea 2 productos');
select is(pg_temp.stock('I1'), 5::numeric, 'la importación fija el stock inicial');
select is(pg_temp.avg('I1'), 1200.00::numeric, 'la importación fija el costo');
select is((select count(*) from public.product_categories where lower(name) = 'lácteos'), 1::bigint, 'la importación crea la categoría una sola vez');
select is((select price_credit from public.products where name = 'I2'), 900.00::numeric, 'precio a crédito = contado cuando falta');

select is(public.inventory_next_internal_barcode(pg_temp.w()), '2000000000015', 'primer código interno');
select is(public.inventory_next_internal_barcode(pg_temp.w()), '2000000000022', 'segundo código interno consecutivo');

-- ===== Borrado =====
select throws_ok($$delete from public.products where name = 'Arroz'$$, 'P0001', 'PRODUCTO_CON_MOVIMIENTOS', 'no se borra un producto con movimientos');
select is(pg_temp.n($$delete from public.products where name = 'Con código'$$), 1, 'se borra un producto sin movimientos');

-- ===== Aislamiento entre negocios y límites de plan =====
reset role; select pg_temp.act_as('inv.gratis@finanzasapp.test'); set local role authenticated;
select is((select count(*) from public.products where workspace_id = pg_temp.w()), 0::bigint, 'otro negocio no ve estos productos');
select lives_ok($$insert into public.products (workspace_id, name) select pg_temp.gw(), 'G' || g from generate_series(1, 30) g$$, 'gratis crea 30 productos activos');
select throws_ok($$insert into public.products (workspace_id, name) values (pg_temp.gw(), 'G31')$$,
  'P0001', 'LIMITE_PLAN:max_active_products', 'el 31.º producto activo falla');
select lives_ok($$update public.products set active = false where name = 'G1'$$, 'gratis desactiva uno');
select lives_ok($$insert into public.products (workspace_id, name) values (pg_temp.gw(), 'G31')$$, 'ahora cabe uno nuevo');
select throws_ok($$update public.products set active = true where name = 'G1'$$,
  'P0001', 'LIMITE_PLAN:max_active_products', 'reactivar por encima del límite falla');

reset role; select pg_temp.act_as('inv.dueno@finanzasapp.test'); set local role authenticated;
select lives_ok($$insert into public.products (workspace_id, name) select pg_temp.w(), 'P' || g from generate_series(1, 40) g$$, 'pro no tiene límite de productos');

select * from finish();
rollback;
