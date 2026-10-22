# Módulo de inventario — diseño

Fecha: 2026-10-22 · Estado: aprobado en conversación · Fuente: requerimientos POS/Inventario (RF-01 a RF-07, RN-01 a RN-07, RNF-01 a RNF-06), adaptados a Finanzas como módulo para todos los negocios.

## Alcance

Bloque 1 de 3. Incluye: productos, categorías de producto, importación de catálogo (CSV/Excel), entradas de mercancía, ajustes, kardex, alertas de stock bajo, códigos internos y etiquetas, lector de código de barras.

Fuera de este bloque: pantalla de venta (POS), comprobante JPG, clientes/deudores/reportes de venta (bloques 2 y 3); variantes, varias bodegas, conversión de unidades, lotes y vencimientos.

## Decisiones

| # | Decisión |
|---|---|
| D1 | Módulo de Finanzas para todos los negocios (multi-negocio, RLS por `workspace_id`). |
| D2 | Una entrada de mercancía puede crear el gasto en "Compras e inventario" (opcional, activado por defecto): pagado desde una cuenta o pendiente ("Debo") al proveedor. |
| D3 | Permisos por rol (tabla abajo). "Solo registro" registra entradas sin costo; el costo lo completa después alguien con permiso. |
| D4 | Plan Gratis: máximo 30 productos activos. Planes pagos: sin límite. Lo aplica la base de datos. |
| D5 | Unidad de medida por producto: `unidad`, `caja` (cantidades enteras), `kg`, `g`, `litro`, `ml`, `metro` (decimales, hasta 3). |
| D6 | Costo promedio ponderado. |
| D7 | El stock nunca queda negativo en este bloque. |
| D8 | Dinero en `numeric(18,2)` como el resto de la app; la UI usa pesos enteros. |
| D9 | Códigos internos EAN-13 con prefijo GS1 `20` (uso interno de tienda), consecutivo por negocio. |
| D10 | El kardex (`stock_movements`) es la fuente de verdad; `products.stock` es un valor cacheado que solo actualizan funciones de la base de datos con bloqueo de fila. |

## Permisos

| Acción | owner | admin | editor | accountant | recorder |
|---|:-:|:-:|:-:|:-:|:-:|
| Ver productos y stock | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver costos, margen y valor del inventario | ✅ | ✅ | ✅ | ✅ | ❌ |
| Crear/editar productos, precios, categorías | ✅ | ✅ | ✅ | ❌ | ❌ |
| Registrar entradas | ✅ (con costo) | ✅ (con costo) | ✅ (con costo) | ❌ | ✅ (sin costo) |
| Completar costo de una entrada | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ajustes (daño, pérdida, conteo) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Stock inicial (producto sin movimientos) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Importar catálogo | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver kardex y entradas | ✅ | ✅ | ✅ | ✅ | ❌ |
| Desactivar/reactivar productos | ✅ | ✅ | ✅ | ❌ | ❌ |

Los productos nunca se borran si tienen movimientos (RF-01): se desactivan.

## Modelo de datos

Una migración nueva `supabase/migrations/<timestamp>_inventory.sql`, no destructiva, siguiendo el estilo de las existentes (FK compuestas `(id, workspace_id)`, `security definer set search_path = ''`, errores en español).

- `product_categories(id, workspace_id, name, created_at)`; único `(workspace_id, lower(name))`.
- `products(id, workspace_id, barcode, name, category_id, unit, price_cash, price_credit, stock, min_stock, active, created_by, created_at, updated_at)`
  - `barcode` opcional, único por negocio cuando no es nulo.
  - `unit` con `check` en la lista de D5. `stock` y `min_stock` `numeric(14,3)`; para `unidad`/`caja` deben ser enteros.
  - `price_cash`, `price_credit` `>= 0`. `price_credit` por defecto igual a `price_cash` (lo llena la app).
  - Trigger: `stock` no puede cambiar salvo dentro de las funciones de inventario (bandera de transacción `app.inventory_write`). Inserción siempre con `stock = 0`.
- `product_costs(product_id, workspace_id, avg_cost numeric(18,2), updated_at)`: separado para ocultarlo a `recorder` con RLS.
- `stock_receipts(id, workspace_id, number, supplier_id, date, status ('complete','pending_cost'), total_cost, transaction_id, notes, created_by, created_at)`; `number` por `workspace_counters` (kind `stock_receipt`).
- `stock_movements(id bigint identity, workspace_id, product_id, kind ('opening','receipt','adjustment'; 'sale','sale_void' reservados para el POS), quantity (con signo), stock_after, unit_cost, avg_cost_after, reason ('damage','loss','count','other', nulo si no es ajuste), note, receipt_id, created_by, created_at)`. Sin políticas de update/delete.
- `product_price_changes(id, workspace_id, product_id, old_cash, new_cash, old_credit, new_credit, changed_by, changed_at)` llenada por trigger.
- `plan_limits`: clave `max_active_products` (`gratis` = 30, otros `null`), aplicada en insert y en reactivación.
- Contador `internal_barcode` en `workspace_counters` para D9.

## Funciones (RPC)

Todas: verifican rol con `has_workspace_role`, bloquean productos `for update` en orden de `id`, todo o nada.

- `inventory_receive(p_workspace, p_supplier, p_date, p_lines jsonb, p_expense jsonb) → uuid` — líneas `{product_id, quantity, unit_cost?}`. Si el rol es `recorder` o falta algún costo, la entrada queda `pending_cost` y no crea gasto. Si todo tiene costo y `p_expense.create`, crea un `transactions` tipo gasto en la categoría "Compras e inventario" con `account_id`, `contact_id = supplier`, `status` `paid` o `pending` (+ `due_date`).
- `inventory_complete_receipt(p_receipt, p_costs jsonb, p_expense jsonb)` — llena costos y ajusta el promedio: `avg' = avg + q·(c − avg)/stock_actual` (si `stock_actual > 0`); crea el gasto si se pide; pasa a `complete`.
- `inventory_adjust(p_product, p_mode ('count','out'), p_quantity, p_reason, p_note)` — `count`: delta = contado − stock. `out`: delta = −cantidad. Motivo obligatorio. Solo owner/admin.
- `inventory_set_opening(p_product, p_quantity, p_unit_cost)` — solo si el producto no tiene movimientos.
- `inventory_import(p_workspace, p_rows jsonb) → jsonb` — vuelve a validar (código duplicado en archivo o en base, nombre vacío, unidad inválida, números negativos), crea categorías faltantes, productos, costos y stock inicial. Si hay errores devuelve la lista y no guarda nada.
- `inventory_next_internal_barcode(p_workspace) → text` — EAN-13 `20` + consecutivo de 10 dígitos + dígito de control.

Costo promedio en una entrada: `avg' = (stock·avg + q·c) / (stock + q)`.

## Pantallas (App Router, componentes cliente como el resto)

- `/inventario` — lista con búsqueda, campo de escaneo, filtros (categoría, stock bajo, agotado, inactivos); resumen arriba (valor del inventario solo si ve costos; conteo de stock bajo y agotados). Crear/editar producto en hoja (`ProductSheet`).
- `/inventario/[id]` — ficha y kardex (tabla de movimientos con stock después de cada uno); acciones: entrada, ajuste, etiqueta, desactivar.
- `/inventario/entradas` y `/inventario/entradas/nueva` — entrada guiada por escaneo; escanear el mismo producto suma cantidad; proveedor; costos; interruptor "Registrar el gasto" con cuenta y pagado/pendiente.
- `/inventario/importar` — CSV o Excel; vista previa, filas con error, confirmar.
- `/inventario/etiquetas` — etiquetas imprimibles (CSS de impresión) con código de barras.
- Navegación: "Inventario" en `SECONDARY_NAV`; tarjeta de stock bajo en Inicio cuando haya.

## Lector de códigos de barras

- Hook `useBarcodeScanner`: listener global; considera escaneo una ráfaga de ≥ 6 caracteres con < 50 ms entre teclas terminada en Enter; no interfiere con tecleo normal.
- `isValidGtin()` valida EAN-13, EAN-8, UPC-A (GS1 módulo 10); otros formatos pasan sin validar.
- Cámara en celular con `BarcodeDetector` si existe; si no, se oculta el botón.
- Código no encontrado: sonido corto (Web Audio) y opción de crear el producto con el código lleno.

## Errores

Las funciones lanzan mensajes en español (`'STOCK_NEGATIVO'`, `'LIMITE_PLAN:max_active_products'`, `'SIN_PERMISO'`, etc.); la UI los traduce con toasts como el resto de la app.

## Pruebas

- pgTAP `supabase/tests/06_inventory.test.sql`: RLS por rol; `recorder` no lee `product_costs` ni `stock_movements`; `stock` no se edita directo; entrada + gasto atómicos; stock negativo rechazado; costo promedio; límite de 30 productos en Gratis.
- Vitest: `isValidGtin`, generador EAN-13 interno, detector de ráfagas, validación de importación, costo promedio.
- Playwright (smoke): crear producto, registrar entrada, ver kardex.
