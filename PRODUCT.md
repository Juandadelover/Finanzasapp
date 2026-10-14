# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (PWA instalable, mobile-first; también se usa en escritorio, sobre todo el panel /admin y los reportes)

## Users

- **Emprendedor colombiano dueño de un negocio pequeño** (1–10 personas: tienda, restaurante, agencia, freelancer). No sabe contabilidad. Registra ventas y gastos desde el celular, en el momento, a veces con una mano. Quiere saber cuánta plata tiene, cuánto ganó este mes, quién le debe y a quién le debe.
- **Miembros invitados del negocio** con rol: admin, editor, contador (solo lectura y exportes) y "solo registro" (un empleado que solo anota gastos).
- **Administrador de la plataforma** (el operador del SaaS, persona natural) que revisa comprobantes de pago y gestiona clientes en /admin.

## Product Purpose

SaaS por suscripción para que el emprendedor controle el dinero de su negocio sin saber contabilidad: saldos por cuenta (Nequi, Bancolombia, efectivo), ingresos y gastos por categoría, "Me deben / Debo", cuentas de cobro en PDF, recurrentes, presupuestos y reportes (estado de resultados y flujo de caja). Éxito: el dueño entiende su situación en segundos y registra un movimiento en menos de 5 segundos.

## Positioning

Hecho para el dueño, no para el contador: lenguaje de negocio ("Me deben", no "cuentas por cobrar"), pagos y cobros con los medios que usa Colombia (Nequi, Bancolombia, llave Bre-B, WhatsApp) y sin facturación electrónica ni contabilidad formal (no compite con Siigo o Alegra; los complementa).

## Operating Context

- Uso diario en el celular, en el mostrador o en la calle; sesiones cortas y frecuentes.
- Cobro por WhatsApp (enlaces wa.me con mensaje prellenado) y documentos PDF compartidos.
- Pago de la suscripción por fuera de la app (Nequi, transferencia Bancolombia, llave Bre-B) con referencia y comprobante; aprobación manual en /admin.
- Varios negocios por dueño y equipos con roles; selector de negocio en el encabezado.
- Montos en pesos colombianos sin decimales (`$ 1.250.000`), fechas en español de Colombia, zona horaria America/Bogota.

## Capabilities and Constraints

- Next.js 16 (App Router) + Tailwind v4 + Supabase (Postgres con RLS, Auth, Storage, Edge Functions). Componentes cliente; sin librería de componentes externa; íconos lucide-react; gráficas con Recharts; toasts con sonner.
- Modo claro/oscuro (next-themes) y modo privacidad que oculta montos.
- Bloqueo biométrico local (WebAuthn).
- Permisos por rol los aplica la base de datos; la UI solo ofrece lo permitido.
- Planes: Gratis, Emprendedor (COP 24.900/mes), Negocio (59.900), Pro (129.900); límites aplicados en la base de datos.
- Sin factura electrónica DIAN; los PDF dicen "Documento sin validez como factura electrónica".
- Textos legales en borrador pendientes de revisión de abogado.

## Brand Commitments

- Nombre: **Finanzas**. Marca morada (degradado #8a05be → #560a82) con ícono de tendencia al alza; modo oscuro por defecto.
- Voz: español de Colombia, cercana y directa, tuteo, frases cortas, sin jerga contable.

## Evidence on Hand

- Datos de demostración del negocio "Tienda Demo" (seed en `supabase/seed/`).
- No hay testimonios, clientes reales, logos de prensa ni capturas de marketing: no inventarlos.

## Product Principles

1. Registrar es instantáneo: cualquier movimiento en menos de 5 segundos, con el pulgar.
2. La plata primero: el saldo real, lo que te deben y lo que debes siempre a la vista y siempre correctos (lo pendiente nunca se mezcla con lo pagado).
3. Lenguaje del dueño, no del contador.
4. Cada rol ve y hace solo lo que le corresponde, sin pantallas rotas ni botones que fallan.
5. Los datos son del cliente: exportables siempre, nunca bloqueados por el plan.

## Accessibility & Inclusion

WCAG 2.1 AA: contraste suficiente en claro y oscuro, objetivos táctiles de al menos 44 px, foco visible, etiquetas en todos los campos, y uso cómodo con una mano en pantallas de 360 px.
