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

select pg_temp.mkuser('recurrente@finanzasapp.test', 'negocio');
insert into public.recurrences (workspace_id, created_by, type, amount, description, frequency, start_date, next_date, generated_status)
values (pg_temp.ws_of('recurrente@finanzasapp.test'), pg_temp.uid('recurrente@finanzasapp.test'),
        'expense', 100000, 'Arriendo', 'monthly', '2026-01-31', '2026-01-31', 'pending');

select is(public.generate_recurring_transactions(pg_temp.ws_of('recurrente@finanzasapp.test'), '2026-03-31'), 3, 'genera 3 movimientos hasta el 31 de marzo');
select results_eq(
  $$select date from public.transactions where recurrence_id is not null
    and workspace_id = pg_temp.ws_of('recurrente@finanzasapp.test') order by date$$,
  $$values ('2026-01-31'::date), ('2026-02-28'::date), ('2026-03-31'::date)$$,
  'fechas: 31 ene, 28 feb, 31 mar');
select is((select next_date from public.recurrences where workspace_id = pg_temp.ws_of('recurrente@finanzasapp.test')), '2026-04-30'::date, 'la siguiente fecha es 30 abr');
select is((select occurrences from public.recurrences where workspace_id = pg_temp.ws_of('recurrente@finanzasapp.test')), 3, 'cuenta 3 ocurrencias');
select is(public.generate_recurring_transactions(pg_temp.ws_of('recurrente@finanzasapp.test'), '2026-03-31'), 0, 'volver a correr no duplica');

-- Un contador no puede ejecutar recurrencias.
reset role; select pg_temp.act_as('contador@finanzasapp.test'); set local role authenticated;
select throws_ok($$select public.run_recurrences((select id from public.workspaces where name = 'Tienda Demo'))$$,
  'P0001', 'Sin permiso.', 'el contador no ejecuta recurrencias');

select * from finish();
rollback;
