-- Usuarios de prueba por rol (D7) — SOLO desarrollo/staging.
--
-- Uso (psql o el editor SQL de Supabase), en la MISMA sesión:
--   select set_config('app.dev_seed_password', '<contraseña>', false);
--   \i supabase/seed/dev_users.sql
--
-- No borra nada: si los usuarios de prueba ya existen, no hace cambios.
-- Se niega a correr si hay usuarios reales (no anónimos y fuera de
-- @finanzasapp.test), para no ejecutarse por error en producción.

do $$
declare
  pwd text := current_setting('app.dev_seed_password', true);
  v_admin uuid;
  v_owner uuid;
  v_admin_ws uuid;
  v_editor uuid;
  v_accountant uuid;
  v_recorder uuid;
  v_free uuid;
  v_ws uuid;
  u record;
  d date;
  cat record;
begin
  if pwd is null or length(pwd) < 12 then
    raise exception 'Define app.dev_seed_password (mínimo 12 caracteres) antes de correr el seed.';
  end if;

  if exists (
    select 1 from auth.users
    where not is_anonymous and coalesce(email, '') not like '%@finanzasapp.test'
  ) then
    raise exception 'Hay usuarios reales en este proyecto: el seed de desarrollo no se ejecuta aquí.';
  end if;

  if exists (select 1 from auth.users where email like '%@finanzasapp.test') then
    raise notice 'Los usuarios de prueba ya existen; no se hace nada.';
    return;
  end if;

  -- Crea cada usuario con email confirmado e identidad "email".
  -- El trigger on_auth_user_created le crea perfil, negocio "Mi negocio" y prueba
  -- de 14 días, salvo a los marcados como invitados (solo serán miembros).
  for u in
    select * from (values
      ('admin@finanzasapp.test',        'Admin Plataforma', false),
      ('dueno@finanzasapp.test',        'Daniela Dueña',    false),
      ('adminnegocio@finanzasapp.test', 'Andrés Admin',     true),
      ('editor@finanzasapp.test',       'Elena Editora',    true),
      ('contador@finanzasapp.test',     'Carlos Contador',  true),
      ('registro@finanzasapp.test',     'Rosa Registro',    true),
      ('gratis@finanzasapp.test',       'Gabriel Gratis',   false)
    ) as t(email, full_name, invited)
  loop
    declare
      uid uuid := gen_random_uuid();
    begin
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token,
        is_sso_user, is_anonymous
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', u.email,
        extensions.crypt(pwd, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', u.full_name, 'invited', u.invited), now(), now(),
        '', '', '', '', '', '', '', '', false, false
      );
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (uid::text, uid,
        jsonb_build_object('sub', uid::text, 'email', u.email, 'email_verified', true),
        'email', now(), now(), now());
    end;
  end loop;

  select id into v_admin      from auth.users where email = 'admin@finanzasapp.test';
  select id into v_owner      from auth.users where email = 'dueno@finanzasapp.test';
  select id into v_admin_ws   from auth.users where email = 'adminnegocio@finanzasapp.test';
  select id into v_editor     from auth.users where email = 'editor@finanzasapp.test';
  select id into v_accountant from auth.users where email = 'contador@finanzasapp.test';
  select id into v_recorder   from auth.users where email = 'registro@finanzasapp.test';
  select id into v_free       from auth.users where email = 'gratis@finanzasapp.test';

  -- Administrador de la plataforma (panel /admin).
  insert into public.platform_admins (user_id) values (v_admin);

  -- Dueño: su negocio se llama "Tienda Demo" y tiene plan Negocio activo.
  update public.workspaces set name = 'Tienda Demo', tax_regime = 'no_responsable_iva'
    where owner_id = v_owner returning id into v_ws;
  update public.subscriptions
    set plan_code = 'negocio', status = 'active', trial_end = null,
        current_period_end = now() + interval '1 month', updated_at = now()
    where owner_id = v_owner;

  -- Miembros invitados: no tienen negocio propio ni suscripción, solo su rol en "Tienda Demo".
  insert into public.memberships (workspace_id, user_id, role) values
    (v_ws, v_admin_ws,   'admin'),
    (v_ws, v_editor,     'editor'),
    (v_ws, v_accountant, 'accountant'),
    (v_ws, v_recorder,   'recorder');

  -- Dueño en plan Gratis con un pago manual en revisión.
  update public.subscriptions
    set plan_code = 'gratis', status = 'active', trial_end = null, updated_at = now()
    where owner_id = v_free;
  insert into public.payments (owner_id, plan_code, billing_cycle, expected_amount, declared_amount, reference, channel, status)
  values (v_free, 'emprendedor', 'monthly', 24900, 24900, 'FZ-DEMO1', 'nequi', 'in_review');

  -- Movimientos de ejemplo en "Tienda Demo" para los últimos ~3 meses.
  for d in select generate_series(current_date - 89, current_date, interval '1 day')::date loop
    -- Ventas casi todos los días.
    if extract(dow from d) <> 0 then
      select id into cat from public.categories where workspace_id = v_ws and name = 'Ventas';
      insert into public.transactions (workspace_id, created_by, category_id, type, amount, description, date)
      values (v_ws, v_owner, cat.id, 'income', (80 + (extract(doy from d)::int * 37) % 320) * 1000, 'Ventas del día', d);
    end if;
    -- Compras de inventario dos veces por semana.
    if extract(dow from d) in (1, 4) then
      select id into cat from public.categories where workspace_id = v_ws and name = 'Compras e inventario';
      insert into public.transactions (workspace_id, created_by, category_id, type, amount, description, date)
      values (v_ws, v_editor, cat.id, 'expense', (150 + (extract(doy from d)::int * 53) % 400) * 1000, 'Compra a proveedor', d);
    end if;
    -- Gastos fijos el día 1 y 5 de cada mes.
    if extract(day from d) = 1 then
      select id into cat from public.categories where workspace_id = v_ws and name = 'Arriendo';
      insert into public.transactions (workspace_id, created_by, category_id, type, amount, description, date)
      values (v_ws, v_owner, cat.id, 'expense', 1800000, 'Arriendo del local', d);
      select id into cat from public.categories where workspace_id = v_ws and name = 'Software y suscripciones';
      insert into public.transactions (workspace_id, created_by, category_id, type, amount, description, date)
      values (v_ws, v_owner, cat.id, 'expense', 59900, 'Plan Finanzas', d);
    end if;
    if extract(day from d) = 5 then
      select id into cat from public.categories where workspace_id = v_ws and name = 'Nómina y honorarios';
      insert into public.transactions (workspace_id, created_by, category_id, type, amount, description, date)
      values (v_ws, v_owner, cat.id, 'expense', 2600000, 'Pago auxiliar de ventas', d);
      select id into cat from public.categories where workspace_id = v_ws and name = 'Servicios públicos';
      insert into public.transactions (workspace_id, created_by, category_id, type, amount, description, date)
      values (v_ws, v_owner, cat.id, 'expense', 320000, 'Energía y agua', d);
    end if;
  end loop;

  -- Algunos gastos registrados por el usuario "solo registro".
  select id into cat from public.categories where workspace_id = v_ws and name = 'Transporte y envíos';
  insert into public.transactions (workspace_id, created_by, category_id, type, amount, description, date) values
    (v_ws, v_recorder, cat.id, 'expense', 18000, 'Domicilio a cliente', current_date - 2),
    (v_ws, v_recorder, cat.id, 'expense', 25000, 'Envío Servientrega', current_date - 1);

  -- Presupuestos de ejemplo.
  update public.categories set monthly_budget = 2500000 where workspace_id = v_ws and name = 'Compras e inventario';
  update public.categories set monthly_budget = 400000 where workspace_id = v_ws and name = 'Publicidad';
end $$;
