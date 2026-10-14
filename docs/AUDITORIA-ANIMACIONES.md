# Auditoría de animaciones (12 principios de animación)

Auditoría de todo el código de animación y transición en `src/**` contra las reglas del skill `12-principles-of-animation`; los números de línea corresponden al código antes de las correcciones.

## Hallazgos

### Timing

```
src/components/ui/motion.ts:20 - [timing-under-300ms] SPRINGS.sheet usa response 0.34s: la apertura/cierre de la sheet (iniciada por el usuario) supera el presupuesto de 300ms
src/components/charts/CategoryPieChart.tsx:29 - [timing-under-300ms] Pie anima con la duración por defecto de Recharts (>=400ms) al cambiar de mes
src/components/charts/FutureBalanceChart.tsx:43 - [timing-under-300ms] Area anima 1500ms por defecto
src/components/charts/TrendLineChart.tsx:40 - [timing-under-300ms] Line anima 1500ms por defecto
src/components/charts/IncomeExpenseBarChart.tsx:39 - [timing-under-300ms] Bar (ingresos) anima con la duración por defecto
src/components/charts/IncomeExpenseBarChart.tsx:40 - [timing-under-300ms] Bar (gastos) anima con la duración por defecto
src/components/Toaster.tsx:7 - [timing-under-300ms] Sonner mueve los toasts con transiciones de 400ms
src/components/ui/ConfirmDialog.tsx:103 - [timing-consistent] Scrim con fadeIn 0.15s, mientras fadeIn en AppLockGate usa 0.3s
src/components/ui/ConfirmDialog.tsx:112 - [timing-consistent] popIn 0.24s con curva propia, fuera de cualquier token
src/components/AppLockGate.tsx:53 - [timing-consistent] fadeIn 0.3s hardcodeado
src/components/AppLockGate.tsx:86 - [timing-consistent] slideDown 0.25s hardcodeado
src/components/AppLockGate.tsx:94 - [timing-consistent] fadeIn 0.3s hardcodeado (igual que arriba, distinto de ConfirmDialog)
src/components/FloatingActionButton.tsx:100 - [timing-consistent] duration-100 en el FAB frente a 150ms en el resto de controles
src/app/globals.css:140 - [timing-consistent] body usa 0.2s ease literal, sin tokens de duración
src/app/globals.css:231 - [timing-consistent] .app-header::before usa 0.2s ease-out literal
src/components/charts/BudgetSection.tsx:60 - [timing-consistent] La barra de presupuesto usa transition-all (150ms ease por defecto) en vez de un tiempo propio de progreso
```

### Easing

```
src/components/Toaster.tsx:7 - [easing-entrance-ease-out] Los toasts entran con `ease` por defecto de Sonner
src/components/charts/CategoryPieChart.tsx:29 - [easing-entrance-ease-out] Recharts entra con `ease`, no ease-out
src/components/charts/FutureBalanceChart.tsx:43 - [easing-entrance-ease-out] Ídem
src/components/charts/TrendLineChart.tsx:40 - [easing-entrance-ease-out] Ídem
src/components/charts/IncomeExpenseBarChart.tsx:39 - [easing-entrance-ease-out] Ídem (barra de ingresos)
src/components/charts/IncomeExpenseBarChart.tsx:40 - [easing-entrance-ease-out] Ídem (barra de gastos)
src/components/ui/ConfirmDialog.tsx:112 - [easing-entrance-ease-out] Curva cubic-bezier propia en lugar de un token ease-out
src/app/globals.css:1 - [easing-entrance-ease-out] Las utilidades `transition` heredan la curva ease-in-out de Tailwind (cubic-bezier(.4,0,.2,1)); no hay token de easing
src/components/ui/ConfirmDialog.tsx:101 - [easing-exit-ease-in] El diálogo se desmonta sin animación de salida (entra con animación, sale de golpe)
src/components/Toaster.tsx:7 - [easing-exit-ease-in] Los toasts salen con `ease` por defecto de Sonner
```

### Physics

```
src/components/MonthSelector.tsx:16 - [physics-subtle-deformation] active:scale-[0.92] fuera del rango 0.95-1.05
src/components/MonthSelector.tsx:27 - [physics-subtle-deformation] active:scale-[0.92]
src/components/ui/BottomSheet.tsx:312 - [physics-subtle-deformation] active:scale-[0.92] en el botón cerrar
src/components/BottomNav.tsx:61 - [physics-subtle-deformation] active:scale-[0.92] en los ítems de la nav
src/components/GettingStarted.tsx:94 - [physics-subtle-deformation] active:scale-[0.92]
src/components/CategoryModal.tsx:139 - [physics-subtle-deformation] active:scale-[0.92] en el selector de color
src/components/CategoryModal.tsx:162 - [physics-subtle-deformation] active:scale-[0.92] en el selector de ícono
src/components/AppHeader.tsx:36 - [physics-subtle-deformation] active:scale-[0.92] en el botón de privacidad
src/components/FloatingActionButton.tsx:100 - [physics-subtle-deformation] active:scale-[0.94] en el FAB
src/components/AppLockGate.tsx:78 - [physics-subtle-deformation] active:scale-90 en el botón de huella
src/app/globals.css:266 - [physics-subtle-deformation] .spring-pop arranca en scale(0.7) (deformación de 30%)
src/components/FloatingActionButton.tsx:11 - [physics-active-state] Los ítems del menú usan transition-colors: el :active no anima la escala
src/components/ui/PageHeader.tsx:28 - [physics-active-state] Falta :active con escala (botón volver)
src/components/TransactionModal.tsx:363 - [physics-active-state] Falta :active (botón eliminar)
src/components/CategoryModal.tsx:189 - [physics-active-state] Falta :active (botón eliminar)
src/app/(app)/admin/page.tsx:30 - [physics-active-state] Falta :active en filas con enlace
src/app/(app)/admin/clientes/page.tsx:258 - [physics-active-state] Falta :active en la tarjeta de cliente
src/app/(app)/admin/layout.tsx:91 - [physics-active-state] Falta :active en las pestañas del admin
src/app/(app)/admin/pagos/page.tsx:292 - [physics-active-state] Falta :active en los filtros
src/app/(app)/reportes/page.tsx:182 - [physics-active-state] Falta :active en los chips de período
src/app/(app)/reportes/page.tsx:235 - [physics-active-state] Falta :active en las pestañas
src/app/(app)/page.tsx:86 - [physics-active-state] Falta :active en las tarjetas del inicio
src/app/(app)/cartera/page.tsx:73 - [physics-active-state] Falta :active en los chips de cuenta
src/app/(app)/cartera/page.tsx:187 - [physics-active-state] Falta :active en las pestañas Me deben / Debo
src/app/(app)/cuentas/page.tsx:100 - [physics-active-state] Falta :active en los tipos de cuenta
src/app/(app)/cuentas/page.tsx:352 - [physics-active-state] Falta :active en las filas de cuenta
src/app/(app)/cuentas/page.tsx:402 - [physics-active-state] Falta :active (eliminar transferencia)
src/app/(app)/ajustes/page.tsx:50 - [physics-active-state] Falta :active en las filas de ajustes
src/app/(app)/ajustes/page.tsx:354 - [physics-active-state] Falta :active en el interruptor
src/app/(app)/ajustes/page.tsx:484 - [physics-active-state] Falta :active en el selector
src/app/(app)/cobros/page.tsx:84 - [physics-active-state] Falta :active en las pestañas
src/app/(app)/cobros/page.tsx:120 - [physics-active-state] Falta :active en las tarjetas de documento
src/app/(app)/recurrentes/page.tsx:224 - [physics-active-state] Falta :active (editar)
src/app/(app)/recurrentes/page.tsx:232 - [physics-active-state] Falta :active (pausar)
src/app/(app)/recurrentes/page.tsx:240 - [physics-active-state] Falta :active (eliminar)
src/app/(app)/suscripcion/page.tsx:88 - [physics-active-state] Falta :active (copiar)
src/app/(app)/suscripcion/page.tsx:240 - [physics-active-state] Falta :active en el selector de plan
src/app/(app)/suscripcion/page.tsx:477 - [physics-active-state] Falta :active
src/app/(app)/contactos/page.tsx:106 - [physics-active-state] Falta :active en el selector de tipo
src/app/(app)/contactos/page.tsx:270 - [physics-active-state] Falta :active en las pestañas
src/app/(app)/contactos/page.tsx:327 - [physics-active-state] Falta :active en las filas de contacto
src/app/(app)/movimientos/page.tsx:110 - [physics-active-state] Falta :active (botón de búsqueda)
src/app/(app)/movimientos/page.tsx:136 - [physics-active-state] Falta :active (botón de filtros)
src/app/(app)/movimientos/page.tsx:163 - [physics-active-state] Falta :active en los chips de tipo
src/app/login/page.tsx:183 - [physics-active-state] Falta :active en las pestañas entrar / crear cuenta
src/app/precios/page.tsx:200 - [physics-active-state] Falta :active en el selector de ciclo
```

`physics-spring-for-overshoot` y `physics-no-excessive-stagger`: sin hallazgos. Los resortes de BottomSheet, FAB, SegmentedControl y BottomNav están bien elegidos (interrumpibles, parten del valor y la velocidad vivos) y no se reemplazan por easings. No existía ningún stagger.
`timing-no-entrance-context-menu` y `easing-natural-decay`: sin hallazgos (no hay menús contextuales ni rampas de audio; el menú del FAB es un menú de acción con salida simétrica).

### Staging

```
src/components/AppLockGate.tsx:71 - [staging-one-focal-point] animate-ping y animate-pulse (anillo exterior) compiten alrededor del mismo botón
src/components/AppLockGate.tsx:72 - [staging-one-focal-point] Segundo anillo pulsante simultáneo con el ping
src/components/FloatingActionButton.tsx:72 - [staging-dim-background] El menú del FAB se abre sin atenuar el fondo
src/components/ui/ConfirmDialog.tsx:101 - [staging-z-index-hierarchy] z-[60] hardcodeado, sin token
src/components/ui/BottomSheet.tsx:280 - [staging-z-index-hierarchy] z-50 hardcodeado
src/components/ui/BottomSheet.tsx:292 - [staging-z-index-hierarchy] z-10 hardcodeado en el panel
src/components/ui/BottomSheet.tsx:301 - [staging-z-index-hierarchy] z-10 hardcodeado en la cabecera
src/components/BottomNav.tsx:44 - [staging-z-index-hierarchy] z-40 hardcodeado
src/components/FloatingActionButton.tsx:72 - [staging-z-index-hierarchy] z-40, empata con la nav; el orden depende del DOM
src/app/(app)/cobros/nuevo/page.tsx:248 - [staging-z-index-hierarchy] z-20 hardcodeado en la barra de acción
src/components/ui/SegmentedControl.tsx:88 - [staging-z-index-hierarchy] z-10 hardcodeado
src/app/globals.css:219 - [staging-z-index-hierarchy] z-index 30 literal en .app-header
src/components/Toaster.tsx:7 - [staging-z-index-hierarchy] Los toasts usan el z-index por defecto de Sonner (999999999), fuera de la escala
```

## Resumen

| Rule | Count | Severity |
|------|-------|----------|
| `timing-under-300ms` | 7 | HIGH |
| `timing-consistent` | 9 | MEDIUM |
| `timing-no-entrance-context-menu` | 0 | - |
| `easing-entrance-ease-out` | 8 | MEDIUM |
| `easing-exit-ease-in` | 2 | MEDIUM |
| `easing-no-linear-motion` | 0 | - |
| `easing-natural-decay` | 0 | - |
| `physics-active-state` | 35 | MEDIUM |
| `physics-subtle-deformation` | 11 | MEDIUM |
| `physics-spring-for-overshoot` | 0 | - |
| `physics-no-excessive-stagger` | 0 | - |
| `staging-one-focal-point` | 2 | LOW |
| `staging-dim-background` | 1 | MEDIUM |
| `staging-z-index-hierarchy` | 10 | MEDIUM |

## Resultado

Todos los hallazgos están corregidos. Los resortes de la pasada anterior se mantienen (sheet, menú del FAB, indicadores de SegmentedControl y BottomNav).

**Tokens y consistencia**
- `globals.css` define `--duration-instant/fast/base/slow` (75/150/200/300ms), `--stagger` (30ms), `--ease-out`, `--ease-in`, `--ease-linear` y la escala `--z-*`. `@theme` apunta `--default-transition-*` a esos tokens, así que todo `transition` de Tailwind usa 150ms ease-out.
- Se eliminaron duraciones y curvas literales (`duration-100/150`, `0.15s`, `0.24s`, `0.3s`, `cubic-bezier(...)`). Clases compartidas: `.anim-fade-in/out`, `.anim-pop-in/out`, `.anim-slide-down`.
- `SPRINGS.sheet` pasa a response 0.3s. Los charts de Recharts animan 300ms con ease-out y se apagan con movimiento reducido. Los toasts de Sonner se alinean con los tokens (entrada ease-out, salida ease-in).
- ConfirmDialog tiene ahora salida (ease-in, 150ms) simétrica a la entrada.

**Física y staging**
- Todo `:active` queda entre 0.95 y 1.05 (iconos y FAB 0.95, controles 0.97, filas 0.98). Se añadió `:active` a los 35 controles que no lo tenían. `.spring-pop` arranca en 0.95.
- El menú del FAB atenúa el fondo (`bg-black/40`, opacidad ligada al resorte). AppLockGate deja un solo anillo (ping).
- Escala de z-index como tokens: raised 10, bar 20, header 30, nav 40, fab 45, sheet 50, dialog 60, toast 70.

**Adiciones**
- Entrada escalonada de 30ms por ítem (máx. 10 ítems, solo en la primera carga) en Movimientos, Cartera y Cuentas (`useEnterOnce`, `stagger`, `.stagger-in`).
- `AnimatedValue`: la cifra nueva aparece desde el primer frame con un fundido de 200ms (BalanceCard, StatTile, totales de Cartera y Cuentas); sin conteo.
- Toast de éxito con check animado (círculo con escala y trazo que se dibuja) y toast "Movimiento guardado/actualizado" al guardar un movimiento.
- Barras de progreso (presupuestos, categorías, uso del plan): crecen en 300ms con easing lineal al montar y al cambiar (`.progress-fill`), el único uso de linear.
- Cross-fade de 200ms al cambiar de pestaña en Cartera, Cobros y Reportes (`.tab-fade`).
- Transición entre pestañas de la nav: `src/app/(app)/template.tsx` aplica un fundido de 150ms solo de opacidad. No hay deslizamiento horizontal porque desplazaría el layout y chocaría con la cabecera sticky y con el scroll de cada página.
