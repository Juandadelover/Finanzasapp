-- Datos de ejemplo de la Fase 1 para "Tienda Demo" (desarrollo/staging).
-- Ejecutar después de dev_users.sql. Idempotente: no hace nada si ya hay contactos.
do $$
declare
  ws uuid; owner uuid; caja uuid; banco uuid; nequi uuid; c1 uuid; c2 uuid; p1 uuid;
  cat_v uuid; cat_c uuid; tx uuid; doc uuid;
begin
  select id, owner_id into ws, owner from public.workspaces where name = 'Tienda Demo';
  if ws is null then raise exception 'Primero ejecuta dev_users.sql'; end if;
  if exists (select 1 from public.contacts where workspace_id = ws) then return; end if;

  update public.accounts set name = 'Caja', opening_balance = 500000 where workspace_id = ws and kind = 'cash' returning id into caja;
  update public.accounts set name = 'Bancolombia', opening_balance = 25000000 where workspace_id = ws and kind = 'bank' returning id into banco;
  insert into public.accounts (workspace_id, name, kind, opening_balance) values (ws, 'Nequi', 'wallet', 200000) returning id into nequi;

  update public.transactions set account_id = case
      when type = 'income' and extract(dow from date) in (1, 3, 5) then nequi
      when type = 'income' then caja
      else banco end
    where workspace_id = ws and status = 'paid';

  insert into public.contacts (workspace_id, kind, name, document, phone, email) values
    (ws, 'client', 'Restaurante El Fogón', '901234567', '3001234567', 'compras@elfogon.test') returning id into c1;
  insert into public.contacts (workspace_id, kind, name, document, phone) values
    (ws, 'client', 'Laura Gómez', '1020304050', '3109876543') returning id into c2;
  insert into public.contacts (workspace_id, kind, name, document, phone) values
    (ws, 'supplier', 'Distribuidora Andina', '900111222', '6015551234') returning id into p1;

  select id into cat_v from public.categories where workspace_id = ws and name = 'Ventas';
  select id into cat_c from public.categories where workspace_id = ws and name = 'Compras e inventario';

  insert into public.transactions (workspace_id, created_by, category_id, contact_id, type, amount, description, date, status, due_date)
  values (ws, owner, cat_v, c1, 'income', 1450000, 'Pedido mensual', current_date - 40, 'pending', current_date - 10) returning id into tx;
  insert into public.transactions (workspace_id, created_by, category_id, contact_id, type, amount, description, date, status, due_date)
  values (ws, owner, cat_v, c2, 'income', 380000, 'Pedido por WhatsApp', current_date - 5, 'pending', current_date + 10);
  insert into public.transactions (workspace_id, created_by, category_id, contact_id, type, amount, description, date, status, due_date)
  values (ws, owner, cat_c, p1, 'expense', 2100000, 'Factura de mercancía', current_date - 7, 'pending', current_date + 8);

  insert into public.collection_documents (workspace_id, kind, number, contact_id, issue_date, due_date, status, total, transaction_id, created_by, notes)
  values (ws, 'collection', 0, c1, current_date - 40, current_date - 10, 'issued', 1450000, tx, owner, 'Pago a Nequi o Bancolombia.') returning id into doc;
  insert into public.collection_document_items (document_id, workspace_id, position, description, quantity, unit_price) values
    (doc, ws, 0, 'Bandejas de postres x 12', 10, 95000),
    (doc, ws, 1, 'Domicilio', 1, 500000);
end $$;
