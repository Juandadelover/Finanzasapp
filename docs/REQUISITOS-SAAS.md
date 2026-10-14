# Análisis de requerimientos — Finanzas SaaS para emprendedores

> Documento de análisis para evolucionar **Finanzasapp** (hoy: app personal de ingresos/gastos) a un **SaaS multi-empresa con suscripciones**, orientado a emprendedores y microempresas en Latinoamérica (foco inicial: Colombia).

---

## 1. Visión y problema

**Problema.** El emprendedor mezcla dinero personal y del negocio, no sabe cuánto gana realmente, no controla quién le debe ni a quién debe, y se entera de los impuestos cuando ya es tarde. Las herramientas contables (Siigo, Alegra, QuickBooks) están pensadas para el contador, no para el dueño del negocio.

**Propuesta de valor.** *"Sabe en 10 segundos cuánto dinero tienes, cuánto ganaste este mes y cuánto te queda para los próximos 90 días — sin saber contabilidad."*

**Principios de producto**
1. Mobile-first y registro en < 5 segundos (la base actual ya lo cumple).
2. Lenguaje de negocio, no contable ("Me deben", no "Cuentas por cobrar").
3. El contador es un invitado, no el usuario principal.
4. Datos exportables siempre: el cliente no queda secuestrado.

---

## 2. Usuarios (personas)

| Persona | Descripción | Necesidad principal | Plan probable |
|---|---|---|---|
| **Freelancer / independiente** | 1 persona, ingresos irregulares | Separar personal vs. negocio, apartar para impuestos | Gratis / Emprendedor |
| **Microempresa (1–10 personas)** | Tienda, restaurante, agencia | Flujo de caja, cuentas por cobrar/pagar, varios usuarios | Negocio |
| **Emprendedor con varios negocios** | 2+ marcas o líneas | Varios espacios de trabajo, vista consolidada | Negocio / Pro |
| **Contador externo** | Atiende 10–50 clientes | Acceso de solo lectura, exportes, cierres | Gratis como invitado (canal de adquisición) |
| **Administrador de la plataforma (tú)** | Operación del SaaS | Métricas, soporte, gestión de suscripciones | Interno |

---

## 3. Modelo de negocio y planes

Modelo **freemium + prueba gratuita de 14 días** del plan pagado, sin tarjeta para el plan gratis.

| Característica | Gratis | Emprendedor | Negocio | Pro (futuro) |
|---|---|---|---|---|
| Precio sugerido (mensual) | $0 | ~USD 7 / COP 29.900 | ~USD 19 / COP 79.900 | ~USD 39 |
| Descuento anual | — | 2 meses gratis | 2 meses gratis | 2 meses gratis |
| Espacios de trabajo (negocios) | 1 | 1 | 3 | Ilimitados |
| Usuarios por espacio | 1 | 2 | 5 | 15 |
| Movimientos / mes | 100 | Ilimitados | Ilimitados | Ilimitados |
| Cuentas (banco, efectivo, tarjeta) | 2 | 10 | Ilimitadas | Ilimitadas |
| Clientes / proveedores | 10 | Ilimitados | Ilimitados | Ilimitados |
| Cuentas por cobrar / pagar | ✗ | ✓ | ✓ | ✓ |
| Cotizaciones y cuentas de cobro | ✗ | ✓ | ✓ | ✓ |
| Factura electrónica (vía proveedor) | ✗ | ✗ | ✓ (cupo) | ✓ |
| Reportes (P&G, flujo de caja) | Básico | Completo | Completo + PDF/Excel | + Consolidado |
| Proyección de caja | 30 días | 90 días | 12 meses + escenarios | ✓ |
| Importar extractos (CSV/Excel) | ✗ | ✓ | ✓ | ✓ |
| Adjuntos (recibos) | ✗ | 500 MB | 5 GB | 20 GB |
| Acceso contador invitado | ✗ | ✓ | ✓ | ✓ |
| Asistente IA (texto/voz/foto) | ✗ | Cupo bajo | Cupo medio | Cupo alto |
| Soporte | Comunidad | Email | Prioritario | Prioritario + onboarding |

> Los límites deben vivir en **configuración (base de datos), no en código**, para poder ajustar precios sin desplegar.

---

## 4. Requerimientos funcionales

Prioridad: **M** = Must (MVP SaaS), **S** = Should, **C** = Could (posterior).

### 4.1 Cuentas de usuario y autenticación
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-AUTH-01 | Registro/login con Google y con email + enlace mágico / contraseña | M |
| RF-AUTH-02 | Verificación de email obligatoria antes de cobrar | M |
| RF-AUTH-03 | Recuperación de contraseña | M |
| RF-AUTH-04 | MFA (TOTP) opcional; obligatorio para dueños en plan Negocio+ | S |
| RF-AUTH-05 | Convertir cuenta invitado (anónima) en cuenta real sin perder datos | M |
| RF-AUTH-06 | Cerrar sesión en todos los dispositivos | S |
| RF-AUTH-07 | Bloqueo biométrico local (ya existe — mantener) | M |

### 4.2 Multi-empresa (tenancy), equipo y roles
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-ORG-01 | Un usuario puede crear y pertenecer a varios **espacios de trabajo** (negocios) | M |
| RF-ORG-02 | Selector de espacio de trabajo en el encabezado | M |
| RF-ORG-03 | Invitar miembros por email con rol | M |
| RF-ORG-04 | Roles: **Dueño** (todo + facturación), **Admin** (todo menos facturación/borrar), **Editor** (registrar movimientos), **Contador** (solo lectura + exportar), **Solo registro** (solo crear gastos, p. ej. empleado) | M (Dueño/Editor/Contador), S (resto) |
| RF-ORG-05 | Transferir la propiedad del espacio | S |
| RF-ORG-06 | Datos del negocio: razón social, NIT/RUT, régimen tributario, moneda base, país, zona horaria, logo | M |
| RF-ORG-07 | Espacio "Personal" separado del de negocio; transferencias entre ellos marcadas como "aporte/retiro del dueño" | S |

### 4.3 Cuentas financieras
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-ACC-01 | Crear cuentas: banco, efectivo/caja, tarjeta de crédito, billetera digital (Nequi, Daviplata, Mercado Pago) | M |
| RF-ACC-02 | Saldo inicial y saldo actual calculado por cuenta | M |
| RF-ACC-03 | Transferencias entre cuentas (no cuentan como ingreso ni gasto) | M |
| RF-ACC-04 | Cuentas en moneda distinta a la base con tasa de cambio por movimiento | S |
| RF-ACC-05 | Archivar cuentas sin borrar historial | M |

### 4.4 Movimientos (núcleo — evoluciona lo existente)
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-TX-01 | Registrar ingreso/gasto con cuenta, categoría, fecha, monto, descripción (existe; añadir cuenta) | M |
| RF-TX-02 | Estado: **pagado** / **pendiente** (con fecha de vencimiento) | M |
| RF-TX-03 | Vincular a cliente o proveedor | M |
| RF-TX-04 | Impuestos por movimiento: IVA (incluido / adicional), retención en la fuente, ICA | S |
| RF-TX-05 | Adjuntar foto/PDF del soporte | S |
| RF-TX-06 | Movimientos recurrentes (arriendo, nómina, software) con generación automática | M |
| RF-TX-07 | Etiquetas / centros de costo / proyectos | C |
| RF-TX-08 | Dividir un movimiento en varias categorías | C |
| RF-TX-09 | Búsqueda y filtros (existe) + filtro por cuenta, estado, cliente, rango de fechas | M |
| RF-TX-10 | Edición en lote (recategorizar, borrar) | S |
| RF-TX-11 | Historial de cambios de cada movimiento (quién, cuándo, qué) | S |
| RF-TX-12 | Bloqueo de periodos cerrados (no editar meses ya cerrados por el contador) | C |

### 4.5 Clientes, proveedores y cartera
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-CRM-01 | Directorio de clientes y proveedores (nombre, NIT/CC, email, teléfono) | M |
| RF-CRM-02 | **"Me deben"**: cuentas por cobrar con vencimiento, abonos parciales, antigüedad (0-30, 31-60, 61-90, +90) | M |
| RF-CRM-03 | **"Debo"**: cuentas por pagar con recordatorios | M |
| RF-CRM-04 | Recordatorio de cobro al cliente por email/WhatsApp (enlace) | S |
| RF-CRM-05 | Estado de cuenta por cliente (PDF) | S |

### 4.6 Ventas: cotizaciones, cuentas de cobro y facturación electrónica
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-INV-01 | Catálogo de productos/servicios con precio e impuesto | S |
| RF-INV-02 | Cotización → cuenta de cobro/factura con un clic | S |
| RF-INV-03 | **Cuenta de cobro** en PDF (para no obligados a facturar, muy común en Colombia) | M |
| RF-INV-04 | **Factura electrónica DIAN** a través de un proveedor tecnológico habilitado (Alegra, Siigo API, Facture, The Factory HKA, etc.) — **no construir el motor de facturación propio** | S (plan Negocio) |
| RF-INV-05 | Al emitir factura se crea automáticamente la cuenta por cobrar | M (si existe RF-INV-02) |
| RF-INV-06 | Enlace de pago en la factura (Wompi / Mercado Pago / PayU) | C |

### 4.7 Presupuestos, metas e impuestos
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-BUD-01 | Presupuesto mensual por categoría (existe) con alertas al 80 % y 100 % | M |
| RF-BUD-02 | Metas de ahorro / reserva (p. ej. "fondo de 3 meses de gastos fijos") | S |
| RF-TAX-01 | "Apartado para impuestos": % configurable de cada ingreso reservado virtualmente | S |
| RF-TAX-02 | Calendario tributario según NIT y régimen (IVA, renta, Régimen Simple) con recordatorios | S |
| RF-TAX-03 | Resumen de IVA generado vs. descontable del periodo | C |

### 4.8 Reportes y análisis
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-REP-01 | Dashboard: caja total, utilidad del mes, me deben, debo, proyección (evoluciona Inicio) | M |
| RF-REP-02 | **Estado de resultados (P&G)** simplificado por mes/trimestre/año | M |
| RF-REP-03 | **Flujo de caja** real vs. proyectado (incluye pendientes y recurrentes) | M |
| RF-REP-04 | Proyección a 90 días (existe) → 12 meses con escenarios | S |
| RF-REP-05 | Comparativo periodo vs. periodo anterior y vs. presupuesto | S |
| RF-REP-06 | Exportar a Excel/CSV y PDF con logo del negocio | M |
| RF-REP-07 | Indicadores: margen bruto, punto de equilibrio, días de cartera, *runway* (meses de caja) | S |
| RF-REP-08 | Vista consolidada de varios negocios | C (Pro) |

### 4.9 Bancos e importación
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-BNK-01 | Importar extractos CSV/Excel con mapeo de columnas guardable por banco | S |
| RF-BNK-02 | Detección de duplicados al importar | S |
| RF-BNK-03 | Reglas de categorización automática ("si la descripción contiene 'UBER' → Transporte") | S |
| RF-BNK-04 | Conciliación: marcar movimientos como conciliados contra el extracto | C |
| RF-BNK-05 | Conexión bancaria directa (open finance — Belvo, Prometeo) | C |

### 4.10 Asistente IA (Fase 2 del roadmap actual)
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-AI-01 | Registrar movimiento por texto natural ("pagué 45 mil de domicilio con Nequi") | S |
| RF-AI-02 | Leer foto de recibo/factura y prellenar el movimiento (OCR + extracción) | S |
| RF-AI-03 | Notas de voz | C |
| RF-AI-04 | Preguntas sobre los datos ("¿cuánto gasté en publicidad este trimestre?") | C |
| RF-AI-05 | Cupo de uso por plan, medido y visible al usuario | M (si hay IA) |

### 4.11 Notificaciones
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-NOT-01 | Email transaccional: bienvenida, invitación, recibo de pago, fallo de pago, fin de prueba | M |
| RF-NOT-02 | Push (PWA ya instalable) para vencimientos y presupuestos | S |
| RF-NOT-03 | Resumen semanal por email (caja, utilidad, vencimientos) | S |
| RF-NOT-04 | Preferencias de notificación por usuario | M |

### 4.12 Datos y portabilidad
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-DAT-01 | Exportar todos los datos del espacio (JSON/CSV) — existe en JSON, ampliar | M |
| RF-DAT-02 | Importar desde respaldo y desde otras apps (CSV genérico) | S |
| RF-DAT-03 | Borrar cuenta y datos (derecho de supresión) con periodo de gracia de 30 días | M |

---

## 5. Suscripciones y facturación del SaaS (*billing*)

Este es el módulo que convierte la app en negocio. Es crítico y **no se debe improvisar**.

### 5.1 Elección de pasarela

| Opción | Pros | Contras | Recomendación |
|---|---|---|---|
| **Stripe Billing** | Suscripciones, prorrateo, *dunning*, portal de cliente y webhooks maduros | No liquida a cuentas colombianas directamente (requiere entidad en EE. UU. vía Stripe Atlas o similar); cobra en USD | Mejor si el público es internacional o se cobra en USD |
| **Mercado Pago Suscripciones** | Fuerte en MX, AR, CO, CL; medios locales | API de suscripciones más limitada (prorrateo/cambios de plan manuales) | Buena para LATAM |
| **Wompi (Bancolombia) / PayU / ePayco** | Pesos colombianos, PSE, Nequi, tarjetas locales | Cobro recurrente más rudimentario: tokenizar tarjeta y cobrar desde nuestro backend | Opción COP-first |
| **Paddle / Lemon Squeezy** (*Merchant of Record*) | Ellos facturan y gestionan impuestos globales | Comisión más alta, menos medios locales | Si se vende globalmente sin entidad extranjera |

**Recomendación:** diseñar una **capa de abstracción de billing propia** (tablas `plans`, `subscriptions`, `entitlements` en nuestra BD) donde la pasarela sea un adaptador. Arrancar con **una sola** pasarela (Stripe si se puede tener entidad en EE. UU.; si no, Mercado Pago o Wompi para COP).

### 5.2 Requerimientos de suscripción
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-SUB-01 | La suscripción pertenece al **espacio de trabajo (o a la cuenta del dueño)**, no a cada usuario | M |
| RF-SUB-02 | Página pública de precios con mensual/anual | M |
| RF-SUB-03 | Prueba gratis de 14 días del plan pagado; al terminar baja a Gratis sin borrar datos | M |
| RF-SUB-04 | Checkout alojado por la pasarela (no tocar datos de tarjeta → alcance PCI mínimo, SAQ-A) | M |
| RF-SUB-05 | Subir de plan inmediato con prorrateo; bajar de plan al final del periodo | M |
| RF-SUB-06 | Cancelar en cualquier momento (activo hasta fin del periodo pagado) — exigido por protección al consumidor | M |
| RF-SUB-07 | Estados: `trialing`, `active`, `past_due`, `canceled`, `paused`, `incomplete` | M |
| RF-SUB-08 | *Dunning*: reintentos automáticos de cobro + emails (día 0, 3, 7); periodo de gracia de 7 días antes de degradar | M |
| RF-SUB-09 | **Webhooks idempotentes** como única fuente de verdad del estado (guardar `event_id` procesado) | M |
| RF-SUB-10 | Portal del cliente: cambiar tarjeta, ver/descargar recibos, cambiar plan | M |
| RF-SUB-11 | **Factura electrónica DIAN de lo que tú cobras** (si la empresa del SaaS está en Colombia) | M (legal) |
| RF-SUB-12 | Cupones y descuentos (lanzamiento, referidos, contadores) | S |
| RF-SUB-13 | Programa de referidos (1 mes gratis por referido que paga) | C |
| RF-SUB-14 | Precios por país / moneda (COP, MXN, USD) | S |

### 5.3 *Entitlements* (control de acceso por plan)
- Tabla `plan_limits` con claves como `max_workspaces`, `max_members`, `max_tx_per_month`, `feature.invoicing`, `feature.ai`, `ai_credits_per_month`.
- Verificación **en el servidor y en la BD** (políticas RLS / funciones Postgres o *Server Actions*), nunca solo ocultando botones en el frontend.
- Al exceder un límite: bloquear **la creación**, nunca la lectura ni la exportación de datos existentes.
- *Downgrade*: si el usuario tiene 5 miembros y baja a un plan de 2, los extra quedan en solo lectura; no se borra nada.
- Medidores de uso visibles ("78 de 100 movimientos este mes").

### 5.4 Flujo de webhooks (resumen)

```
Pasarela ──webhook──▶ /api/billing/webhook (verifica firma)
                         │
                         ├─ ¿event_id ya procesado? → 200 y salir
                         ├─ upsert subscriptions (status, plan, period_end)
                         ├─ recalcula entitlements del workspace
                         ├─ registra en billing_events (auditoría)
                         └─ dispara email transaccional si aplica
```

---

## 6. Requerimientos no funcionales

### 6.1 Seguridad
| ID | Requerimiento |
|---|---|
| RNF-SEC-01 | **Aislamiento por inquilino**: toda tabla de negocio lleva `workspace_id`; RLS basada en membresía (`is_member(workspace_id)`), con pruebas automatizadas que intenten leer datos de otro inquilino |
| RNF-SEC-02 | La `service_role` key solo en servidor (webhooks, jobs); nunca en el cliente |
| RNF-SEC-03 | Bitácora de auditoría inmutable: login, cambios de rol, borrados, exportaciones, cambios de plan |
| RNF-SEC-04 | Cifrado en tránsito (TLS) y en reposo (Supabase lo provee); datos sensibles (NIT, tokens de integraciones) cifrados a nivel de columna o en Vault |
| RNF-SEC-05 | Límite de peticiones (*rate limiting*) en login, invitaciones, IA y webhooks |
| RNF-SEC-06 | Validación de entrada en servidor (p. ej. Zod) para todas las *Server Actions*/API |
| RNF-SEC-07 | Escaneo de dependencias y revisión de seguridad en CI |
| RNF-SEC-08 | No almacenar datos de tarjeta (checkout alojado) |

### 6.2 Integridad financiera
| ID | Requerimiento |
|---|---|
| RNF-FIN-01 | Montos en `numeric(18,2)` en BD (o enteros en centavos) — **nunca `float`** en JS para sumas; usar una librería decimal o centavos enteros |
| RNF-FIN-02 | Cada movimiento guarda su moneda y, si difiere de la base, la tasa usada |
| RNF-FIN-03 | Fechas contables como `date` en la zona horaria del negocio; marcas de tiempo en UTC |
| RNF-FIN-04 | Borrado lógico (`deleted_at`) para movimientos; papelera recuperable 30 días |
| RNF-FIN-05 | Saldos calculados desde movimientos (o vistas materializadas), nunca editables a mano |

### 6.3 Rendimiento, disponibilidad y operación
| ID | Requerimiento |
|---|---|
| RNF-OPS-01 | Dashboard carga en < 2 s (p95) en 4G con 10.000 movimientos por espacio |
| RNF-OPS-02 | Disponibilidad objetivo 99,5 % mensual |
| RNF-OPS-03 | Respaldos diarios con PITR (plan Pro de Supabase); prueba de restauración trimestral |
| RNF-OPS-04 | Entornos separados: desarrollo, *staging* (con pasarela en modo prueba) y producción |
| RNF-OPS-05 | Migraciones versionadas en el repo (`supabase/migrations`) — hoy el esquema no está versionado |
| RNF-OPS-06 | Observabilidad: errores (Sentry), logs estructurados, alertas en fallos de webhooks y jobs |
| RNF-OPS-07 | Jobs programados (recurrentes, recordatorios, *dunning*, resumen semanal) con `pg_cron` o Edge Functions programadas, idempotentes |

### 6.4 Legal y cumplimiento (Colombia como base)
| ID | Requerimiento |
|---|---|
| RNF-LEG-01 | **Ley 1581 de 2012 (Habeas Data)**: política de tratamiento de datos, autorización expresa en el registro, canal para consultas/reclamos; registro en el RNBD de la SIC si aplica |
| RNF-LEG-02 | Términos y condiciones, política de privacidad, política de reembolsos y de cancelación visibles antes de pagar |
| RNF-LEG-03 | Estatuto del Consumidor (Ley 1480): información clara de precio, renovación automática y cancelación |
| RNF-LEG-04 | Facturación electrónica DIAN de los cobros de suscripción |
| RNF-LEG-05 | Si se vende a la UE: GDPR (DPA, subprocesadores listados) |
| RNF-LEG-06 | Aviso claro de que la app **no reemplaza asesoría contable/tributaria** |

### 6.5 Usabilidad
- Mobile-first, PWA instalable (ya existe), modo claro/oscuro (ya existe).
- Accesibilidad WCAG 2.1 AA.
- Onboarding guiado: crear negocio → elegir cuentas → importar o registrar 3 movimientos → ver dashboard ("momento ajá" en < 3 min).
- Internacionalización preparada (textos en archivos de traducción, formatos de moneda por *locale*).

---

## 7. Modelo de datos propuesto (alto nivel)

```
auth.users ─┐
            └─ profiles (nombre, avatar, locale)

workspaces (id, nombre, nit, regimen, pais, moneda_base, zona_horaria, logo, owner_id)
memberships (workspace_id, user_id, role, status)          ← base de toda la RLS
invitations (workspace_id, email, role, token, expires_at)

accounts (workspace_id, nombre, tipo, moneda, saldo_inicial, archivada)
categories (workspace_id, nombre, tipo, icono, color, presupuesto_mensual)   ← hoy por user_id
contacts (workspace_id, tipo[cliente|proveedor], nombre, documento, email, telefono)
transactions (workspace_id, account_id, category_id, contact_id, tipo,
              monto numeric, moneda, tasa_cambio, fecha, estado[pagado|pendiente],
              fecha_vencimiento, descripcion, recurrence_id, created_by, deleted_at)
transfers (workspace_id, from_account_id, to_account_id, monto, fecha)
recurrences (workspace_id, plantilla jsonb, frecuencia, proxima_fecha)
attachments (workspace_id, transaction_id, storage_path, mime, tamaño)
invoices / invoice_items (workspace_id, contact_id, numero, estado, cufe, total, impuestos)
products (workspace_id, nombre, precio, iva)
rules (workspace_id, condicion, categoria_destino)
audit_log (workspace_id, actor_id, accion, entidad, entidad_id, diff jsonb, created_at)

-- Billing
plans (codigo, nombre, precio_mensual, precio_anual, moneda, activo)
plan_limits (plan_codigo, clave, valor)
subscriptions (workspace_id | owner_id, plan_codigo, status, provider,
               provider_customer_id, provider_subscription_id,
               current_period_end, cancel_at_period_end, trial_end)
billing_events (provider_event_id UNIQUE, tipo, payload jsonb, procesado_at)
usage_counters (workspace_id, clave, periodo, valor)        ← tx/mes, créditos IA
```

---

## 8. Arquitectura propuesta

Mantener el stack actual — es adecuado para un SaaS de esta escala:

| Capa | Tecnología | Nota |
|---|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind v4 + PWA | Ya existe |
| Lógica de servidor | *Server Actions* / Route Handlers de Next.js | Mover escrituras sensibles del cliente al servidor |
| BD + Auth + Storage | Supabase (Postgres, RLS, Storage para adjuntos) | Pasar a plan Pro para PITR y sin pausas |
| Jobs | `pg_cron` + Supabase Edge Functions | Recurrentes, *dunning*, resúmenes |
| Pagos | Stripe / Mercado Pago / Wompi vía adaptador | Webhooks a Route Handler |
| Email | Resend (plantillas transaccionales) | |
| Factura electrónica | API de proveedor tecnológico DIAN | Solo plan Negocio |
| IA | API de Claude (extracción de recibos, texto natural) | Medido por créditos |
| Observabilidad | Sentry + logs de Vercel/Supabase | |
| Hosting | Vercel | Ya previsto |

---

## 9. Análisis de brecha: app actual → SaaS

| Área | Hoy | Necesario | Esfuerzo |
|---|---|---|---|
| Tenancy | Datos por `user_id` | `workspace_id` + `memberships` + RLS por membresía | **Alto** (migración de todas las tablas y políticas) |
| Cuentas financieras | No existen | Tabla `accounts`, saldo por cuenta, transferencias | Medio |
| Estado de movimientos | Solo realizados | Pagado / pendiente + vencimientos | Medio |
| Montos | `amount` convertido con `Number()` en JS | `numeric` en BD + aritmética en centavos/decimal | Bajo–Medio |
| Login | Google desactivado; invitado anónimo | Google + email; conversión de invitado; verificación de email | Medio |
| Esquema | Aplicado directo en Supabase, no versionado | `supabase/migrations` en el repo | Bajo |
| Lógica de datos | Toda desde el cliente (`FinanceContext`) | Escrituras críticas y límites de plan en servidor | Medio |
| Billing | No existe | Planes, suscripciones, webhooks, entitlements, portal | **Alto** |
| Reportes | Estadísticas personales | P&G, flujo de caja, exportes PDF/Excel | Medio |
| Legal | — | Términos, privacidad, Habeas Data, facturación DIAN | Medio (no técnico) |
| Pruebas | Ninguna | Pruebas de RLS, billing y cálculos financieros | Medio |

**Lo que ya se puede reutilizar:** UI mobile-first, categorías con presupuestos, estadísticas y proyección, filtros de movimientos, tema claro/oscuro, privacidad de montos, bloqueo biométrico, PWA, exportar/importar JSON.

---

## 10. Métricas del SaaS (para instrumentar desde el día 1)

- **Adquisición:** visitas → registros (conversión de la página de precios).
- **Activación:** % de registros que crean negocio + 5 movimientos en 7 días.
- **Conversión:** prueba → pago (meta 15–25 %), gratis → pago (meta 3–5 %).
- **Ingresos:** MRR, ARR, ARPA, expansión (upgrades).
- **Retención:** churn mensual de logos e ingresos (meta < 5 % logos), retención de cohortes.
- **Salud:** NPS, tickets de soporte por cliente, pagos fallidos recuperados por *dunning*.

Panel interno de administración (RF-ADM): buscar cliente, ver plan/estado, extender prueba, aplicar cupón, impersonar en modo lectura (con registro en auditoría).

---

## 11. Roadmap sugerido

| Fase | Duración estimada* | Alcance |
|---|---|---|
| **0. Fundaciones** | 2–3 semanas | Migraciones versionadas, `workspaces` + `memberships` + RLS nueva, migración de datos existentes, login Google/email, pruebas de aislamiento |
| **1. MVP negocio** | 4–6 semanas | Cuentas, pendientes/vencimientos, clientes/proveedores, "Me deben / Debo", recurrentes, dashboard de negocio, P&G y flujo de caja, exporte Excel/PDF |
| **2. Monetización** | 3–4 semanas | Planes, checkout, webhooks, entitlements, prueba de 14 días, *dunning*, portal, emails, página de precios, legales → **lanzamiento beta pagada** |
| **3. Equipo y contador** | 2–3 semanas | Invitaciones, roles, acceso contador, auditoría |
| **4. Productividad** | 4–6 semanas | Importar extractos, reglas, adjuntos, cuentas de cobro PDF, calendario tributario, notificaciones push |
| **5. Diferenciación** | continuo | Asistente IA, factura electrónica DIAN, conexión bancaria, multi-moneda, consolidado |

\* Estimaciones para 1–2 desarrolladores full-stack.

**MVP mínimo vendible** = Fases 0 + 1 + 2.

---

## 12. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Fuga de datos entre inquilinos por error en RLS | Crítico | Pruebas automatizadas de RLS en CI; revisión de cada política nueva |
| Estado de suscripción desincronizado con la pasarela | Alto | Webhooks idempotentes + job diario de reconciliación |
| Pasarela no disponible para la entidad legal del negocio | Alto | Validar elegibilidad **antes** de construir; capa de adaptador |
| Competir con Alegra/Siigo en contabilidad formal | Medio | Posicionarse en gestión para el dueño, integrar (no reemplazar) facturación |
| Errores de redondeo en montos | Medio | Decimal/centavos + pruebas de cálculo |
| Obligaciones tributarias cambiantes | Medio | Reglas tributarias como configuración, no código |

---

## 13. Preguntas abiertas (decisiones de negocio)

1. **¿País y moneda de lanzamiento?** ¿Solo Colombia (COP) o LATAM desde el inicio? Define pasarela, impuestos y facturación.
2. **¿Existe ya una entidad legal** (SAS en Colombia / LLC en EE. UU.)? Define si Stripe es viable.
3. **¿La suscripción se cobra por espacio de trabajo o por usuario dueño?** (Recomendado: por dueño, con N espacios según plan.)
4. **¿La factura electrónica DIAN entra en el MVP** o se deja para después? (Recomendado: después; cuentas de cobro PDF primero.)
5. **¿Los usuarios actuales de la app personal** se migran a un espacio "Personal" gratis o se mantiene una app separada?
6. **¿El contador es un canal de venta?** (Plan especial para contadores que gestionan varios clientes.)
7. **¿Presupuesto mensual de infraestructura?** (Supabase Pro + Vercel Pro + Resend + Sentry ≈ USD 70–100/mes al inicio.)
