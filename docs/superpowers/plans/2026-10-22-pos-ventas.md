# Venta (POS) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vender con lector de código de barras (contado/crédito, descuentos, pagos mixtos), con stock, kardex y finanzas actualizados en una sola transacción, y comprobante JPG para compartir.

**Architecture:** Dos funciones `security definer` (`pos_confirm_sale`, `pos_void_sale`) hacen todo el trabajo crítico con bloqueo de fila y recalculan precios en el servidor. La UI (`/vender`, `/ventas`) llama a `src/lib/pos/api.ts`; la lógica de totales vive en `src/lib/pos/totals.ts` (pura, probada) y se usa para mostrar; el servidor es la fuente de verdad.

**Tech Stack:** Next.js 16 (leer `node_modules/next/dist/docs/` antes de escribir rutas), React 19, Tailwind v4, Supabase (RLS + pgTAP), Vitest, Playwright. Dependencia nueva permitida: `html-to-image`.

**Spec:** `docs/superpowers/specs/2026-10-22-pos-ventas-design.md` (leerlo completo). Contexto: `docs/superpowers/specs/2026-10-22-inventario-design.md` y la migración `supabase/migrations/20261022120000_inventory.sql` (patrones a reutilizar: bandera `app.inventory_write`, `product_costs`, bloqueo ordenado, `workspace_counters`, `enforce_plan_limits`).

## Global Constraints

- Español de Colombia, tuteo, frases cortas. Estilo y patrones como en el módulo de inventario (`src/app/(app)/inventario/**`, `src/components/inventory/*`, `src/lib/inventory/*`).
- Roles que venden: `owner`, `admin`, `editor`, `recorder`. Anular y cambiar ajustes de POS: `owner`, `admin`. `accountant` solo lee.
- Tope de descuento por defecto `10` (%) para `editor` y `recorder`; owner/admin sin tope. Descuento efectivo de la venta = (Σ descuentos de línea + descuento total) / subtotal.
- Medios de pago: `cash`, `transfer`, `nequi`, `daviplata`, `card`; cada pago lleva `account_id`.
- Categoría de ingreso de ventas: nombre exacto `Ventas`, tipo `income`; si no existe en el negocio se crea dentro de `pos_confirm_sale`.
- Leyenda exacta del comprobante: `Comprobante de venta - No es factura electrónica`.
- Errores: `SIN_PERMISO`, `STOCK_INSUFICIENTE:<nombre>`, `DESCUENTO_SOBRE_TOPE`, `CLIENTE_REQUERIDO`, `PAGO_NO_CUADRA`, `VENTA_ANULADA`, `PRECIO_NEGATIVO`, `MOTIVO_REQUERIDO`, `CUENTA_REQUERIDA`.
- Nada de `git add -A` / `git commit -a`: cada agente agrega solo sus archivos. Commits terminan con las líneas de atribución que indique quien coordina.

## Review Focus

- Precio manipulado desde el cliente: el servidor ignora precios enviados y usa `products.price_cash|price_credit`. Prueba pgTAP.
- Pago en efectivo mayor al total (vueltas): se registra solo el total como ingreso; `change` guardado en `sale_payments`. Prueba pgTAP + Vitest.
- Cambiar de Contado a Crédito con líneas ya agregadas: recalcula todos los precios. Prueba Vitest (`recalcLines`).
- Anular dos veces la misma venta: segunda vez `VENTA_ANULADA`, sin devolver stock doble. Prueba pgTAP.
- Venta con producto `kg` y cantidad 0,5: válida; con `unidad` y 0,5: `CANTIDAD_INVALIDA`. Prueba pgTAP.

---

### Task 1: Base de datos de ventas

**Files:** Create `supabase/migrations/20261023120000_pos_sales.sql`, `supabase/tests/07_pos.test.sql`, `src/types/pos.ts` (créalo primero: lo usan otros agentes en paralelo).

**Interfaces (Produces):**
- Tablas y columnas del spec (sección "Modelo de datos"). `sale_items.unit_cost` no legible por `recorder`: ponlo en tabla aparte `sale_item_costs(sale_item_id, workspace_id, unit_cost)` con RLS como `product_costs`.
- `pos_confirm_sale(p_workspace uuid, p_kind text, p_contact uuid, p_lines jsonb, p_total_discount jsonb, p_payments jsonb, p_initial_payment jsonb, p_notes text) returns jsonb` → `{"sale_id": uuid, "number": int, "total": numeric, "balance": numeric}`.
  - `p_lines`: `[{product_id, quantity, discount: {type: 'pct'|'amount', value}|null}]` (sin precio).
  - `p_total_discount`: `{type: 'pct'|'amount', value}` o `null`.
  - `p_payments` (contado): `[{method, account_id, amount}]`; para `cash`, `amount` es lo recibido. Σ ≥ total y el exceso solo puede venir de efectivo, si no `PAGO_NO_CUADRA`.
  - `p_initial_payment` (crédito): `{method, account_id, amount}` o `null`; `amount` ≤ total.
- `pos_void_sale(p_sale uuid, p_reason text) returns void`.
- `pos_update_settings(p_workspace uuid, p_max_discount_pct numeric, p_allow_negative_stock boolean) returns void` (owner/admin).
- Kardex: movimientos `sale` (cantidad negativa, `unit_cost` = costo promedio vigente) y `sale_void` (positiva); agregar `sale_id` a `stock_movements` si no hay forma de referenciar la venta.
- TS en `src/types/pos.ts`: `SaleKind`, `PaymentMethod`, `Discount`, `Sale`, `SaleItem`, `SalePayment` (campos = columnas).

- [ ] **Step 1:** Escribir `07_pos.test.sql` (helpers como `06_inventory.test.sql`) con los casos del spec ("Pruebas") y del Review Focus.
- [ ] **Step 2:** Intentar `npx supabase@latest test db`; si Docker no baja imágenes, usar el Postgres local del andamiaje en `/tmp/claude-0/-home-user-Finanzasapp/67e07ace-78c0-552a-818b-88f76f3ed7d3/scratchpad/` (`run.sh`, `scaffold.sql`, `pgtap_shim.sql`) y reportarlo. Confirmar rojo.
- [ ] **Step 3:** Escribir la migración (no destructiva). Reutilizar la bandera `app.inventory_write` para tocar `products.stock`.
- [ ] **Step 4:** Correr 06 y 07 (y las demás posibles). Esperado: pasan.
- [ ] **Step 5:** Commit `POS: esquema, funciones y pruebas de base de datos`.

### Task 2: Lógica de totales, API y permisos

**Files:** Create `src/lib/pos/totals.ts`, `src/lib/pos/api.ts`, `tests/pos.test.ts`; Modify `src/lib/inventory/errors.ts` (códigos nuevos), `src/lib/permissions.ts`, `tests/permissions.test.ts`, `package.json` (`html-to-image`).

**Interfaces (Produces):**
- `totals.ts`: `type CartLine = { productId: string; name: string; unit: ProductUnit; quantity: number; unitPrice: number; discount: Discount | null }`; `lineTotal(l: CartLine): number`; `recalcLines(lines: CartLine[], products: Product[], kind: SaleKind): CartLine[]`; `cartTotals(lines: CartLine[], totalDiscount: Discount | null): { subtotal: number; lineDiscounts: number; totalDiscount: number; total: number; discountPct: number }`; `cashChange(total: number, payments: { method: PaymentMethod; amount: number }[]): { change: number; missing: number }`. Redondeo a pesos enteros (`Math.round`) en cada línea.
- `api.ts`: `confirmSale(input)`, `voidSale(saleId, reason)`, `listSales(workspaceId, filters)`, `getSale(saleId)` → `{ sale, items, payments, contact }`, `updatePosSettings(input)`, `getPosSettings(workspaceId)`.
- `Permissions` agrega `canSell`, `canVoidSale`, `canManagePosSettings`.

- [ ] **Step 1:** `tests/pos.test.ts`: descuento % y valor por línea; descuento total sobre subtotal ya descontado; línea nunca < 0; `recalcLines` cambia de `price_cash` a `price_credit`; `cashChange(80000, [{cash, 100000}])` → `{change: 20000, missing: 0}`; pago mixto que no alcanza → `missing > 0`; `discountPct` correcto. Permisos por rol.
- [ ] **Step 2:** Rojo → implementar → `npm test`, `npx next typegen && npx tsc --noEmit`, `npm run lint` en verde (errores solo de archivos de otras tareas en curso se reportan).
- [ ] **Step 3:** Commit `POS: totales, acceso a datos y permisos`.

### Task 3: Pantalla de venta `/vender`

**Files:** Create `src/app/(app)/vender/page.tsx`, `src/components/pos/{CartLineRow,CustomerPicker,PaymentSheet}.tsx`.

**Interfaces:** Consumes Task 2 y `useBarcodeScanner`, `CameraScanButton`, `listProducts`. Usa `import { ReceiptImage } from "@/components/pos/ReceiptImage"` (Task 4) con props `{ saleId: string; open: boolean; onClose: () => void }` para mostrar el comprobante al confirmar.

- [ ] **Step 1:** Selector Contado/Crédito (recalcula), lector siempre activo (escanear suma 1), búsqueda por nombre, líneas con cantidad y descuento (% o valor), descuento total, totales con `cartTotals`, aviso si precio < costo solo con `canViewCosts`.
- [ ] **Step 2:** `CustomerPicker` (buscar por documento o nombre en contactos `client|both`, crear en línea con nombre, documento, teléfono, dirección); obligatorio en crédito.
- [ ] **Step 3:** `PaymentSheet` (F2 o botón "Cobrar"): contado con uno o varios medios, cuenta por medio (por defecto: efectivo → cuenta `cash`), vueltas en vivo; crédito con abono inicial opcional. Confirmar → `confirmSale`; éxito → limpiar carrito y abrir `ReceiptImage`. Errores con `inventoryErrorMessage`.
- [ ] **Step 4:** lint, typegen+tsc. Commit `POS: pantalla de venta`.

### Task 4: Ventas, comprobante, ajustes y navegación

**Files:** Create `src/app/(app)/ventas/page.tsx`, `src/app/(app)/ventas/[id]/page.tsx`, `src/components/pos/ReceiptImage.tsx`, `src/components/pos/VoidSaleSheet.tsx`; Modify `src/components/nav.ts`, `src/components/BottomNav.tsx` (o donde esté la navegación móvil) y `src/app/(app)/ajustes/page.tsx`.

**Interfaces:** Produces `ReceiptImage` con el contrato de Task 3. Consumes Task 2.

- [ ] **Step 1:** `ReceiptImage`: tiquete (datos del negocio de `workspaces`: nombre, documento, logo; número, fecha en America/Bogota, cliente, líneas, descuentos, total, tipo, pagos/vueltas, saldo pendiente si crédito, leyenda exacta). Generar JPG con `html-to-image` (`toJpeg`) tras cargar fuentes/logo; "Compartir" con `navigator.share({ files })` si existe, si no "Descargar"; botón WhatsApp `wa.me/<teléfono del cliente>` si hay teléfono. Nunca sube la imagen.
- [ ] **Step 2:** `/ventas`: lista con filtros (fecha, contado/crédito, activa/anulada), totales del filtro; `/ventas/[id]`: detalle, "Ver comprobante" (`ReceiptImage`), "Anular" (`VoidSaleSheet`, motivo obligatorio) solo con `canVoidSale`.
- [ ] **Step 3:** Navegación: "Vender" visible en celular (barra inferior o botón principal) y en el menú lateral; "Ventas" en el menú lateral y en Ajustes (grupo Negocio). Ajustes del negocio: tope de descuento y permitir stock negativo (`updatePosSettings`) solo con `canManagePosSettings`.
- [ ] **Step 4:** lint, typegen+tsc. Commit `POS: historial de ventas, comprobante y ajustes`.

### Task 5: Punta a punta y verificación

**Files:** Create `e2e/pos.spec.ts`; Modify `README.md`.

- [ ] **Step 1:** e2e (dueño, datos semilla): crear producto con stock (como `e2e/inventory.spec.ts`), vender 2 de contado en efectivo con vueltas, ver la venta en `/ventas` y stock reducido; venta a crédito a un cliente y verla en `/cartera`. Usar `.uncheck()`/`.check()` en interruptores nativos y mostrar el texto de `p[role="alert"]` si aparece.
- [ ] **Step 2:** `npm run lint && npx next typegen && npx tsc --noEmit && npm test && npm run build` (build con `NEXT_PUBLIC_SUPABASE_URL` y llave ficticias). La e2e se valida en el CI.
- [ ] **Step 3:** Commit `POS: prueba de punta a punta y README`.
