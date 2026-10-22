# Módulo de inventario — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Productos, entradas, ajustes, kardex, alertas, importación y etiquetas dentro de Finanzas, para todos los negocios.

**Architecture:** El kardex (`stock_movements`) es la fuente de verdad; `products.stock` solo lo cambian funciones `security definer` de Postgres con bloqueo de fila. La UI son páginas cliente bajo `src/app/(app)/inventario` que llaman a esas funciones vía `src/lib/inventory/api.ts`. Lógica pura (GTIN, costo promedio, importación, lector) en `src/lib/inventory/*` con pruebas Vitest.

**Tech Stack:** Next.js 16 (leer `node_modules/next/dist/docs/` antes de escribir rutas), React 19, Tailwind v4, Supabase (Postgres + RLS + pgTAP), Vitest, Playwright, lucide-react, sonner. Dependencias nuevas permitidas: `papaparse` (+ `@types/papaparse`), `read-excel-file`, `jsbarcode`.

**Spec:** `docs/superpowers/specs/2026-10-22-inventario-design.md` (leerlo completo antes de cualquier tarea).

## Global Constraints

- Textos de UI y errores en español de Colombia, tuteo, frases cortas (ver `PRODUCT.md`).
- Seguir patrones existentes: migraciones como `supabase/migrations/20261014194921_accounts_contacts_documents.sql` (FK compuestas `(id, workspace_id)`, `security definer set search_path = ''`, `revoke execute ... from public, anon` en helpers internos); páginas como `src/app/(app)/recurrentes/page.tsx`; permisos en `src/lib/permissions.ts` (la base de datos es la fuente de verdad).
- Roles: `owner`, `admin`, `editor`, `accountant`, `recorder` — tabla de permisos del spec.
- Unidades: `unidad`, `caja` enteras; `kg`, `g`, `litro`, `ml`, `metro` hasta 3 decimales.
- Límite plan: clave `max_active_products`; `gratis` = `30`; `emprendedor`, `negocio`, `pro` = `null`. Error `LIMITE_PLAN:max_active_products`.
- Costo promedio en entrada: `(stock·avg + q·c)/(stock + q)`. Costo tardío: `avg + q·(c − avg)/stock_actual` si `stock_actual > 0`, si no `c`.
- Código interno: `'20'` + secuencia de 10 dígitos con ceros + dígito de control GS1.
- Gasto de entrada: categoría del negocio llamada `'Compras e inventario'` (tipo `expense`), `contact_id` = proveedor.
- Mensajes de error de funciones: `SIN_PERMISO`, `STOCK_NEGATIVO`, `CANTIDAD_INVALIDA`, `MOTIVO_REQUERIDO`, `PRODUCTO_CON_MOVIMIENTOS`, `CODIGO_DUPLICADO`.
- No tocar `AGENTS.md`. Commits terminan con las líneas de atribución que indique quien coordina.

## Review Focus

- Dos entradas simultáneas del mismo producto: el stock final debe ser la suma de ambas (bloqueo `for update`). Prueba: test pgTAP que ejecuta dos `inventory_receive` seguidos y verifica `stock` y `stock_after` encadenados.
- Cantidad decimal en un producto `unidad` (p. ej. 1,5): rechazada con `CANTIDAD_INVALIDA` en base de datos y en la importación. Pruebas en Task 1 y Task 2.
- Conteo físico igual al stock actual (delta 0): no crea movimiento y no falla. Prueba en Task 1.
- Importación con el mismo código dos veces en el archivo o ya existente en el negocio: se reporta la fila, no se guarda nada. Pruebas en Task 1 (SQL) y Task 2 (parser).
- Lector que termina con Tab o sin Enter / tecleo humano rápido de 5 teclas: no se interpreta como escaneo. Prueba en Task 2.

---

### Task 1: Base de datos de inventario

**Files:**
- Create: `supabase/migrations/20261022120000_inventory.sql`
- Create: `supabase/tests/06_inventory.test.sql` (copiar helpers `pg_temp.*` de `02_plan_limits.test.sql`)
- Modify: `src/types/finance.ts` (agregar tipos de abajo) — o crear `src/types/inventory.ts` y reexportar.

**Interfaces (Produces):**
- Tablas y columnas exactas del spec, sección "Modelo de datos".
- `inventory_receive(p_workspace uuid, p_supplier uuid, p_date date, p_lines jsonb, p_expense jsonb) returns uuid` — `p_lines`: `[{product_id, quantity, unit_cost|null}]`; `p_expense`: `{create: boolean, account_id: uuid|null, status: 'paid'|'pending', due_date: date|null}`.
- `inventory_complete_receipt(p_receipt uuid, p_costs jsonb, p_expense jsonb) returns void` — `p_costs`: `[{product_id, unit_cost}]`.
- `inventory_adjust(p_product uuid, p_mode text, p_quantity numeric, p_reason text, p_note text) returns void` — `p_mode` ∈ `count|out`.
- `inventory_set_opening(p_product uuid, p_quantity numeric, p_unit_cost numeric) returns void`.
- `inventory_import(p_workspace uuid, p_rows jsonb) returns jsonb` — filas `{barcode, name, category, unit, price_cash, price_credit, cost, stock, min_stock}`; devuelve `{ok: true, created: n}` o `{ok: false, errors: [{row, message}]}` sin guardar.
- `inventory_next_internal_barcode(p_workspace uuid) returns text`.
- TS: `ProductUnit`, `Product`, `ProductCategory`, `ProductCost`, `StockReceipt`, `StockMovement` (campos = columnas).

- [ ] **Step 1:** Escribir `06_inventory.test.sql` con `plan(n)` cubriendo: RLS por rol según la tabla del spec (incluye `recorder` sin acceso a `product_costs`, `stock_movements`, `stock_receipts` de otros); `update products set stock` directo falla; insert con `stock <> 0` falla; recibir 10 a costo 1000 y luego 10 a 2000 → `stock = 20`, `avg_cost = 1500`, `stock_after` 10 y 20; entrada con `p_expense.create` crea un `transactions` gasto con `status` pedido y en la categoría `Compras e inventario`; `recorder` recibe sin costo → `pending_cost` y sin gasto; `inventory_complete_receipt` llena costo y aplica fórmula de costo tardío; ajuste `out` mayor al stock → `STOCK_NEGATIVO` y nada cambia; `count` igual al stock → 0 movimientos nuevos; `editor` no puede ajustar; 1,5 en producto `unidad` → `CANTIDAD_INVALIDA`; `inventory_set_opening` con movimientos → `PRODUCTO_CON_MOVIMIENTOS`; 31.º producto activo en plan `gratis` → `LIMITE_PLAN:max_active_products` (también al reactivar); plan `pro` sin límite; importación con código repetido → `ok=false` y 0 productos creados; `inventory_next_internal_barcode` devuelve 13 dígitos que empiezan por `20` y consecutivos.
- [ ] **Step 2:** Levantar Supabase local e intentar correr las pruebas: `npx supabase@latest start -x studio,imgproxy,vector,logflare,edge-runtime,mailpit,postgres-meta,supavisor,realtime` y `npx supabase@latest test db`. Esperado: fallan porque las tablas no existen. Si Docker no permite levantarlo, decirlo en el reporte y validar la migración al menos con `psql` contra un Postgres local si existe; no inventar resultados.
- [ ] **Step 3:** Escribir la migración: tablas, índices, RLS, trigger de protección de `stock` (bandera `set_config('app.inventory_write','on', true)` dentro de las funciones), trigger de `product_price_changes`, `updated_at`, extensión de `enforce_plan_limits` (o trigger propio) para `products`, filas de `plan_limits`, las 6 funciones con `has_workspace_role` y `for update` ordenado por `id`. `grant execute` a `authenticated` solo en las 6 RPC.
- [ ] **Step 4:** Correr `npx supabase@latest db reset` y `npx supabase@latest test db`. Esperado: todas las pruebas pasan, incluidas las 01–05 existentes.
- [ ] **Step 5:** Agregar los tipos TS. `npx tsc --noEmit` pasa.
- [ ] **Step 6:** Commit `Inventario: esquema, funciones y pruebas de base de datos`.

### Task 2: Lógica pura y acceso a datos

**Files:**
- Create: `src/lib/inventory/gtin.ts`, `cost.ts`, `units.ts`, `importRows.ts`, `scanner.ts`, `useBarcodeScanner.ts`, `api.ts`
- Modify: `src/lib/permissions.ts`, `tests/permissions.test.ts`, `package.json` (deps)
- Test: `tests/inventory.test.ts`

**Interfaces:**
- Consumes: RPC y tipos de Task 1.
- Produces:
  - `isValidGtin(code: string): boolean` — `true` para cadenas que no son 8/12/13 dígitos (no se validan); para 8/12/13 dígitos verifica GS1 módulo 10.
  - `gtinCheckDigit(body: string): number`; `internalEan13(seq: number): string`.
  - `weightedAverageCost(stock: number, avg: number, qty: number, unitCost: number): number`; `lateCostAverage(stockNow: number, avg: number, qty: number, unitCost: number): number`.
  - `UNITS: { value: ProductUnit; label: string; integer: boolean }[]`; `isValidQuantity(unit: ProductUnit, q: number): boolean`.
  - `parseImportRows(rows: Record<string, string>[]): { valid: ImportRow[]; errors: { row: number; message: string }[] }` — encabezados aceptados sin tildes ni mayúsculas: `codigo|codigo_barras`, `nombre`, `categoria`, `unidad` (vacío = `unidad`), `precio_contado|precio`, `precio_credito` (vacío = precio contado), `costo`, `stock|cantidad`, `stock_minimo|minimo`. Números en formato colombiano (`1.250.000`, `2,5`).
  - `readImportFile(file: File): Promise<Record<string, string>[]>` (CSV con papaparse, `.xlsx` con read-excel-file) en `importRows.ts`.
  - `createBurstDetector(opts?: { minLength?: number; maxGapMs?: number }): { push(key: string, t: number): string | null; reset(): void }` — defaults `6`, `50`; devuelve el código solo al recibir `Enter` tras una ráfaga.
  - `useBarcodeScanner(onScan: (code: string) => void, enabled?: boolean): void` — listener `keydown` global; si el foco está en un input y fue ráfaga, limpia lo tecleado en ese input.
  - `api.ts`: `listProducts(ws)`, `getProduct(id)`, `listCategories(ws)`, `createCategory(ws, name)`, `saveProduct(input)`, `setProductActive(id, active)`, `listProductCosts(ws)`, `listMovements(productId)`, `listReceipts(ws)`, `getReceipt(id)`, `receiveStock(input)`, `completeReceipt(input)`, `adjustStock(input)`, `setOpeningStock(input)`, `importProducts(ws, rows)`, `nextInternalBarcode(ws)`, `inventoryErrorMessage(err): string` (traduce los códigos de Global Constraints a frases).
  - `Permissions` agrega: `canViewCosts`, `canManageProducts`, `canReceiveStock`, `canReceiveWithCost`, `canAdjustStock`, `canImportProducts` según la tabla del spec.

- [ ] **Step 1:** Escribir `tests/inventory.test.ts`: `isValidGtin('7702004003508') === true`, `isValidGtin('7702004003509') === false`, `isValidGtin('ABC-123') === true`; `internalEan13(1) === '2000000000015'` (calcular y fijar el dígito real); `weightedAverageCost(10,1000,10,2000) === 1500`; `lateCostAverage(0, 0, 5, 800) === 800`; `isValidQuantity('unidad', 1.5) === false`, `isValidQuantity('kg', 1.5) === true`; `parseImportRows` detecta código duplicado en el archivo, nombre vacío, unidad inválida, `1.250.000` → `1250000`; detector: 13 teclas con 10 ms + Enter → código; 5 teclas → `null`; teclas con 120 ms → `null`; ráfaga terminada en Tab → `null`. Actualizar `tests/permissions.test.ts` con los nuevos permisos por rol.
- [ ] **Step 2:** `npm install` y `npx vitest run tests/inventory.test.ts tests/permissions.test.ts`. Esperado: FAIL (módulos no existen).
- [ ] **Step 3:** Implementar los módulos y permisos; instalar `papaparse @types/papaparse read-excel-file jsbarcode`.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run lint`. Esperado: todo pasa.
- [ ] **Step 5:** Commit `Inventario: lógica de códigos, costos, importación y lector`.

### Task 3: Productos, ficha y kardex

**Files:**
- Create: `src/app/(app)/inventario/page.tsx`, `src/app/(app)/inventario/[id]/page.tsx`, `src/components/inventory/ProductSheet.tsx`, `src/components/inventory/StockBadge.tsx`, `src/components/inventory/KardexTable.tsx`, `src/components/inventory/LowStockCard.tsx`
- Modify: `src/components/nav.ts` (agregar `{ href: "/inventario", label: "Inventario", icon: Package }` primero en `SECONDARY_NAV`), `src/app/(app)/page.tsx` (mostrar `LowStockCard` si hay productos con `stock <= min_stock`)

**Interfaces:** Consumes `api.ts`, `permissionsFor`, `useBarcodeScanner`, `UNITS`. Leer `src/context/FinanceContext.tsx` para obtener el negocio activo y el rol, y `src/components/ui/*` para reutilizar `PageHeader`, `BottomSheet`, `DataTable`, `Button`, `EmptyState`.

- [ ] **Step 1:** Lista: búsqueda por nombre/código, filtros (categoría, stock bajo, agotado, inactivos), resumen (valor del inventario = Σ stock·avg_cost solo si `canViewCosts`; cantidad con stock bajo; agotados). Escanear un código existente abre su ficha; uno inexistente suena (Web Audio, 200 ms) y ofrece crear producto con el código lleno.
- [ ] **Step 2:** `ProductSheet`: crear/editar con nombre, código (botón "Generar código interno" → `nextInternalBarcode`), categoría (crear en línea), unidad, precio contado, precio crédito (por defecto = contado), stock mínimo; al crear, stock inicial y costo opcionales → `setOpeningStock`. Aviso si precio < costo (RN-05). Errores con `inventoryErrorMessage` en toast.
- [ ] **Step 3:** Ficha `/inventario/[id]`: datos, stock con `StockBadge` (ok / bajo / agotado), kardex con fecha, tipo, cantidad, stock después, costo (si `canViewCosts`), usuario, motivo; acciones según permisos: Editar, Entrada (link a `/inventario/entradas/nueva?producto=<id>`), Ajuste (Task 4), Etiqueta (link a `/inventario/etiquetas?ids=<id>`), Desactivar/Reactivar.
- [ ] **Step 4:** `npm run lint && npx tsc --noEmit && npm run build`. Esperado: pasa. Probar en el navegador con `npm run dev` si hay Supabase local; si no, decirlo.
- [ ] **Step 5:** Commit `Inventario: lista de productos, ficha y kardex`.

### Task 4: Entradas y ajustes

**Files:**
- Create: `src/app/(app)/inventario/entradas/page.tsx`, `src/app/(app)/inventario/entradas/nueva/page.tsx`, `src/app/(app)/inventario/entradas/[id]/page.tsx`, `src/components/inventory/AdjustSheet.tsx`
- Modify: `src/app/(app)/inventario/[id]/page.tsx` (abrir `AdjustSheet`)

**Interfaces:** Consumes `receiveStock`, `completeReceipt`, `adjustStock`, `listReceipts`, `getReceipt`, contactos y cuentas del `FinanceContext`.

- [ ] **Step 1:** Nueva entrada: lector siempre activo (escanear el mismo producto suma 1), búsqueda por nombre, líneas con cantidad (validada con `isValidQuantity`) y costo unitario (oculto si `!canReceiveWithCost`), proveedor (contactos `supplier|both`, crear en línea), fecha, total. Interruptor "Registrar el gasto" (activado por defecto, oculto sin costo) con cuenta y "Pagado / Pendiente" (+ fecha de vencimiento). Confirmar → `receiveStock`; tecla F2 confirma.
- [ ] **Step 2:** Lista de entradas con número, fecha, proveedor, total, estado; filtro "Falta costo". Detalle `[id]`: líneas; si `pending_cost` y `canReceiveWithCost`, formulario de costos + opción de gasto → `completeReceipt`.
- [ ] **Step 3:** `AdjustSheet`: modo "Conteo físico" (escribe lo contado, muestra la diferencia) o "Salida" (daño/pérdida/otro); motivo obligatorio; nota. Solo si `canAdjustStock`.
- [ ] **Step 4:** `npm run lint && npx tsc --noEmit && npm run build`. Esperado: pasa.
- [ ] **Step 5:** Commit `Inventario: entradas de mercancía y ajustes`.

### Task 5: Importación, etiquetas y cámara

**Files:**
- Create: `src/app/(app)/inventario/importar/page.tsx`, `src/app/(app)/inventario/etiquetas/page.tsx`, `src/components/inventory/CameraScanButton.tsx`
- Modify: `src/app/(app)/inventario/page.tsx` y `entradas/nueva/page.tsx` (agregar `CameraScanButton`)

**Interfaces:** Consumes `readImportFile`, `parseImportRows`, `importProducts`, `jsbarcode`.

- [ ] **Step 1:** Importar: elegir archivo `.csv`/`.xlsx`, botón "Descargar plantilla" (CSV con los encabezados de Task 2), vista previa en tabla, filas con error resaltadas, confirmar solo sin errores; mostrar errores del servidor si vuelve `ok=false`. Solo si `canImportProducts`.
- [ ] **Step 2:** Etiquetas: recibe `?ids=`; selector de productos y cantidad de copias; cuadrícula de etiquetas (nombre, precio contado, código de barras SVG con `jsbarcode`, EAN13 si es GTIN válido de 13 dígitos, si no CODE128); `@media print` oculta todo lo demás; botón "Imprimir" → `window.print()`.
- [ ] **Step 3:** `CameraScanButton`: se muestra solo si `'BarcodeDetector' in window`; abre la cámara trasera en un `BottomSheet`, detecta `ean_13, ean_8, upc_a, code_128` y llama `onScan(code)`; libera la cámara al cerrar.
- [ ] **Step 4:** `npm run lint && npx tsc --noEmit && npm run build`. Esperado: pasa.
- [ ] **Step 5:** Commit `Inventario: importación, etiquetas y lectura con cámara`.

### Task 6: Prueba de punta a punta y verificación final

**Files:**
- Create: `e2e/inventory.spec.ts` (seguir `e2e/smoke.spec.ts` y `e2e/helpers.ts`)
- Modify: `README.md` (sección Funcionalidades: una línea de Inventario)

- [ ] **Step 1:** Spec: entrar, crear producto con código `7702004003508` y stock inicial 5, registrar entrada de 3 con costo, abrir la ficha y ver stock 8 y dos filas en el kardex.
- [ ] **Step 2:** Correr `npm run test:e2e -- e2e/inventory.spec.ts` con Supabase local si es posible; si no se puede levantar, decirlo.
- [ ] **Step 3:** Verificación completa: `npm run lint && npx tsc --noEmit && npm test && npm run build` (+ `npx supabase@latest test db` si está disponible). Esperado: todo pasa.
- [ ] **Step 4:** Commit `Inventario: prueba de punta a punta y README`.
