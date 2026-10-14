-- Consola del administrador de la plataforma: ficha de cliente e ingresos del
-- SaaS. Solo agregados y metadatos: nunca montos ni movimientos de los clientes.
-- No destructiva.

-- Ficha de un cliente (dueño): perfil, suscripción, negocios con uso y pagos.
create function public.admin_customer_detail(p_owner uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  perform public.assert_platform_admin();

  select jsonb_build_object(
    'owner_id', u.id,
    'email', u.email,
    'full_name', p.full_name,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'terms_accepted_at', p.terms_accepted_at,
    'deletion_requested_at', p.deletion_requested_at,
    'effective_plan', public.effective_plan(u.id),
    'subscription', (
      select jsonb_build_object(
        'plan_code', s.plan_code, 'billing_cycle', s.billing_cycle, 'status', s.status,
        'trial_end', s.trial_end, 'current_period_end', s.current_period_end,
        'grace_until', s.current_period_end + public.grace_days(),
        'provisional_until', s.provisional_until, 'cancel_at_period_end', s.cancel_at_period_end)
      from public.subscriptions s where s.owner_id = u.id),
    'workspaces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id,
        'name', w.name,
        'created_at', w.created_at,
        'members', (select count(*) from public.memberships m where m.workspace_id = w.id),
        'transactions_total', (select count(*) from public.transactions t where t.workspace_id = w.id),
        'transactions_this_month', (select count(*) from public.transactions t
                                    where t.workspace_id = w.id and t.created_at >= date_trunc('month', now())),
        'collection_docs_this_month', (select count(*) from public.collection_documents d
                                       where d.workspace_id = w.id and d.kind = 'collection'
                                         and d.created_at >= date_trunc('month', now())),
        'last_activity_at', (select max(t.created_at) from public.transactions t where t.workspace_id = w.id)
      ) order by w.created_at)
      from public.workspaces w where w.owner_id = u.id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pay.id, 'reference', pay.reference, 'plan_code', pay.plan_code,
        'billing_cycle', pay.billing_cycle, 'expected_amount', pay.expected_amount,
        'declared_amount', pay.declared_amount, 'channel', pay.channel, 'status', pay.status,
        'rejection_reason', pay.rejection_reason, 'created_at', pay.created_at,
        'reviewed_at', pay.reviewed_at) order by pay.created_at desc)
      from public.payments pay where pay.owner_id = u.id), '[]'::jsonb)
  ) into v
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_owner;

  if v is null then raise exception 'Cliente no encontrado.'; end if;
  return v;
end;
$$;

-- Serie mensual de los últimos p_months meses (incluido el actual).
--  revenue: pagos aprobados en el mes (COP)
--  new_signups: cuentas nuevas no anónimas
--  new_paying: dueños con su primer pago aprobado en el mes
--  expired: suscripciones pagas cuyo periodo + gracia terminó en el mes y no se renovaron
--  trials_started / trials_converted: dueños registrados en el mes (cada uno inicia prueba) y cuántos ya pagaron
create function public.admin_revenue_series(p_months integer default 12)
returns table (
  month date, revenue bigint, approved_payments bigint, new_signups bigint, new_paying bigint,
  expired bigint, trials_started bigint, trials_converted bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  return query
  with months as (
    select generate_series(
      date_trunc('month', now()) - make_interval(months => greatest(p_months, 1) - 1),
      date_trunc('month', now()), interval '1 month')::date as m
  ),
  first_paid as (
    select owner_id, min(reviewed_at) as first_at
    from public.payments where status = 'approved' group by owner_id
  ),
  -- Dueños registrados (cada uno arranca con su prueba): sin anónimos, invitados ni admins.
  owners as (
    select u.id, u.created_at from auth.users u
    where not u.is_anonymous
      and not coalesce((u.raw_user_meta_data->>'invited')::boolean, false)
      and not exists (select 1 from public.platform_admins a where a.user_id = u.id)
  )
  select
    mo.m,
    coalesce((select sum(p.expected_amount) from public.payments p
              where p.status = 'approved' and date_trunc('month', p.reviewed_at)::date = mo.m), 0)::bigint,
    (select count(*) from public.payments p
     where p.status = 'approved' and date_trunc('month', p.reviewed_at)::date = mo.m),
    (select count(*) from auth.users u
     where not u.is_anonymous and date_trunc('month', u.created_at)::date = mo.m),
    (select count(*) from first_paid f where date_trunc('month', f.first_at)::date = mo.m),
    (select count(*) from public.subscriptions s
     where s.plan_code <> 'gratis' and s.current_period_end is not null
       and s.current_period_end + public.grace_days() < now()
       and date_trunc('month', s.current_period_end + public.grace_days())::date = mo.m),
    (select count(*) from owners o where date_trunc('month', o.created_at)::date = mo.m),
    (select count(*) from owners o join first_paid f on f.owner_id = o.id
     where date_trunc('month', o.created_at)::date = mo.m)
  from months mo
  order by mo.m;
end;
$$;

revoke execute on function public.admin_customer_detail(uuid) from public, anon;
revoke execute on function public.admin_revenue_series(integer) from public, anon;
grant execute on function public.admin_customer_detail(uuid) to authenticated;
grant execute on function public.admin_revenue_series(integer) to authenticated;
