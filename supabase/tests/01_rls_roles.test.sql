-- RLS por rol sobre "Tienda Demo" (requiere supabase/seed/dev_users.sql).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

create function pg_temp.uid(p_email text) returns uuid
language sql security definer as $$ select id from auth.users where email = p_email $$;
create function pg_temp.ws() returns uuid
language sql security definer as $$ select id from public.workspaces where name = 'Tienda Demo' $$;
create function pg_temp.act_as(p_email text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(p_email))::text, true)
$$;

create function pg_temp.n(p_sql text) returns int language plpgsql as $$
declare c int; begin execute p_sql; get diagnostics c = row_count; return c; end $$;

select plan(49);

-- ===== Dueño =====
reset role; select pg_temp.act_as('dueno@finanzasapp.test'); set local role authenticated;
select ok((select count(*) from public.transactions where workspace_id = pg_temp.ws()) > 0, 'dueño lee movimientos');
select lives_ok($$insert into public.transactions (workspace_id, type, amount, description, date)
  values (pg_temp.ws(), 'income', 1000, 't-dueno', current_date)$$, 'dueño inserta movimiento');
select is(pg_temp.n($q$update public.transactions set amount = 2000 where description = 't-dueno'$q$), 1, 'dueño actualiza movimiento');
select lives_ok($$insert into public.accounts (workspace_id, name, kind) values (pg_temp.ws(), 'a-dueno', 'cash')$$, 'dueño crea cuenta');
select lives_ok($$insert into public.contacts (workspace_id, kind, name) values (pg_temp.ws(), 'client', 'c-dueno')$$, 'dueño crea contacto');
select is(pg_temp.n($q$delete from public.transactions where description = 't-dueno'$q$), 1, 'dueño borra movimiento');

-- ===== Admin del negocio =====
reset role; select pg_temp.act_as('adminnegocio@finanzasapp.test'); set local role authenticated;
select ok((select count(*) from public.transactions where workspace_id = pg_temp.ws()) > 0, 'admin lee movimientos');
select lives_ok($$insert into public.transactions (workspace_id, type, amount, description, date)
  values (pg_temp.ws(), 'expense', 1000, 't-admin', current_date)$$, 'admin inserta movimiento');
select is(pg_temp.n($q$update public.transactions set amount = 2000 where description = 't-admin'$q$), 1, 'admin actualiza movimiento');
select is(pg_temp.n($q$delete from public.transactions where description = 't-admin'$q$), 1, 'admin borra movimiento');
select lives_ok($$insert into public.accounts (workspace_id, name, kind) values (pg_temp.ws(), 'a-admin', 'cash')$$, 'admin crea cuenta');
select is(pg_temp.n($q$update public.workspaces set monthly_budget = 5000000 where id = pg_temp.ws()$q$), 1, 'admin edita el negocio');

-- ===== Editor =====
reset role; select pg_temp.act_as('editor@finanzasapp.test'); set local role authenticated;
select ok((select count(*) from public.transactions where workspace_id = pg_temp.ws()) > 0, 'editor lee movimientos');
select lives_ok($$insert into public.transactions (workspace_id, type, amount, description, date)
  values (pg_temp.ws(), 'income', 1000, 't-editor', current_date)$$, 'editor inserta movimiento');
select is(pg_temp.n($q$update public.transactions set amount = 2000 where description = 't-editor'$q$), 1, 'editor actualiza movimiento');
select is(pg_temp.n($q$delete from public.transactions where description = 't-editor'$q$), 1, 'editor borra movimiento');
select lives_ok($$insert into public.contacts (workspace_id, kind, name) values (pg_temp.ws(), 'supplier', 'c-editor')$$, 'editor crea contacto');
select is(pg_temp.n($q$update public.workspaces set monthly_budget = 1 where id = pg_temp.ws()$q$), 0, 'editor no edita el negocio');
select is(pg_temp.n($q$update public.memberships set role = 'admin' where role = 'recorder'$q$), 0, 'editor no cambia roles de miembros');

-- ===== Contador (solo lectura) =====
reset role; select pg_temp.act_as('contador@finanzasapp.test'); set local role authenticated;
select ok((select count(*) from public.transactions where workspace_id = pg_temp.ws()) > 0, 'contador lee movimientos');
select ok((select count(*) from public.accounts where workspace_id = pg_temp.ws()) > 0, 'contador lee cuentas');
select ok((select count(*) from public.contacts where workspace_id = pg_temp.ws()) > 0, 'contador lee contactos');
select ok((select count(*) from public.collection_documents where workspace_id = pg_temp.ws()) > 0, 'contador lee documentos de cobro');
select throws_ok($$insert into public.transactions (workspace_id, type, amount, description, date)
  values (pg_temp.ws(), 'expense', 1000, 't-cont', current_date)$$, '42501', null, 'contador no inserta movimientos');
select is(pg_temp.n($q$update public.transactions set amount = 1$q$), 0, 'contador no actualiza movimientos');
select is(pg_temp.n($q$delete from public.transactions$q$), 0, 'contador no borra movimientos');
select throws_ok($$insert into public.accounts (workspace_id, name, kind) values (pg_temp.ws(), 'a-cont', 'cash')$$, '42501', null, 'contador no crea cuentas');
select throws_ok($$insert into public.contacts (workspace_id, kind, name) values (pg_temp.ws(), 'client', 'c-cont')$$, '42501', null, 'contador no crea contactos');
select is(pg_temp.n($q$update public.accounts set name = 'x'$q$), 0, 'contador no actualiza cuentas');
select throws_ok($$insert into public.collection_documents (workspace_id, kind, number, total)
  values (pg_temp.ws(), 'quote', 0, 1)$$, '42501', null, 'contador no crea documentos');

-- ===== Solo registro =====
reset role; select pg_temp.act_as('registro@finanzasapp.test'); set local role authenticated;
select lives_ok($$insert into public.transactions (workspace_id, type, amount, description, date)
  values (pg_temp.ws(), 'expense', 1000, 't-reg', current_date)$$, 'registro inserta gasto');
select throws_ok($$insert into public.transactions (workspace_id, type, amount, description, date)
  values (pg_temp.ws(), 'income', 1000, 't-reg-ing', current_date)$$, '42501', null, 'registro no inserta ingresos');
select throws_ok($$insert into public.transactions (workspace_id, type, amount, description, date, created_by)
  values (pg_temp.ws(), 'expense', 1000, 't-reg-otro', current_date, pg_temp.uid('dueno@finanzasapp.test'))$$, '42501', null, 'registro no registra a nombre de otro');
select is((select count(*)::int from public.transactions where created_by is distinct from auth.uid()), 0, 'registro no ve movimientos de otros');
select ok((select count(*) from public.transactions where created_by = auth.uid()) >= 3, 'registro ve los suyos');
select is(pg_temp.n($q$update public.transactions set amount = 1$q$), 0, 'registro no actualiza movimientos');
select is(pg_temp.n($q$delete from public.transactions$q$), 0, 'registro no borra movimientos');
select throws_ok($$insert into public.accounts (workspace_id, name, kind) values (pg_temp.ws(), 'a-reg', 'cash')$$, '42501', null, 'registro no crea cuentas');
select is((select count(*)::int from public.collection_documents), 0, 'registro no ve documentos de cobro');

-- ===== Gratis (sin acceso a Tienda Demo) =====
reset role; select pg_temp.act_as('gratis@finanzasapp.test'); set local role authenticated;
select is((select count(*)::int from public.transactions where workspace_id = pg_temp.ws()), 0, 'gratis no ve movimientos de Tienda Demo');
select is((select count(*)::int from public.accounts where workspace_id = pg_temp.ws()), 0, 'gratis no ve cuentas de Tienda Demo');
select is((select count(*)::int from public.contacts where workspace_id = pg_temp.ws()), 0, 'gratis no ve contactos de Tienda Demo');
select is((select count(*)::int from public.categories where workspace_id = pg_temp.ws()), 0, 'gratis no ve categorías de Tienda Demo');
select is((select count(*)::int from public.collection_documents where workspace_id = pg_temp.ws()), 0, 'gratis no ve documentos de Tienda Demo');
select is((select count(*)::int from public.workspaces where name = 'Tienda Demo'), 0, 'gratis no ve el negocio Tienda Demo');
select is((select count(*)::int from public.memberships where workspace_id = pg_temp.ws()), 0, 'gratis no ve miembros de Tienda Demo');
select throws_ok($$insert into public.transactions (workspace_id, type, amount, description, date)
  values (pg_temp.ws(), 'expense', 1000, 't-gratis', current_date)$$, '42501', null, 'gratis no inserta en Tienda Demo');
select is(pg_temp.n($q$update public.transactions set amount = 1$q$), 0, 'gratis no actualiza movimientos ajenos');

-- ===== Anónimo =====
reset role; set local role anon;
select is((select count(*)::int from public.transactions), 0, 'anon no ve movimientos');

select * from finish();
rollback;
