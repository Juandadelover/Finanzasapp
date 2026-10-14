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

select plan(15);

select pg_temp.mkuser('pagador@finanzasapp.test', 'gratis');
select is(public.effective_plan(pg_temp.uid('pagador@finanzasapp.test')), 'gratis', 'parte en plan Gratis');

reset role; select pg_temp.act_as('pagador@finanzasapp.test'); set local role authenticated;
select set_config('t.pay', (public.start_payment('emprendedor', 'monthly')).id::text, true);
select is((select status::text from public.payments where id = current_setting('t.pay')::uuid), 'awaiting_receipt', 'start_payment deja el pago esperando comprobante');
select is((select expected_amount from public.payments where id = current_setting('t.pay')::uuid), 24900, 'el monto esperado es el del plan');

select lives_ok(format($$select public.submit_payment_receipt(%L, 'nequi', 24900, %L, 'sha-pagador-1')$$,
  current_setting('t.pay'), pg_temp.uid('pagador@finanzasapp.test') || '/recibo.png'), 'submit_payment_receipt');
select is((select status::text from public.payments where id = current_setting('t.pay')::uuid), 'in_review', 'el pago queda en revisión');
select is((public.my_subscription()->>'status'), 'provisional', 'acceso provisional mientras se revisa');

-- Quien no es admin de plataforma no puede aprobar.
select throws_ok(format($$select public.approve_payment(%L)$$, current_setting('t.pay')),
  'P0001', 'Solo administradores.', 'el cliente no puede aprobar su propio pago');
reset role; select pg_temp.act_as('dueno@finanzasapp.test'); set local role authenticated;
select throws_ok(format($$select public.approve_payment(%L)$$, current_setting('t.pay')),
  'P0001', 'Solo administradores.', 'un dueño ajeno no puede aprobar pagos');

-- El dueño tampoco puede tocar suscripciones.
reset role; select pg_temp.act_as('pagador@finanzasapp.test'); set local role authenticated;
select is(pg_temp.n($q$update public.subscriptions set plan_code = 'pro'$q$), 0, 'el dueño no actualiza su suscripción');
select throws_ok($$insert into public.subscriptions (owner_id, plan_code, status)
  values (gen_random_uuid(), 'pro', 'active')$$, '42501', null, 'el dueño no inserta suscripciones');

-- El admin aprueba.
reset role; select pg_temp.act_as('admin@finanzasapp.test'); set local role authenticated;
select lives_ok(format($$select public.approve_payment(%L)$$, current_setting('t.pay')), 'admin@ aprueba el pago');
select is((select status::text from public.payments where id = current_setting('t.pay')::uuid), 'approved', 'el pago queda aprobado');
reset role;
select is(public.effective_plan(pg_temp.uid('pagador@finanzasapp.test')), 'emprendedor', 'el plan vigente pasa a emprendedor');
select pg_temp.act_as('pagador@finanzasapp.test'); set local role authenticated;
select is((public.my_subscription()->>'status'), 'active', 'la suscripción queda activa');
reset role;
select is((select count(*)::int from public.audit_log where action = 'approve_payment' and entity_id = current_setting('t.pay')), 1, 'queda registrado en la bitácora');

select * from finish();
rollback;
