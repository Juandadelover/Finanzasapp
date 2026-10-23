# Hallazgos de los recorridos simulados

Fecha: 23 de octubre de 2026. Un agente automatizado (Playwright, celular de 390 px, modo "Probar como invitado") recorrió la app real conectada a Supabase haciendo las tareas de dos perfiles: la **tendera** (registrar ventas y gastos, cobrar, mirar su plata) y el **freelancer/restaurante** (contactos, cuentas de cobro, recurrentes, reportes, inventario, equipo).

**Qué mide esto y qué no.** Detecta fricción de pantalla y errores reales. No mide si alguien pagaría ni cómo se siente usarla: eso solo lo contestan personas reales (ver `PLAN-VALIDACION.md`). Los tiempos son de un script, no de una persona.

**No se probó:** los roles *contador* y *solo registro* (requieren invitación por email), el pago de la suscripción, el escáner de códigos, el escritorio y el estado de resultados con datos.

## Hallazgos

### Altos

**1. El inventario está roto en producción.**
- `/inventario` muestra "No pudimos cargar el inventario". La base responde 404 a `products`, `product_costs` y `product_categories`.
- La causa: la migración `supabase/migrations/20261022120000_inventory.sql` no está aplicada. Las migraciones en el proyecto llegan hasta `20261014233923_admin_console`.
- Además, esas peticiones 404 se disparan en cada pantalla, porque el inventario se carga al abrir la app.
- Arreglo: aplicar la migración en Supabase. No lo hice porque cambia el esquema de tu base real.

**2. Un dueño nuevo no puede cobrarle a nadie.**
- Prueba: registrar "Don Pedro me debe $ 80.000". El selector de contacto del formulario solo aparece si ya existe algún contacto (`src/components/TransactionModal.tsx:261`). Un usuario nuevo escribe "Don Pedro" en la descripción.
- En Cartera la deuda sale como **"Sin contacto"** y el único botón es "Marcar como pagado". El botón de WhatsApp exige un contacto con teléfono (`src/app/(app)/cartera/page.tsx:152`).
- Es justo el gancho del producto ("Me deben" + WhatsApp) y falla en el primer intento. Lo mismo pasa en `/cobros/nuevo`: "Aún no tienes clientes. Agrégalos en Contactos".
- Arreglo sugerido: crear el contacto desde el mismo formulario (nombre y teléfono) y, en una deuda sin contacto, un botón "Agregar teléfono para cobrar".

**3. La proyección a 90 días asusta con pocos datos.**
- Con una sola compra de $ 120.000 en el mes, Estadísticas dice "Proyectado en 90d: **-$ 468.387**".
- La cuenta (`src/app/(app)/estadisticas/page.tsx`) toma el balance del mes seleccionado, lo divide por los días del mes y lo multiplica por 90. Con un mes casi vacío da un resultado alarmista, y no cuenta lo pendiente ni los recurrentes.
- Arreglo sugerido: ocultar la proyección hasta tener al menos un mes completo de movimientos, o mostrarla con el aviso "con pocos datos".

### Medios

**4. No hay cuenta "Nequi" de entrada.** Una cuenta nueva trae solo "Efectivo" y "Cuenta bancaria", pero la página de precios promete "Nequi, Bancolombia y efectivo". Un gasto registrado sin elegir cuenta se descuenta de Efectivo: el saldo quedó en **-$ 120.000** y el mensaje cambió a "Pérdida del mes", sin ningún aviso de saldo negativo.

**5. Pantallas vacías para un usuario nuevo.** Estadísticas muestra tres veces "Sin datos el mes pasado" y gráficas de 6 y 8 meses sin nada. Es mejor un solo mensaje que explique que se llenan con el uso.

### Lo que funcionó

- **Registrar una venta: 4 toques y unos 4 segundos** (Ingreso, monto, categoría, cuenta, Guardar). Cumple tu meta de menos de 5 segundos.
- El acceso como invitado entra directo, con prueba gratis hasta el 6 de noviembre.
- Los textos de estados vacíos (Contactos, Cobros, Recurrentes, Reportes) son claros y dicen qué hacer.
- Equipo ofrece los cuatro roles con una frase explicando cada uno.

## Datos de prueba que quedaron en la base

El borrado desde el conector de Supabase se colgó (60 s sin respuesta, incluso con un `delete ... where false`), así que **quedaron 10 usuarios anónimos de prueba**, con 10 negocios "Mi negocio" y 3 movimientos. Todos se crearon el 23 de octubre de 2026 entre las 16:08 y las 16:15 UTC. Para borrarlos, corre esto en el SQL Editor de Supabase:

```sql
do $$
declare ids uuid[]; wids uuid[];
begin
  select array_agg(id) into ids from auth.users
   where is_anonymous
     and created_at between '2026-10-23 16:08:00+00' and '2026-10-23 16:15:00+00';
  select array_agg(distinct workspace_id) into wids
    from public.memberships where user_id = any(ids);
  delete from public.workspaces where id = any(wids);
  delete from auth.users where id = any(ids);
end $$;
```

Antes de correrlo, confirma que `select count(*) from auth.users where is_anonymous and created_at between '2026-10-23 16:08:00+00' and '2026-10-23 16:15:00+00'` da **10**.
