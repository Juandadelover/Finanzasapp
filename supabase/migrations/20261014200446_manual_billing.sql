-- Fase 2 del SaaS: cobro manual (D4). El cliente paga por fuera (Nequi,
-- Bancolombia, Bre-B), sube el comprobante y un admin de plataforma lo aprueba.
-- El plan vigente se calcula por fechas (sin tareas programadas) y los límites
-- de cada plan se aplican en la base de datos. No destructiva.

alter type public.payment_status add value if not exists 'awaiting_receipt' before 'in_review';

alter table public.subscriptions
  add column provisional_plan text references public.plans(code),
  add column provisional_period_end timestamptz;

insert into public.plan_limits (plan_code, key, value) values
  ('gratis',      'max_collection_docs_per_month', '3'),
  ('emprendedor', 'max_collection_docs_per_month', 'null'),
  ('negocio',     'max_collection_docs_per_month', 'null'),
  ('pro',         'max_collection_docs_per_month', 'null')
on conflict (plan_code, key) do nothing;

-- Días de gracia después del vencimiento antes de bajar a Gratis.
create function public.grace_days() returns interval
language sql immutable as $$ select interval '5 days' $$;

-- ---------------------------------------------------------------------------
-- 1. Bitácora de acciones de administración
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy audit_log_admin_select on public.audit_log for select using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 2. Plan vigente y límites
-- ---------------------------------------------------------------------------
create function public.effective_plan(p_owner uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
      when s.status <> 'canceled' and s.current_period_end is not null
           and s.current_period_end + public.grace_days() > now() then s.plan_code
      when s.provisional_until > now() then s.provisional_plan
      when s.status = 'trial' and s.trial_end > now() then s.plan_code
      when s.plan_code = 'gratis' then 'gratis'
      else 'gratis'
    end
    from public.subscriptions s where s.owner_id = p_owner
  ), 'gratis');
$$;

create function public.plan_limit(p_owner uuid, p_key text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select l.value from public.plan_limits l
  where l.plan_code = public.effective_plan(p_owner) and l.key = p_key;
$$;

-- Estado de la suscripción del usuario actual, para la pantalla "Mi suscripción".
create function public.my_subscription()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  s public.subscriptions;
  v_plan text;
  v_status text;
begin
  select * into s from public.subscriptions where owner_id = auth.uid();
  v_plan := public.effective_plan(auth.uid());
  v_status := case
    when s is null then 'free'
    when s.current_period_end is not null and s.current_period_end > now() then 'active'
    when s.current_period_end is not null and s.current_period_end + public.grace_days() > now() then 'grace'
    when s.provisional_until > now() then 'provisional'
    when s.status = 'trial' and s.trial_end > now() then 'trial'
    when s.plan_code = 'gratis' then 'free'
    else 'expired'
  end;

  return jsonb_build_object(
    'effective_plan', v_plan,
    'status', v_status,
    'plan_code', s.plan_code,
    'billing_cycle', s.billing_cycle,
    'trial_end', s.trial_end,
    'current_period_end', s.current_period_end,
    'grace_until', s.current_period_end + public.grace_days(),
    'provisional_until', s.provisional_until,
    'provisional_plan', s.provisional_plan,
    'limits', (select coalesce(jsonb_object_agg(key, value), '{}') from public.plan_limits where plan_code = v_plan),
    'usage', jsonb_build_object(
      'workspaces_owned', (select count(*) from public.workspaces where owner_id = auth.uid()),
      'tx_this_month', (
        select count(*) from public.transactions t join public.workspaces w on w.id = t.workspace_id
        where w.owner_id = auth.uid() and t.created_at >= date_trunc('month', now())),
      'collection_docs_this_month', (
        select count(*) from public.collection_documents d join public.workspaces w on w.id = d.workspace_id
        where w.owner_id = auth.uid() and d.kind = 'collection' and d.created_at >= date_trunc('month', now()))
    )
  );
end;
$$;

-- Plan del dueño de un negocio, para que los miembros sepan qué está disponible.
create function public.workspace_plan(p_workspace uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'effective_plan', public.effective_plan(w.owner_id),
    'limits', (select coalesce(jsonb_object_agg(l.key, l.value), '{}') from public.plan_limits l
               where l.plan_code = public.effective_plan(w.owner_id)))
  from public.workspaces w
  where w.id = p_workspace and public.is_workspace_member(p_workspace);
$$;

-- ---------------------------------------------------------------------------
-- 3. Límites aplicados en la base de datos. Error: 'LIMITE_PLAN:<clave>'.
-- ---------------------------------------------------------------------------
create function public.enforce_plan_limits()
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
  end if;

  return new;
end;
$$;

create trigger workspaces_plan_limits before insert on public.workspaces
  for each row execute function public.enforce_plan_limits();
create trigger memberships_plan_limits before insert on public.memberships
  for each row execute function public.enforce_plan_limits();
create trigger transactions_plan_limits before insert on public.transactions
  for each row execute function public.enforce_plan_limits();
create trigger collection_documents_plan_limits before insert on public.collection_documents
  for each row execute function public.enforce_plan_limits();

revoke execute on function public.enforce_plan_limits() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Flujo de pago del cliente
-- ---------------------------------------------------------------------------
-- Paso 1: elegir plan y ciclo. Devuelve la referencia y el monto a pagar.
create function public.start_payment(p_plan text, p_cycle text)
returns public.payments
language plpgsql
security definer set search_path = ''
as $$
declare
  v_price integer;
  v_ref text;
  v_pay public.payments;
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  if p_cycle not in ('monthly', 'annual') then raise exception 'Ciclo no válido.'; end if;

  select case p_cycle when 'monthly' then monthly_price else annual_price end into v_price
  from public.plans where code = p_plan and active and code <> 'gratis';
  if v_price is null then raise exception 'Plan no válido.'; end if;

  if exists (select 1 from public.payments where owner_id = auth.uid() and status = 'in_review') then
    raise exception 'Ya tienes un pago en revisión. Te avisaremos cuando lo confirmemos.';
  end if;

  -- Reutiliza la solicitud abierta, actualizando plan y monto.
  select * into v_pay from public.payments
  where owner_id = auth.uid() and status = 'awaiting_receipt'
  order by created_at desc limit 1;

  if found then
    update public.payments
      set plan_code = p_plan, billing_cycle = p_cycle, expected_amount = v_price, created_at = now()
      where id = v_pay.id
      returning * into v_pay;
    return v_pay;
  end if;

  loop
    v_ref := 'FZ-' || upper(substr(md5(gen_random_uuid()::text), 1, 5));
    exit when not exists (select 1 from public.payments where reference = v_ref);
  end loop;

  insert into public.subscriptions (owner_id, plan_code, status)
  values (auth.uid(), 'gratis', 'active')
  on conflict (owner_id) do nothing;

  insert into public.payments (owner_id, plan_code, billing_cycle, expected_amount, reference, status)
  values (auth.uid(), p_plan, p_cycle, v_price, v_ref, 'awaiting_receipt')
  returning * into v_pay;
  return v_pay;
end;
$$;

-- Paso 2: subir el comprobante. Queda en revisión y, una vez por periodo,
-- da 48 h de acceso provisional al plan pagado (RF-SUB-06).
create function public.submit_payment_receipt(
  p_payment uuid, p_channel text, p_declared_amount integer, p_receipt_path text, p_receipt_sha256 text)
returns public.payments
language plpgsql
security definer set search_path = ''
as $$
declare
  v_pay public.payments;
  s public.subscriptions;
begin
  select * into v_pay from public.payments
  where id = p_payment and owner_id = auth.uid() and status = 'awaiting_receipt'
  for update;
  if not found then raise exception 'Solicitud de pago no encontrada.'; end if;
  if p_channel not in ('nequi', 'bancolombia', 'breb') then raise exception 'Medio de pago no válido.'; end if;
  if p_receipt_path is null or split_part(p_receipt_path, '/', 1) <> auth.uid()::text then
    raise exception 'Comprobante no válido.';
  end if;
  if p_receipt_sha256 is not null and exists (
    select 1 from public.payments where receipt_sha256 = p_receipt_sha256 and status <> 'rejected' and id <> p_payment
  ) then
    raise exception 'Este comprobante ya fue usado en otro pago.';
  end if;

  update public.payments
    set status = 'in_review', channel = p_channel, declared_amount = p_declared_amount,
        receipt_path = p_receipt_path, receipt_sha256 = p_receipt_sha256, created_at = now()
    where id = p_payment
    returning * into v_pay;

  select * into s from public.subscriptions where owner_id = auth.uid() for update;
  if s.provisional_period_end is distinct from s.current_period_end or s.provisional_until is null then
    update public.subscriptions
      set provisional_until = now() + interval '48 hours',
          provisional_plan = v_pay.plan_code,
          provisional_period_end = current_period_end,
          updated_at = now()
      where owner_id = auth.uid();
  end if;

  return v_pay;
end;
$$;

-- El cliente puede cancelar la renovación (sigue activo hasta el vencimiento).
create function public.set_cancel_at_period_end(p_cancel boolean)
returns void
language sql
security definer set search_path = ''
as $$
  update public.subscriptions set cancel_at_period_end = p_cancel, updated_at = now()
  where owner_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 5. Panel de administración
-- ---------------------------------------------------------------------------
create function public.assert_platform_admin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Solo administradores.'; end if;
end;
$$;

create function public.admin_payments(p_status text default 'in_review')
returns table (
  id uuid, owner_id uuid, email text, full_name text, plan_code text, billing_cycle text,
  expected_amount integer, declared_amount integer, reference text, channel text, status text,
  receipt_path text, rejection_reason text, created_at timestamptz, reviewed_at timestamptz,
  current_plan text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  return query
    select p.id, p.owner_id, u.email::text, pr.full_name, p.plan_code, p.billing_cycle,
           p.expected_amount, p.declared_amount, p.reference, p.channel, p.status::text,
           p.receipt_path, p.rejection_reason, p.created_at, p.reviewed_at,
           public.effective_plan(p.owner_id)
    from public.payments p
    join auth.users u on u.id = p.owner_id
    left join public.profiles pr on pr.id = p.owner_id
    where p_status = 'all' or p.status::text = p_status
    order by p.created_at desc
    limit 200;
end;
$$;

create function public.approve_payment(p_payment uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_pay public.payments;
  s public.subscriptions;
  v_base timestamptz;
begin
  perform public.assert_platform_admin();
  select * into v_pay from public.payments where id = p_payment for update;
  if not found or v_pay.status <> 'in_review' then raise exception 'El pago no está en revisión.'; end if;

  select * into s from public.subscriptions where owner_id = v_pay.owner_id for update;
  -- Renovación del mismo plan: se suma al vencimiento vigente; cambio de plan: desde hoy.
  v_base := case
    when s.plan_code = v_pay.plan_code and s.current_period_end > now() then s.current_period_end
    else now() end;

  update public.payments set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_payment;

  insert into public.subscriptions (owner_id, plan_code, billing_cycle, status, current_period_end)
  values (v_pay.owner_id, v_pay.plan_code, v_pay.billing_cycle, 'active',
          v_base + case v_pay.billing_cycle when 'annual' then interval '1 year' else interval '1 month' end)
  on conflict (owner_id) do update set
    plan_code = excluded.plan_code,
    billing_cycle = excluded.billing_cycle,
    status = 'active',
    trial_end = null,
    current_period_end = excluded.current_period_end,
    provisional_until = null,
    provisional_plan = null,
    grace_until = null,
    cancel_at_period_end = false,
    updated_at = now();

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'approve_payment', 'payment', p_payment::text,
          jsonb_build_object('owner_id', v_pay.owner_id, 'plan', v_pay.plan_code, 'amount', v_pay.expected_amount));
end;
$$;

create function public.reject_payment(p_payment uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_pay public.payments;
begin
  perform public.assert_platform_admin();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Indica el motivo del rechazo.'; end if;
  select * into v_pay from public.payments where id = p_payment for update;
  if not found or v_pay.status <> 'in_review' then raise exception 'El pago no está en revisión.'; end if;

  update public.payments
    set status = 'rejected', rejection_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_payment;
  update public.subscriptions set provisional_until = null, updated_at = now()
    where owner_id = v_pay.owner_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'reject_payment', 'payment', p_payment::text,
          jsonb_build_object('owner_id', v_pay.owner_id, 'reason', p_reason));
end;
$$;

create function public.admin_customers(p_search text default '')
returns table (
  owner_id uuid, email text, full_name text, plan_code text, billing_cycle text, status text,
  effective_plan text, trial_end timestamptz, current_period_end timestamptz,
  workspaces bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  return query
    select u.id, u.email::text, pr.full_name, s.plan_code, s.billing_cycle, s.status::text,
           public.effective_plan(u.id), s.trial_end, s.current_period_end,
           (select count(*) from public.workspaces w where w.owner_id = u.id), u.created_at
    from auth.users u
    left join public.subscriptions s on s.owner_id = u.id
    left join public.profiles pr on pr.id = u.id
    where not u.is_anonymous
      and (coalesce(p_search, '') = '' or u.email ilike '%' || p_search || '%'
           or pr.full_name ilike '%' || p_search || '%')
    order by u.created_at desc
    limit 100;
end;
$$;

-- Activar o extender manualmente (cortesías, soporte). Motivo obligatorio.
create function public.admin_set_subscription(
  p_owner uuid, p_plan text, p_cycle text, p_period_end timestamptz, p_reason text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Indica el motivo.'; end if;
  if not exists (select 1 from public.plans where code = p_plan) then raise exception 'Plan no válido.'; end if;

  insert into public.subscriptions (owner_id, plan_code, billing_cycle, status, current_period_end)
  values (p_owner, p_plan, p_cycle, 'active', p_period_end)
  on conflict (owner_id) do update set
    plan_code = excluded.plan_code, billing_cycle = excluded.billing_cycle, status = 'active',
    trial_end = null, current_period_end = excluded.current_period_end,
    provisional_until = null, provisional_plan = null, updated_at = now();

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'set_subscription', 'subscription', p_owner::text,
          jsonb_build_object('plan', p_plan, 'cycle', p_cycle, 'period_end', p_period_end, 'reason', p_reason));
end;
$$;

create function public.admin_metrics()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  perform public.assert_platform_admin();
  select jsonb_build_object(
    'mrr', coalesce(sum(case s.billing_cycle when 'annual' then p.annual_price / 12.0 else p.monthly_price end), 0)::int,
    'paying', count(*)
  ) into v
  from public.subscriptions s join public.plans p on p.code = s.plan_code
  where s.current_period_end > now() and s.plan_code <> 'gratis';

  return v || jsonb_build_object(
    'by_plan', (select coalesce(jsonb_object_agg(plan_code, n), '{}') from (
      select s.plan_code, count(*) n from public.subscriptions s
      where s.current_period_end > now() and s.plan_code <> 'gratis' group by s.plan_code) x),
    'in_review', (select count(*) from public.payments where status = 'in_review'),
    'expiring_7d', (select count(*) from public.subscriptions
                    where current_period_end between now() and now() + interval '7 days'),
    'in_grace', (select count(*) from public.subscriptions
                 where current_period_end < now() and current_period_end + public.grace_days() > now()),
    'trials', (select count(*) from public.subscriptions where status = 'trial' and trial_end > now()),
    'revenue_this_month', (select coalesce(sum(expected_amount), 0) from public.payments
                           where status = 'approved' and reviewed_at >= date_trunc('month', now()))
  );
end;
$$;

revoke execute on function public.admin_payments(text) from anon;
revoke execute on function public.approve_payment(uuid) from anon;
revoke execute on function public.reject_payment(uuid, text) from anon;
revoke execute on function public.admin_customers(text) from anon;
revoke execute on function public.admin_set_subscription(uuid, text, text, timestamptz, text) from anon;
revoke execute on function public.admin_metrics() from anon;
revoke execute on function public.start_payment(text, text) from anon;
revoke execute on function public.submit_payment_receipt(uuid, text, integer, text, text) from anon;
revoke execute on function public.set_cancel_at_period_end(boolean) from anon;
revoke execute on function public.my_subscription() from anon;

-- ---------------------------------------------------------------------------
-- 6. Comprobantes en Storage (bucket privado, carpeta por usuario)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy payment_receipts_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy payment_receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_platform_admin()));
