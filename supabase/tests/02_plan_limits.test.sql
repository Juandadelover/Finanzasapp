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

select plan(6);

select pg_temp.mkuser('limite@finanzasapp.test', 'gratis');
select is(public.effective_plan(pg_temp.uid('limite@finanzasapp.test')), 'gratis', 'el usuario está en plan Gratis');

-- 100 movimientos caben; el 101 no.
select lives_ok($$insert into public.transactions (workspace_id, created_by, type, amount, description, date)
  select pg_temp.ws_of('limite@finanzasapp.test'), pg_temp.uid('limite@finanzasapp.test'), 'income', 1000, 'm' || g, current_date
  from generate_series(1, 100) g$$, 'gratis inserta 100 movimientos');

reset role; select pg_temp.act_as('limite@finanzasapp.test'); set local role authenticated;
select throws_ok($$insert into public.transactions (workspace_id, type, amount, description, date)
  values (pg_temp.ws_of('limite@finanzasapp.test'), 'income', 1000, 'm101', current_date)$$,
  'P0001', 'LIMITE_PLAN:max_tx_per_month', 'el movimiento 101 lanza LIMITE_PLAN:max_tx_per_month');
select is((public.my_subscription()->'usage'->>'tx_this_month')::int, 100, 'el uso mensual es 100');

-- Con un plan de pago desaparece el límite.
reset role;
update public.subscriptions set plan_code = 'emprendedor', current_period_end = now() + interval '1 month'
  where owner_id = pg_temp.uid('limite@finanzasapp.test');
select pg_temp.act_as('limite@finanzasapp.test'); set local role authenticated;
select lives_ok($$insert into public.transactions (workspace_id, type, amount, description, date)
  values (pg_temp.ws_of('limite@finanzasapp.test'), 'income', 1000, 'm101', current_date)$$, 'con Emprendedor el movimiento 101 entra');

-- Segundo negocio en Gratis (máx. 1) lanza LIMITE_PLAN:max_workspaces_owned.
reset role;
update public.subscriptions set plan_code = 'gratis', current_period_end = null
  where owner_id = pg_temp.uid('limite@finanzasapp.test');
select pg_temp.act_as('limite@finanzasapp.test'); set local role authenticated;
select throws_ok($$insert into public.workspaces (name, owner_id) values ('Otro', auth.uid())$$,
  'P0001', 'LIMITE_PLAN:max_workspaces_owned', 'gratis no crea un segundo negocio');

select * from finish();
rollback;
