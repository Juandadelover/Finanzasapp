# Venta (POS) — diseño

Fecha: 2026-10-22 · Bloque 2 de 3 · Depende de: inventario (`2026-10-22-inventario-design.md`) · Fuente: requerimientos POS/Inventario RF-08 a RF-18, RN-01 a RN-07, RNF-01, RNF-02, RNF-04, RNF-06.

## Alcance

Pantalla de venta con lector, contado/crédito, descuentos, medios de pago, confirmación y anulación atómicas, comprobante JPG para compartir. Fuera de este bloque: cierre de caja, reportes de venta, abonos posteriores (bloque 3 / fase de cartera); ventas en espera (RF-15), impresión térmica (RF-19), modo sin conexión.

## Decisiones

| # | Decisión |
|---|---|
| P1 | Cada venta crea sus movimientos en finanzas (opción A). Contado: un ingreso `paid` por medio de pago en su cuenta. Crédito: el abono inicial (si hay) es un ingreso `paid`; el saldo es un ingreso `pending` con el cliente (aparece en "Me deben"). Categoría de ingreso `Ventas` (se crea si el negocio no la tiene). |
| P2 | Anular (solo owner/admin, motivo obligatorio): devuelve stock (movimientos `sale_void`), borra los movimientos de finanzas de la venta y la marca `void`. Nunca se borra la venta. El consecutivo no se reutiliza. |
| P3 | Precio crédito: valor fijo por producto (`products.price_credit`, ya existe). El tipo de venta define la lista de precios de todas las líneas; cambiarlo recalcula. |
| P4 | Descuentos por línea y sobre el total, en % o valor. Tope `workspaces.pos_max_discount_pct` (por defecto 10) para `editor` y `recorder`; owner/admin sin tope. Superar el tope se rechaza con `DESCUENTO_SOBRE_TOPE` ("pídele a un administrador que haga la venta"). Una línea nunca queda por debajo de 0; aviso si queda por debajo del costo (solo para quien ve costos). |
| P5 | Venden: owner, admin, editor, recorder ("vendedor": no ve costos ni utilidades). Contador no vende. Anular: owner/admin. |
| P6 | Stock negativo: configurable por negocio, `workspaces.pos_allow_negative_stock` (por defecto `false`). Con `false` la venta falla con `STOCK_INSUFICIENTE` indicando el producto. |
| P7 | Medios de pago: `cash` (con vueltas), `transfer`, `nequi`, `daviplata`, `card`; cada uno se asocia a una cuenta del negocio; pago mixto permitido. La suma de pagos de contado debe ser igual al total (efectivo puede exceder: la diferencia son las vueltas, que no se registran como ingreso). |
| P8 | Clientes = `contacts` (agregar columna `address`). Crédito exige cliente; se busca por documento o nombre, o se crea en el momento. |
| P9 | Comprobante como imagen JPG generada en el navegador (`html-to-image`), compartida con Web Share API o descargada; nunca se guarda en el servidor; se regenera desde los datos. Leyenda fija: "Comprobante de venta - No es factura electrónica". |
| P10 | Dinero en `numeric(18,2)` con pesos enteros en UI (como inventario). Fechas en America/Bogota. |

## Modelo de datos (migración nueva, no destructiva)

- `workspaces`: `pos_max_discount_pct numeric(5,2) not null default 10`, `pos_allow_negative_stock boolean not null default false`.
- `contacts`: `address text`.
- `sales(id, workspace_id, number, kind ('cash','credit'), contact_id, subtotal, line_discount_total, total_discount, total, paid_now, balance, status ('active','void'), void_reason, voided_by, voided_at, notes, created_by, created_at)`; `number` por `workspace_counters` (kind `sale`).
- `sale_items(id, sale_id, workspace_id, position, product_id, name, unit, quantity, unit_price, unit_cost, discount, line_total)` — copia precio, costo y descuento (RN-01).
- `sale_payments(id, sale_id, workspace_id, method, account_id, amount, received, change)`.
- `transactions.sale_id uuid` (FK compuesta a `sales`) para ubicar y revertir los movimientos de una venta.
- RLS: miembros leen ventas; `unit_cost` de `sale_items` oculto para `recorder` (vista `sale_items_public` sin costo, o columna en tabla aparte — misma técnica que `product_costs`). Escritura solo por funciones.

## Funciones

- `pos_confirm_sale(p_workspace, p_kind, p_contact, p_lines jsonb, p_total_discount jsonb, p_payments jsonb, p_initial_payment jsonb, p_notes) returns jsonb` → `{sale_id, number}`. En una transacción: valida rol y tope de descuento, bloquea productos `for update` en orden, recalcula precios desde `products` según `p_kind` (no confía en el cliente), valida stock (P6), asigna consecutivo, inserta venta/líneas/pagos, movimientos `sale` en el kardex, y los `transactions` de P1.
- `pos_void_sale(p_sale, p_reason)` — P2, en una transacción.

## Pantallas

- `/vender` — pantalla de venta: lector siempre activo (escanear suma cantidad), búsqueda por nombre, selector Contado/Crédito, líneas con cantidad y descuento, descuento total, cliente (obligatorio en crédito), cobro (F2) con medios de pago y vueltas, confirmación. Código no encontrado: sonido y opción de crear producto (si tiene permiso).
- `/ventas` — historial con filtros (fecha, tipo, estado); `/ventas/[id]` — detalle, regenerar comprobante, anular (owner/admin).
- `ReceiptImage` — componente del tiquete + generación JPG + compartir/descargar/WhatsApp (`wa.me` con el teléfono del cliente).
- Ajustes del negocio: tope de descuento y permitir stock negativo (owner/admin).
- Navegación: "Vender" visible y prominente (botón principal en celular y menú).

## Errores

`STOCK_INSUFICIENTE:<nombre>`, `DESCUENTO_SOBRE_TOPE`, `CLIENTE_REQUERIDO`, `PAGO_NO_CUADRA`, `VENTA_ANULADA`, `SIN_PERMISO`, `PRECIO_NEGATIVO`; traducidos en `src/lib/inventory/errors.ts` (o equivalente de POS).

## Pruebas

- pgTAP `07_pos.test.sql`: contado mixto crea un ingreso por cuenta y descuenta stock; crédito con abono crea `paid` + `pending` con cliente; crédito sin cliente falla; stock insuficiente falla sin efectos; precio enviado por el cliente se ignora; tope de descuento por rol; anulación devuelve stock, borra transacciones y conserva el consecutivo; contador no vende; recorder no lee costos de líneas; dos ventas concurrentes no dejan stock negativo.
- Vitest: cálculo de totales/descuentos/vueltas, recálculo al cambiar de tipo.
- Playwright: venta de contado con escaneo y venta a crédito que aparece en "Me deben".
