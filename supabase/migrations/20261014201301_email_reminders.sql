-- Recordatorios y avisos por email (RF-SUB-08, RF-ADM-06, RNF-OPS-07).
-- Los correos se encolan en email_outbox (sin duplicados) y la Edge Function
-- "send-emails" los envía por Resend. pg_cron programa ambas cosas.
-- El secreto que autoriza a pg_cron a llamar la función vive en Vault
-- ("send_emails_cron_secret") y no en este archivo.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.email_outbox (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  to_email text not null,
  kind text not null,
  dedupe_key text not null unique,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_pending_idx on public.email_outbox(created_at) where status = 'pending';
alter table public.email_outbox enable row level security;
create policy email_outbox_admin_select on public.email_outbox for select using (public.is_platform_admin());

create function public.enqueue_email(p_user uuid, p_kind text, p_dedupe_key text, p_payload jsonb)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_email text;
  v_name text;
begin
  select u.email, coalesce(p.full_name, '') into v_email, v_name
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = p_user and not u.is_anonymous;
  -- .test es un dominio reservado (usuarios de prueba): enviarles solo genera rebotes.
  if v_email is null or v_email ilike '%.test' then return; end if;

  insert into public.email_outbox (owner_id, to_email, kind, dedupe_key, payload)
  values (p_user, v_email, p_kind, p_dedupe_key, p_payload || jsonb_build_object('name', v_name))
  on conflict (dedupe_key) do nothing;
end;
$$;

-- Revisión diaria del estado de las suscripciones.
create function public.enqueue_subscription_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  s record;
  v_days integer;
  v_count integer := 0;
begin
  for s in
    select sub.*, pl.name as plan_name, pl.monthly_price, pl.annual_price
    from public.subscriptions sub join public.plans pl on pl.code = sub.plan_code
  loop
    -- Prueba gratis por terminar.
    if s.status = 'trial' and s.trial_end is not null then
      v_days := s.trial_end::date - current_date;
      if v_days in (3, 1) then
        perform public.enqueue_email(s.owner_id, 'trial_ending',
          'trial_ending:' || s.owner_id || ':' || s.trial_end::date || ':' || v_days,
          jsonb_build_object('days', v_days, 'date', s.trial_end::date, 'plan', s.plan_name));
        v_count := v_count + 1;
      end if;
    end if;

    if s.current_period_end is not null and s.plan_code <> 'gratis' then
      v_days := s.current_period_end::date - current_date;
      -- Renovación próxima (no se recuerda si canceló la renovación).
      if v_days in (7, 3, 1) and not s.cancel_at_period_end then
        perform public.enqueue_email(s.owner_id, 'renewal_due',
          'renewal_due:' || s.owner_id || ':' || s.current_period_end::date || ':' || v_days,
          jsonb_build_object('days', v_days, 'date', s.current_period_end::date, 'plan', s.plan_name,
            'amount', case s.billing_cycle when 'annual' then s.annual_price else s.monthly_price end,
            'cycle', s.billing_cycle));
        v_count := v_count + 1;
      end if;
      -- Entró en periodo de gracia.
      if v_days < 0 and s.current_period_end + public.grace_days() > now() then
        perform public.enqueue_email(s.owner_id, 'grace',
          'grace:' || s.owner_id || ':' || s.current_period_end::date,
          jsonb_build_object('date', (s.current_period_end + public.grace_days())::date, 'plan', s.plan_name));
        v_count := v_count + 1;
      end if;
      -- Venció (bajó a Gratis) en las últimas 24 h.
      if s.current_period_end + public.grace_days() <= now()
         and s.current_period_end + public.grace_days() > now() - interval '1 day' then
        perform public.enqueue_email(s.owner_id, 'expired',
          'expired:' || s.owner_id || ':' || s.current_period_end::date,
          jsonb_build_object('plan', s.plan_name));
        v_count := v_count + 1;
      end if;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Avisos por cambios en los pagos.
create function public.enqueue_payment_emails()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_plan text;
  v_admin record;
begin
  if new.status is not distinct from old.status then return new; end if;
  select name into v_plan from public.plans where code = new.plan_code;

  if new.status = 'approved' then
    perform public.enqueue_email(new.owner_id, 'payment_approved', 'payment_approved:' || new.id,
      jsonb_build_object('plan', v_plan, 'amount', new.expected_amount, 'reference', new.reference,
        'until', (select current_period_end::date from public.subscriptions where owner_id = new.owner_id)));
  elsif new.status = 'rejected' then
    perform public.enqueue_email(new.owner_id, 'payment_rejected', 'payment_rejected:' || new.id,
      jsonb_build_object('plan', v_plan, 'amount', new.expected_amount, 'reference', new.reference,
        'reason', new.rejection_reason));
  elsif new.status = 'in_review' then
    for v_admin in select user_id from public.platform_admins loop
      perform public.enqueue_email(v_admin.user_id, 'admin_new_receipt',
        'admin_new_receipt:' || new.id || ':' || v_admin.user_id,
        jsonb_build_object('plan', v_plan, 'amount', new.expected_amount,
          'declared', new.declared_amount, 'reference', new.reference, 'channel', new.channel));
    end loop;
  end if;
  return new;
end;
$$;

create trigger payments_enqueue_emails
  after update of status on public.payments
  for each row execute function public.enqueue_payment_emails();

revoke execute on function public.enqueue_email(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.enqueue_subscription_reminders() from public, anon, authenticated;
revoke execute on function public.enqueue_payment_emails() from public, anon, authenticated;

-- La Edge Function valida el secreto del cron contra Vault con esta función,
-- que solo puede llamar el rol de servicio.
create function public.check_cron_secret(p_secret text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from vault.decrypted_secrets
                 where name = 'send_emails_cron_secret' and decrypted_secret = p_secret);
$$;
revoke execute on function public.check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.check_cron_secret(text) to service_role;

-- Programación: revisión diaria a las 8:00 a. m. de Bogotá (13:00 UTC) y
-- envío de la cola cada 10 minutos.
select cron.schedule('subscription-reminders', '0 13 * * *',
  $$select public.enqueue_subscription_reminders()$$);

select cron.schedule('send-emails', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://mguwvxwqpqhgspdbjrnw.supabase.co/functions/v1/send-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'send_emails_cron_secret')),
    body := '{}'::jsonb)
  where exists (select 1 from public.email_outbox where status = 'pending')
$$);
