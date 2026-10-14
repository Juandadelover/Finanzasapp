-- Ola 1 de producción: invitaciones al equipo, movimientos recurrentes,
-- consentimiento legal y solicitud de eliminación de cuenta. No destructiva.

-- ---------------------------------------------------------------------------
-- 1. Perfil: consentimiento y eliminación de cuenta (Ley 1581)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column terms_accepted_at timestamptz,
  add column terms_version text,
  add column deletion_requested_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, terms_accepted_at, terms_version)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url',
          case when new.raw_user_meta_data ? 'terms_version' then now() end,
          new.raw_user_meta_data->>'terms_version');

  if coalesce((new.raw_user_meta_data->>'invited')::boolean, false) then
    return new;
  end if;

  insert into public.workspaces (name, owner_id) values ('Mi negocio', new.id);

  -- RF-SUB-03: 14 días de prueba del plan Emprendedor.
  insert into public.subscriptions (owner_id, plan_code, status, trial_end)
  values (new.id, 'emprendedor', 'trial', now() + interval '14 days');

  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create function public.accept_terms(p_version text)
returns void
language sql
security definer set search_path = ''
as $$
  update public.profiles set terms_accepted_at = now(), terms_version = p_version where id = auth.uid();
$$;

-- RF-DAT-03: el usuario pide eliminar su cuenta; se ejecuta tras 30 días.
create function public.request_account_deletion(p_cancel boolean default false)
returns timestamptz
language plpgsql
security definer set search_path = ''
as $$
declare
  v timestamptz;
begin
  update public.profiles
    set deletion_requested_at = case when p_cancel then null else now() end
    where id = auth.uid()
    returning deletion_requested_at into v;
  return v;
end;
$$;

-- El usuario puede leer su propio perfil (ya existía la política); los
-- miembros de un negocio ven nombre y email de sus compañeros con esta función.
create function public.workspace_members(p_workspace uuid)
returns table (user_id uuid, role public.workspace_role, full_name text, email text, joined_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, m.role, p.full_name, u.email::text, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = p_workspace and public.is_workspace_member(p_workspace)
  order by case m.role when 'owner' then 0 when 'admin' then 1 when 'editor' then 2
                       when 'accountant' then 3 else 4 end, m.created_at;
$$;

-- ---------------------------------------------------------------------------
-- 2. Invitaciones
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.workspace_role not null check (role <> 'owner'),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by uuid default auth.uid() references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index invitations_pending_email_idx on public.invitations(workspace_id, lower(email))
  where status = 'pending';
alter table public.invitations enable row level security;
create policy invitations_select on public.invitations for select
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
create policy invitations_update on public.invitations for update
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

-- Correo a una dirección que quizá aún no tiene cuenta.
create function public.enqueue_email_to(p_email text, p_kind text, p_dedupe_key text, p_payload jsonb)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_email is null or p_email ilike '%.test' then return; end if;
  insert into public.email_outbox (to_email, kind, dedupe_key, payload)
  values (lower(p_email), p_kind, p_dedupe_key, p_payload)
  on conflict (dedupe_key) do nothing;
end;
$$;
revoke execute on function public.enqueue_email_to(text, text, text, jsonb) from public, anon, authenticated;

create function public.invite_member(p_workspace uuid, p_email text, p_role public.workspace_role)
returns public.invitations
language plpgsql
security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_owner uuid;
  v_limit jsonb;
  v_used integer;
  v_ws text;
  v_inviter text;
begin
  if not public.has_workspace_role(p_workspace, array['owner', 'admin']::public.workspace_role[]) then
    raise exception 'Solo el dueño o un admin pueden invitar.';
  end if;
  if p_role = 'owner' then raise exception 'No se puede invitar como dueño.'; end if;
  p_email := lower(trim(p_email));

  if exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id
             where m.workspace_id = p_workspace and lower(u.email) = p_email) then
    raise exception 'Esa persona ya es miembro del negocio.';
  end if;

  select owner_id, name into v_owner, v_ws from public.workspaces where id = p_workspace;
  v_limit := public.plan_limit(v_owner, 'max_members');
  select (select count(*) from public.memberships where workspace_id = p_workspace)
       + (select count(*) from public.invitations where workspace_id = p_workspace and status = 'pending'
          and expires_at > now() and lower(email) <> p_email)
    into v_used;
  if v_limit is not null and v_limit <> 'null'::jsonb and v_used >= (v_limit #>> '{}')::int then
    raise exception 'LIMITE_PLAN:max_members';
  end if;

  -- Reenvío: renueva la invitación pendiente con un token y vencimiento nuevos.
  update public.invitations
    set role = p_role, token = encode(extensions.gen_random_bytes(24), 'hex'),
        expires_at = now() + interval '7 days', invited_by = auth.uid(), created_at = now()
    where workspace_id = p_workspace and lower(email) = p_email and status = 'pending'
    returning * into v_inv;
  if not found then
    insert into public.invitations (workspace_id, email, role)
    values (p_workspace, p_email, p_role)
    returning * into v_inv;
  end if;

  select coalesce(full_name, '') into v_inviter from public.profiles where id = auth.uid();
  perform public.enqueue_email_to(p_email, 'invitation', 'invitation:' || v_inv.id || ':' || v_inv.token,
    jsonb_build_object('workspace', v_ws, 'inviter', v_inviter, 'role', p_role, 'token', v_inv.token));
  return v_inv;
end;
$$;

-- Datos mínimos para la página de la invitación (no expone el negocio a extraños más allá del nombre).
create function public.get_invitation(p_token text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'workspace', w.name, 'role', i.role, 'email', i.email,
    'status', case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end)
  from public.invitations i join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token;
$$;

create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_email text;
begin
  select * into v_inv from public.invitations where token = p_token for update;
  if not found then raise exception 'La invitación no existe.'; end if;
  if v_inv.status <> 'pending' then raise exception 'Esta invitación ya fue usada o cancelada.'; end if;
  if v_inv.expires_at <= now() then raise exception 'La invitación venció. Pide que te la envíen de nuevo.'; end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is distinct from lower(v_inv.email) then
    raise exception 'Esta invitación es para %. Inicia sesión con ese email.', v_inv.email;
  end if;

  insert into public.memberships (workspace_id, user_id, role)
  values (v_inv.workspace_id, auth.uid(), v_inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.invitations set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
    where id = v_inv.id;
  return v_inv.workspace_id;
end;
$$;

revoke execute on function public.invite_member(uuid, text, public.workspace_role) from anon;
revoke execute on function public.accept_invitation(text) from anon;
revoke execute on function public.workspace_members(uuid) from anon;
revoke execute on function public.accept_terms(text) from anon;
revoke execute on function public.request_account_deletion(boolean) from anon;

-- ---------------------------------------------------------------------------
-- 3. Movimientos recurrentes (RF-TX-06)
-- ---------------------------------------------------------------------------
create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(18,2) not null check (amount > 0),
  category_id uuid,
  account_id uuid,
  contact_id uuid,
  description text not null default '',
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  start_date date not null,
  next_date date not null,
  occurrences integer not null default 0,
  end_date date,
  generated_status text not null default 'pending' check (generated_status in ('pending', 'paid')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint recurrences_id_workspace_key unique (id, workspace_id),
  constraint recurrences_category_fkey foreign key (category_id, workspace_id)
    references public.categories(id, workspace_id) on delete set null (category_id),
  constraint recurrences_account_fkey foreign key (account_id, workspace_id)
    references public.accounts(id, workspace_id) on delete set null (account_id),
  constraint recurrences_contact_fkey foreign key (contact_id, workspace_id)
    references public.contacts(id, workspace_id) on delete set null (contact_id)
);
create index recurrences_due_idx on public.recurrences(next_date) where active;

alter table public.transactions
  add column recurrence_id uuid,
  add constraint transactions_recurrence_fkey foreign key (recurrence_id, workspace_id)
    references public.recurrences(id, workspace_id) on delete set null (recurrence_id);

alter table public.recurrences enable row level security;
create policy recurrences_select on public.recurrences for select
  using (public.has_workspace_role(workspace_id, array['accountant']::public.workspace_role[]));
create policy recurrences_manage on public.recurrences for all
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]));

-- Genera los movimientos vencidos (hasta p_until) y avanza next_date.
-- p_workspace null = todos los negocios (job diario).
create function public.generate_recurring_transactions(p_workspace uuid default null, p_until date default current_date)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.recurrences;
  v_count integer := 0;
  v_step interval;
begin
  for r in
    select * from public.recurrences
    where active and next_date <= p_until and (p_workspace is null or workspace_id = p_workspace)
    for update skip locked
  loop
    v_step := case r.frequency when 'weekly' then interval '7 days'
                               when 'monthly' then interval '1 month' else interval '1 year' end;
    while r.next_date <= p_until and (r.end_date is null or r.next_date <= r.end_date) loop
      begin
        insert into public.transactions
          (workspace_id, created_by, category_id, account_id, contact_id, type, amount, description,
           date, status, due_date, recurrence_id)
        values
          (r.workspace_id, r.created_by, r.category_id,
           case when r.generated_status = 'paid' then r.account_id end,
           r.contact_id, r.type, r.amount, r.description, r.next_date, r.generated_status,
           case when r.generated_status = 'pending' then r.next_date end, r.id);
        v_count := v_count + 1;
      exception when others then
        -- p. ej. límite del plan Gratis: se reintenta en la próxima corrida.
        exit;
      end;
      -- Fecha inicial + n pasos: así "31 de enero + 1 mes" no se queda en 28 para siempre.
      r.occurrences := r.occurrences + 1;
      r.next_date := (r.start_date + v_step * r.occurrences)::date;
    end loop;
    update public.recurrences
      set next_date = r.next_date,
          occurrences = r.occurrences,
          active = (r.end_date is null or r.next_date <= r.end_date)
      where id = r.id;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.generate_recurring_transactions(uuid, date) from public, anon, authenticated;

-- El cliente la llama al crear una recurrencia para ver de inmediato lo que ya venció.
create function public.run_recurrences(p_workspace uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.has_workspace_role(p_workspace, array['owner', 'admin', 'editor']::public.workspace_role[]) then
    raise exception 'Sin permiso.';
  end if;
  return public.generate_recurring_transactions(p_workspace, current_date);
end;
$$;
revoke execute on function public.run_recurrences(uuid) from anon;

-- 5:00 a. m. de Bogotá.
select cron.schedule('recurring-transactions', '0 10 * * *',
  $$select public.generate_recurring_transactions()$$);
