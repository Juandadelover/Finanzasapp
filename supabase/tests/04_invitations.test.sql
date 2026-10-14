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

select plan(10);

select pg_temp.mkuser('jefe@finanzasapp.test', 'negocio');
select pg_temp.mkuser('invitado@finanzasapp.test', 'gratis');
select pg_temp.mkuser('intruso@finanzasapp.test', 'gratis');
select pg_temp.mkuser('solo@finanzasapp.test', 'gratis');

-- Dueño con cupo invita.
reset role; select pg_temp.act_as('jefe@finanzasapp.test'); set local role authenticated;
select set_config('t.token', (public.invite_member(pg_temp.ws_of('jefe@finanzasapp.test'), 'Invitado@finanzasapp.test', 'editor')).token, true);
select is((select count(*)::int from public.invitations where lower(email) = 'invitado@finanzasapp.test' and status = 'pending'), 1, 'invite_member crea la invitación pendiente');
select is((public.get_invitation(current_setting('t.token'))->>'role'), 'editor', 'get_invitation devuelve el rol');

-- Email equivocado.
reset role; select pg_temp.act_as('intruso@finanzasapp.test'); set local role authenticated;
select throws_ok(format($$select public.accept_invitation(%L)$$, current_setting('t.token')),
  'P0001', null, 'accept_invitation con otro email falla');
select is((select count(*)::int from public.memberships where user_id = auth.uid() and role = 'editor'), 0, 'el intruso no es miembro');

-- Email correcto.
reset role; select pg_temp.act_as('invitado@finanzasapp.test'); set local role authenticated;
select is(public.accept_invitation(current_setting('t.token')), pg_temp.ws_of('jefe@finanzasapp.test'), 'accept_invitation devuelve el negocio');
select is((select role::text from public.memberships where user_id = auth.uid() and workspace_id = pg_temp.ws_of('jefe@finanzasapp.test')), 'editor', 'el invitado entra como editor');
select throws_ok(format($$select public.accept_invitation(%L)$$, current_setting('t.token')),
  'P0001', null, 'la invitación no se puede reutilizar');

-- Un editor no invita.
select throws_ok(format($$select public.invite_member(%L, 'otro@finanzasapp.test', 'recorder')$$, pg_temp.ws_of('jefe@finanzasapp.test')),
  'P0001', 'Solo el dueño o un admin pueden invitar.', 'un editor no puede invitar');

-- Plan Gratis (máx. 1 miembro): sin cupo.
reset role; select pg_temp.act_as('solo@finanzasapp.test'); set local role authenticated;
select throws_ok(format($$select public.invite_member(%L, 'x@finanzasapp.test', 'editor')$$, pg_temp.ws_of('solo@finanzasapp.test')),
  'P0001', 'LIMITE_PLAN:max_members', 'plan Gratis sin cupo para invitar');

-- Un extraño no ve las invitaciones del negocio.
reset role; select pg_temp.act_as('intruso@finanzasapp.test'); set local role authenticated;
select is((select count(*)::int from public.invitations), 0, 'un extraño no ve invitaciones');

select * from finish();
rollback;
