# Análisis de requerimientos — Finanzas SaaS para emprendedores

> Documento de análisis para evolucionar **Finanzasapp** (hoy: app personal de ingresos/gastos) a un **SaaS con suscripciones para emprendedores en Colombia**.

## Decisiones tomadas

| # | Decisión | Consecuencia en el diseño |
|---|---|---|
| D1 | **Lanzamiento solo en Colombia** | Precios en COP; cobro en pesos por medios locales (Nequi, transferencia, Bre-B); cumplimiento colombiano (Ley 1581, Estatuto del Consumidor); un solo idioma (es-CO) y una zona horaria por defecto (America/Bogota). Multi-moneda queda como "Could". |
| D2 | **Se cobra por dueño** | La suscripción pertenece al usuario dueño; su plan define cuántos negocios puede crear y cuántos miembros invitar en cada uno. Los miembros invitados no pagan. |
| D3 | **Sin facturación electrónica en el producto** | El público son emprendedores que necesitan controlar su plata, no un software contable. Se ofrecen **cotizaciones y cuentas de cobro en PDF** (sin valor fiscal) y el control de "Me deben". Quien deba facturar electrónicamente usa el sistema gratuito de la DIAN u otro proveedor, y registra aquí el cobro. |
| D4 | **Sin pasarela de pagos al inicio** | El cliente paga por fuera (Nequi, transferencia, llave Bre-B) y sube el comprobante; tú apruebas en un panel `/admin` y la app activa el plan y controla vencimientos. Ver sección 5. |
| D5 | **Se cobra como persona natural** | Los pagos llegan a cuentas a tu nombre. Mientras seas **no responsable de IVA** (ingresos brutos anuales < 3.500 UVT y demás requisitos del art. 437 E.T.), los precios **no llevan IVA** y en general no estás obligado a facturar electrónicamente; basta con el recibo de pago de la app. Debes declarar renta si superas los topes del año. Al pasar los topes, cambian estas reglas: confírmalo con un contador. |
| D6 | **Medios de pago: Nequi, Bancolombia y llave Bre-B** | Son los únicos medios en "Cómo pagar". Los números, titular y llave los configuras tú en el panel `/admin`; no van en el código. |
| D7 | **Borrar los usuarios actuales y sembrar usuarios de prueba por rol** | Los usuarios y datos de la app personal se eliminan (no se migran). En desarrollo/staging se crea un usuario de prueba por rol (ver sección 5.6). |

> Nota: D3 aplica al **producto**. Para tus propios cobros, ver D5: como persona natural no responsable de IVA no deberías necesitar factura electrónica; si algún día pasas los topes, se emite por fuera de la app (p. ej. facturador gratuito DIAN), usando el export de pagos del panel admin (RF-ADM-09).

---

## 1. Visión y problema

**Problema.** El emprendedor mezcla dinero personal y del negocio, no sabe cuánto gana realmente, no controla quién le debe ni a quién debe, y se entera de los impuestos cuando ya es tarde. Las herramientas contables (Siigo, Alegra, QuickBooks) están pensadas para el contador, no para el dueño del negocio.

**Lo que NO es:** un software contable ni de facturación electrónica. No compite con Siigo o Alegra; los complementa.

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
| Precio sugerido (mensual, sin IVA — D5) | $0 | COP 24.900 | COP 59.900 | COP 129.900 |
| Descuento anual | — | 2 meses gratis | 2 meses gratis | 2 meses gratis |
| Negocios (del dueño) | 1 | 1 | 3 | 10 |
| Usuarios por espacio | 1 | 2 | 5 | 15 |
| Movimientos / mes | 100 | Ilimitados | Ilimitados | Ilimitados |
| Cuentas (banco, efectivo, tarjeta) | 2 | 10 | Ilimitadas | Ilimitadas |
| Clientes / proveedores | 10 | Ilimitados | Ilimitados | Ilimitados |
| Cuentas por cobrar / pagar | ✗ | ✓ | ✓ | ✓ |
| Cotizaciones y cuentas de cobro (PDF) | 3 / mes | ✓ | ✓ con logo | ✓ con logo |
| Reportes (P&G, flujo de caja) | Básico | Completo | Completo + PDF/Excel | + Consolidado |
| Proyección de caja | 30 días | 90 días | 12 meses + escenarios | ✓ |
| Importar extractos (CSV/Excel) | ✗ | ✓ | ✓ | ✓ |
| Adjuntos (recibos) | ✗ | 500 MB | 5 GB | 20 GB |
| Acceso contador invitado | ✗ | ✓ | ✓ | ✓ |
| Alertas de vencimiento por WhatsApp | ✗ | ✗ | ✓ | ✓ |
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
| RF-ORG-06 | Datos del negocio: nombre comercial, NIT o cédula (opcional), régimen (Simple / Ordinario / No responsable de IVA), logo. Moneda COP y zona horaria America/Bogota por defecto | M |
| RF-ORG-07 | Espacio "Personal" separado del de negocio; transferencias entre ellos marcadas como "aporte/retiro del dueño" | S |

### 4.3 Cuentas financieras
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-ACC-01 | Crear cuentas: banco, efectivo/caja, tarjeta de crédito, billetera digital (Nequi, Daviplata, Dale!, Mercado Pago) | M |
| RF-ACC-02 | Saldo inicial y saldo actual calculado por cuenta | M |
| RF-ACC-03 | Transferencias entre cuentas (no cuentan como ingreso ni gasto) | M |
| RF-ACC-04 | Cuentas en USD (freelancers que cobran al exterior) con tasa de cambio por movimiento | C |
| RF-ACC-05 | Archivar cuentas sin borrar historial | M |

### 4.4 Movimientos (núcleo — evoluciona lo existente)
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-TX-01 | Registrar ingreso/gasto con cuenta, categoría, fecha, monto, descripción (existe; añadir cuenta) | M |
| RF-TX-02 | Estado: **pagado** / **pendiente** (con fecha de vencimiento) | M |
| RF-TX-03 | Vincular a cliente o proveedor | M |
| RF-TX-04 | Marcar impuestos informativos por movimiento: IVA incluido, retención en la fuente que te practicaron (útil para la declaración de renta) | C |
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
| RF-CRM-04 | Recordatorio de cobro al cliente: botón que abre WhatsApp con mensaje prellenado y el PDF de la cuenta de cobro | M |
| RF-CRM-05 | Estado de cuenta por cliente (PDF) | S |

### 4.6 Ventas: cotizaciones y cuentas de cobro (sin facturación electrónica — D3)
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-INV-01 | Catálogo simple de productos/servicios con precio | S |
| RF-INV-02 | Cotización en PDF con logo, compartible por WhatsApp/email; convertir a cuenta de cobro con un clic | S |
| RF-INV-03 | **Cuenta de cobro** en PDF (formato colombiano para personas no obligadas a facturar) con numeración consecutiva | M |
| RF-INV-04 | Al emitir una cuenta de cobro se crea automáticamente el pendiente en "Me deben"; al registrar el pago se marca como cobrada | M |
| RF-INV-05 | Campo opcional "N.º de factura externa" para quien factura en la DIAN u otro sistema y solo quiere hacer seguimiento del cobro | S |
| RF-INV-06 | Leyenda visible en los PDF: "Documento sin validez como factura electrónica" | M |
| RF-INV-07 | Enlace de pago en la cuenta de cobro (llave Bre-B / Nequi / link de pago) | C |
| — | **Fuera de alcance:** emisión de factura electrónica DIAN, CUFE, notas crédito/débito, nómina electrónica, contabilidad por PUC | — |

### 4.7 Presupuestos, metas e impuestos
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-BUD-01 | Presupuesto mensual por categoría (existe) con alertas al 80 % y 100 % | M |
| RF-BUD-02 | Metas de ahorro / reserva (p. ej. "fondo de 3 meses de gastos fijos") | S |
| RF-TAX-01 | "Apartado para impuestos": % configurable de cada ingreso reservado virtualmente | S |
| RF-TAX-02 | Calendario tributario según los dos últimos dígitos del NIT y el régimen (renta, Régimen Simple, IVA) con recordatorios — solo fechas, no declaraciones | S |
| RF-TAX-03 | Alerta de topes: "tus ingresos del año se acercan al tope para ser responsable de IVA / declarar renta" (valores en UVT configurables) | S |

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
| RF-BNK-01 | Importar extractos CSV/Excel con plantillas predefinidas para Bancolombia, Davivienda, BBVA, Banco de Bogotá y Nequi, y mapeo manual para los demás | S |
| RF-BNK-02 | Detección de duplicados al importar | S |
| RF-BNK-03 | Reglas de categorización automática ("si la descripción contiene 'UBER' → Transporte") | S |
| RF-BNK-04 | Conciliación: marcar movimientos como conciliados contra el extracto | C |
| RF-BNK-05 | Conexión bancaria directa (finanzas abiertas en Colombia — Belvo, Prometeo) | C |

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

## 5. Suscripciones y cobro del SaaS (*billing*) — pagos manuales (D4)

Al inicio **no hay pasarela de pagos**: el emprendedor paga por fuera de la app por **Nequi, transferencia a Bancolombia o llave Bre-B** (D6) y tú activas su plan desde un panel de administración. Esto permite lanzar y validar precios sin afiliarse a una pasarela, a cambio de trabajo operativo manual que es manejable hasta unos ~100–200 clientes pagos.

La clave es que **la app sí lleva el control de la suscripción** (plan, estado, fecha de vencimiento, límites), aunque el dinero no pase por ella. Así, cuando se integre una pasarela, solo cambia *cómo se registra el pago*, no el resto del sistema.

### 5.1 Flujo de pago manual

```
 Emprendedor (app)                          Tú (panel /admin)
 ─────────────────                          ─────────────────
 1. Elige plan y ciclo (mensual/anual)
 2. Ve "Cómo pagar": monto exacto,
    Nequi / Bancolombia / llave Bre-B y una
    REFERENCIA única (ej. FZ-7K3Q)
 3. Paga por fuera (Nequi, Bancolombia, Bre-B)
 4. Sube el comprobante (foto/PDF)  ─────▶  5. Ve la solicitud "En revisión"
    Estado: "En revisión"                      con comprobante, monto y referencia
    (acceso provisional 48 h)               6. Verifica contra su extracto/Nequi
                                            7. Aprueba → plan activo hasta fecha X
 8. Recibe email "Pago confirmado"   ◀─────     o Rechaza con motivo
    + recibo PDF                                (monto incorrecto, no llegó, etc.)

 Antes del vencimiento: recordatorios día −7, −3 y −1 con los datos de pago.
 Vencido sin pago: 5 días de gracia → baja automática a Gratis (sin borrar datos).
```

### 5.2 Requerimientos de suscripción
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-SUB-01 | La suscripción pertenece al **usuario dueño** (D2); todos los negocios que crea heredan su plan; los miembros invitados no pagan | M |
| RF-SUB-02 | Página pública de precios con mensual/anual | M |
| RF-SUB-03 | Prueba gratis de 14 días del plan pagado, sin pedir pago; al terminar baja a Gratis sin borrar datos | M |
| RF-SUB-04 | Pantalla **"Cómo pagar"**: monto exacto, medios de pago **Nequi, Bancolombia y llave Bre-B** (D6), con los datos que configuras en `/admin` y **referencia única** por solicitud para identificar el pago | M |
| RF-SUB-05 | **Subir comprobante** (imagen/PDF, máx. 5 MB) y crear una solicitud de pago en estado `en_revision`; botón alternativo "Enviar por WhatsApp" con mensaje prellenado (referencia + monto) | M |
| RF-SUB-06 | Acceso provisional al plan pagado por 48 h tras subir el comprobante, una vez por periodo (reduce fricción mientras revisas) | S |
| RF-SUB-07 | Estados de suscripción: `trial`, `active`, `pending_review`, `grace` (vencida, en gracia), `expired` (bajó a Gratis), `canceled` | M |
| RF-SUB-08 | Recordatorios de renovación por email (y enlace de WhatsApp) los días −7, −3 y −1, y aviso al entrar en gracia | M |
| RF-SUB-09 | Job diario que vence suscripciones, pasa a `grace` y luego a `expired`; idempotente | M |
| RF-SUB-10 | Página **"Mi suscripción"**: plan actual, fecha de vencimiento, historial de pagos con comprobantes y recibos, cambiar de plan, cancelar renovación | M |
| RF-SUB-11 | Recibo de pago en PDF (no es factura electrónica — ver nota en D3) | M |
| RF-SUB-12 | Subir de plan: la app calcula la diferencia proporcional a pagar por los días restantes; bajar de plan: aplica al siguiente vencimiento | S |
| RF-SUB-13 | Cupones / descuentos (lanzamiento, referidos, incubadoras) aplicados al monto mostrado | S |
| RF-SUB-14 | Precios en COP **sin IVA** (persona natural no responsable — D5); el recibo indica "No responsable de IVA". Si cambia el régimen, el IVA se activa por configuración | M |
| RF-SUB-15 | Plan anual con descuento destacado (menos renovaciones manuales para ti y menos fricción para el cliente) | M |

### 5.3 Panel de administración (operación del cobro)
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-ADM-01 | Ruta `/admin` solo para administradores de la plataforma (tabla `platform_admins`, verificado en servidor y RLS) | M |
| RF-ADM-02 | Bandeja de **pagos en revisión**: comprobante, monto esperado vs. declarado, referencia, dueño, plan; acciones **Aprobar** / **Rechazar con motivo** | M |
| RF-ADM-03 | Al aprobar: extiende `current_period_end` (1 o 12 meses desde el vencimiento anterior, o desde hoy si ya expiró), registra el pago y envía confirmación + recibo | M |
| RF-ADM-04 | Buscar clientes; ver plan, estado, vencimiento e historial; activar/extender manualmente (cortesías, soporte) con motivo obligatorio | M |
| RF-ADM-05 | Configurar los datos de los tres medios (número Nequi, cuenta Bancolombia y tipo, llave Bre-B, titular), activarlos/desactivarlos y cambiar precios sin desplegar | M |
| RF-ADM-06 | Alerta (email/push) cuando entra un comprobante nuevo | S |
| RF-ADM-07 | Detección de comprobantes duplicados (mismo archivo/hash o misma referencia usada dos veces) | S |
| RF-ADM-08 | Métricas: MRR, clientes pagos por plan, vencimientos próximos, pagos pendientes de revisión | S |
| RF-ADM-09 | Exportar pagos del mes y del año (CSV) para tu declaración de renta y para vigilar el tope de 3.500 UVT (D5) | M |
| RF-ADM-11 | Alerta cuando los ingresos acumulados del año se acerquen al tope de no responsable de IVA (p. ej. al 80 %) | S |
| RF-ADM-10 | Toda acción del admin queda en `audit_log` | M |

### 5.4 Control de acceso por plan (*entitlements*)
- Tabla `plan_limits` con claves como `max_workspaces_owned`, `max_members`, `max_tx_per_month`, `feature.collection_docs`, `feature.ai`, `ai_credits_per_month`.
- El plan efectivo se calcula de la suscripción: `active`, `trial`, `grace` y `pending_review` (dentro de las 48 h) → plan pagado; el resto → Gratis.
- Verificación **en el servidor y en la BD** (funciones Postgres / *Server Actions*), nunca solo ocultando botones.
- Al exceder un límite: bloquear **la creación**, nunca la lectura ni la exportación.
- Al bajar a Gratis: los negocios y miembros extra quedan en solo lectura; no se borra nada.
- Medidores de uso visibles ("78 de 100 movimientos este mes").

### 5.5 Preparado para una pasarela después
- `payments.method` admite `manual` hoy y `wompi` / `mercadopago` mañana; la suscripción, los estados y los límites no cambian.
- Cuándo integrarla: cuando revisar comprobantes tome más de ~30 min/día, o cuando muchas no renovaciones sean por "se me olvidó pagar". Opciones para Colombia: **Wompi** (tarjeta, PSE, Nequi; tokenización para cobro recurrente) o **Mercado Pago** (suscripciones nativas). Stripe no aplica sin una entidad en el exterior.
- Paso intermedio sin integración técnica: **links de pago** (Wompi, Bold, Nequi Negocios) generados a mano y pegados en "Cómo pagar".

### 5.6 Limpieza de datos y usuarios de prueba (D7)

**Limpieza (una sola vez, en la Fase 0):** se borran todos los usuarios de `auth.users` del proyecto actual y sus datos (`profiles`, `user_settings`, `categories`, `transactions`), antes de aplicar el esquema multi-negocio. No se migra nada. Antes de borrar, se exporta un respaldo por si acaso.

**Usuarios de prueba por rol** — creados por un script de *seed* que solo corre en desarrollo/staging y se niega a correr si detecta el proyecto de producción:

| Usuario (email de prueba) | Rol | Escenario que permite probar |
|---|---|---|
| `admin@finanzasapp.test` | Administrador de la plataforma | Panel `/admin`: aprobar/rechazar comprobantes, configurar medios de pago y precios |
| `dueno@finanzasapp.test` | **Dueño** del negocio "Tienda Demo" (plan Negocio activo) | Todo, incluida "Mi suscripción" e invitar miembros |
| `adminnegocio@finanzasapp.test` | **Admin** en "Tienda Demo" | Todo menos suscripción y borrar el negocio |
| `editor@finanzasapp.test` | **Editor** en "Tienda Demo" | Registrar y editar movimientos, clientes, cuentas de cobro |
| `contador@finanzasapp.test` | **Contador** en "Tienda Demo" | Solo lectura + exportar reportes |
| `registro@finanzasapp.test` | **Solo registro** en "Tienda Demo" | Solo crear gastos (empleado) |
| `gratis@finanzasapp.test` | Dueño en plan **Gratis** | Probar límites (100 movimientos, 1 negocio) y el flujo de pago manual con un comprobante "en revisión" |

- Las contraseñas no van en el repositorio: se leen de una variable de entorno (`DEV_SEED_PASSWORD`) en `.env.local`.
- El seed crea también datos de ejemplo en "Tienda Demo": cuentas (Nequi, Bancolombia, Caja), categorías por defecto, ~3 meses de movimientos, 2 clientes con saldo pendiente y 1 proveedor.
- El script es idempotente: se puede volver a correr para reiniciar el entorno de pruebas.

---

## 6. Requerimientos no funcionales

### 6.1 Seguridad
| ID | Requerimiento |
|---|---|
| RNF-SEC-01 | **Aislamiento por inquilino**: toda tabla de negocio lleva `workspace_id`; RLS basada en membresía (`is_member(workspace_id)`), con pruebas automatizadas que intenten leer datos de otro inquilino |
| RNF-SEC-02 | La `service_role` key solo en servidor (panel admin, jobs); nunca en el cliente |
| RNF-SEC-03 | Bitácora de auditoría inmutable: login, cambios de rol, borrados, exportaciones, cambios de plan |
| RNF-SEC-04 | Cifrado en tránsito (TLS) y en reposo (Supabase lo provee); datos sensibles (NIT, tokens de integraciones) cifrados a nivel de columna o en Vault |
| RNF-SEC-05 | Límite de peticiones (*rate limiting*) en login, invitaciones, IA y subida de comprobantes |
| RNF-SEC-06 | Validación de entrada en servidor (p. ej. Zod) para todas las *Server Actions*/API |
| RNF-SEC-07 | Escaneo de dependencias y revisión de seguridad en CI |
| RNF-SEC-08 | Comprobantes de pago en bucket privado con URLs firmadas de corta duración; solo visibles para el dueño y los admins |

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
| RNF-OPS-04 | Entornos separados: desarrollo, *staging* y producción |
| RNF-OPS-05 | Migraciones versionadas en el repo (`supabase/migrations`) — hoy el esquema no está versionado |
| RNF-OPS-06 | Observabilidad: errores (Sentry), logs estructurados, alertas en fallos de jobs |
| RNF-OPS-07 | Jobs programados (recurrentes, vencimientos, recordatorios, resumen semanal) con `pg_cron` o Edge Functions programadas, idempotentes |

### 6.4 Legal y cumplimiento (Colombia como base)
| ID | Requerimiento |
|---|---|
| RNF-LEG-01 | **Ley 1581 de 2012 (Habeas Data)**: política de tratamiento de datos, autorización expresa en el registro, canal para consultas/reclamos; registro en el RNBD de la SIC si aplica |
| RNF-LEG-02 | Términos y condiciones, política de privacidad, política de reembolsos y de cancelación visibles antes de pagar |
| RNF-LEG-03 | Estatuto del Consumidor (Ley 1480): información clara de precio, renovación automática y cancelación |
| RNF-LEG-04 | Facturación electrónica del operador por los cobros de suscripción (fuera de la app, ver D3) |
| RNF-LEG-05 | Transferencia internacional de datos: Supabase (región sa-east-1, Brasil) y Vercel almacenan datos fuera de Colombia → declararlo en la política de tratamiento |
| RNF-LEG-06 | Aviso claro de que la app **no reemplaza asesoría contable/tributaria** |

### 6.5 Usabilidad
- Mobile-first, PWA instalable (ya existe), modo claro/oscuro (ya existe).
- Accesibilidad WCAG 2.1 AA.
- Onboarding guiado: crear negocio → elegir cuentas → importar o registrar 3 movimientos → ver dashboard ("momento ajá" en < 3 min).
- Un solo idioma (es-CO), pesos sin decimales en pantalla (`$ 1.250.000`), fechas `dd/mm/aaaa`. Textos en archivos separados por si luego se expande a otros países.

---

## 7. Modelo de datos propuesto (alto nivel)

```
auth.users ─┐
            └─ profiles (nombre, avatar, locale)

workspaces (id, nombre, documento, regimen, logo, owner_id)   -- COP y America/Bogota fijos en MVP
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
documents / document_items (workspace_id, contact_id, tipo[cotizacion|cuenta_cobro],
              consecutivo, estado, total, factura_externa, transaction_id)
products (workspace_id, nombre, precio)
rules (workspace_id, condicion, categoria_destino)
audit_log (workspace_id, actor_id, accion, entidad, entidad_id, diff jsonb, created_at)

-- Billing
plans (codigo, nombre, precio_mensual, precio_anual, moneda, activo)
plan_limits (plan_codigo, clave, valor)
subscriptions (owner_id UNIQUE, plan_codigo, ciclo[mensual|anual], status,
               current_period_end, grace_until, provisional_until,
               cancel_at_period_end, trial_end)
payments (subscription_id, plan_codigo, ciclo, monto_esperado, monto_declarado,
          referencia UNIQUE, method[manual|wompi|...], status[en_revision|aprobado|rechazado],
          comprobante_path, comprobante_hash, motivo_rechazo,
          reviewed_by, reviewed_at, provider_transaction_id NULL)
payment_methods_config (tipo[nequi|bancolombia|breb], titular, valor, detalle, activo)
platform_admins (user_id)
usage_counters (owner_id | workspace_id, clave, periodo, valor)   ← tx/mes, créditos IA
```

---

## 8. Arquitectura propuesta

Mantener el stack actual — es adecuado para un SaaS de esta escala:

| Capa | Tecnología | Nota |
|---|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind v4 + PWA | Ya existe |
| Lógica de servidor | *Server Actions* / Route Handlers de Next.js | Mover escrituras sensibles del cliente al servidor |
| BD + Auth + Storage | Supabase (Postgres, RLS, Storage para adjuntos) | Pasar a plan Pro para PITR y sin pausas |
| Jobs | `pg_cron` + Supabase Edge Functions | Recurrentes, vencimientos de suscripción, recordatorios, resúmenes |
| Pagos | Manual: comprobante en Supabase Storage (bucket privado) + aprobación en `/admin` | Pasarela (Wompi/Mercado Pago) en una fase posterior |
| Email / WhatsApp | Resend (emails transaccionales); enlaces `wa.me` en MVP, WhatsApp Business API después | |
| IA | API de Claude (extracción de recibos, texto natural) | Medido por créditos |
| Observabilidad | Sentry + logs de Vercel/Supabase | |
| Hosting | Vercel | Ya previsto |

---

## 9. Análisis de brecha: app actual → SaaS

| Área | Hoy | Necesario | Esfuerzo |
|---|---|---|---|
| Tenancy | Datos por `user_id` | `workspace_id` + `memberships` + RLS por membresía | Medio–Alto (se reescriben tablas y políticas; sin migrar datos gracias a D7) |
| Cuentas financieras | No existen | Tabla `accounts`, saldo por cuenta, transferencias | Medio |
| Estado de movimientos | Solo realizados | Pagado / pendiente + vencimientos | Medio |
| Montos | `amount` convertido con `Number()` en JS | `numeric` en BD + aritmética en centavos/decimal | Bajo–Medio |
| Login | Google desactivado; invitado anónimo | Google + email; conversión de invitado; verificación de email | Medio |
| Esquema | Aplicado directo en Supabase, no versionado | `supabase/migrations` en el repo | Bajo |
| Lógica de datos | Toda desde el cliente (`FinanceContext`) | Escrituras críticas y límites de plan en servidor | Medio |
| Billing | No existe | Planes, suscripciones por dueño, pagos manuales con comprobante, panel admin, vencimientos, límites de plan | Medio |
| Reportes | Estadísticas personales | P&G, flujo de caja, exportes PDF/Excel | Medio |
| Legal | — | Términos, privacidad, Habeas Data, reembolsos | Medio (no técnico) |
| Pruebas | Ninguna | Pruebas de RLS, billing y cálculos financieros | Medio |

**Lo que ya se puede reutilizar:** UI mobile-first, categorías con presupuestos, estadísticas y proyección, filtros de movimientos, tema claro/oscuro, privacidad de montos, bloqueo biométrico, PWA, exportar/importar JSON.

---

## 10. Métricas del SaaS (para instrumentar desde el día 1)

- **Adquisición:** visitas → registros (conversión de la página de precios).
- **Activación:** % de registros que crean negocio + 5 movimientos en 7 días.
- **Conversión:** prueba → pago (meta 15–25 %), gratis → pago (meta 3–5 %).
- **Ingresos:** MRR, ARR, ARPA, expansión (upgrades).
- **Retención:** churn mensual de logos e ingresos (meta < 5 % logos), retención de cohortes.
- **Salud:** NPS, tickets de soporte por cliente, renovaciones a tiempo vs. en gracia vs. vencidas, tiempo medio de revisión de comprobantes.

El panel interno de administración está especificado en la sección 5.3 (RF-ADM).

---

## 11. Roadmap sugerido

| Fase | Duración estimada* | Alcance |
|---|---|---|
| **0. Fundaciones** | 2–3 semanas | Respaldo y borrado de usuarios/datos actuales (D7), migraciones versionadas, `workspaces` + `memberships` + RLS nueva, login Google/email, seed de usuarios de prueba por rol, pruebas de aislamiento |
| **1. MVP negocio** | 4–6 semanas | Cuentas, pendientes/vencimientos, clientes/proveedores, "Me deben / Debo", cuentas de cobro PDF + recordatorio por WhatsApp, recurrentes, dashboard de negocio, P&G y flujo de caja, exporte Excel/PDF |
| **2. Monetización** | 2–3 semanas | Planes, límites de plan, prueba de 14 días, "Cómo pagar" + subida de comprobante, panel `/admin` de aprobación, job de vencimientos, recordatorios, "Mi suscripción", página de precios, legales → **lanzamiento beta pagada** |
| **3. Equipo y contador** | 2–3 semanas | Invitaciones, roles, acceso contador, auditoría |
| **4. Productividad** | 4–6 semanas | Importar extractos de bancos colombianos, reglas, adjuntos, cotizaciones, calendario tributario y topes UVT, notificaciones push |
| **5. Pasarela y diferenciación** | continuo | Integrar Wompi o Mercado Pago (cobro automático) cuando el volumen lo pida; asistente IA (registro por WhatsApp/voz/foto), conexión bancaria, cuentas en USD, consolidado |

\* Estimaciones para 1–2 desarrolladores full-stack.

**MVP mínimo vendible** = Fases 0 + 1 + 2.

---

## 12. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Fuga de datos entre inquilinos por error en RLS | Crítico | Pruebas automatizadas de RLS en CI; revisión de cada política nueva |
| Clientes que olvidan renovar (churn involuntario) | Alto | Recordatorios −7/−3/−1, periodo de gracia, plan anual, enlace de WhatsApp con los datos de pago |
| Comprobantes falsos o editados | Medio | Verificar siempre contra tu extracto antes de aprobar; acceso provisional limitado a 48 h y una vez por periodo; detección de duplicados |
| La revisión manual no escala | Medio | Plan anual incentivado; alerta de comprobantes nuevos; integrar pasarela al superar ~30 min/día de revisión |
| Clientes que piden factura electrónica y se van a Alegra/Siigo | Medio | Mensaje claro de posicionamiento (D3); campo de factura externa; evaluar integración solo si la demanda lo justifica |
| Errores de redondeo en montos | Medio | Decimal/centavos + pruebas de cálculo |
| Obligaciones tributarias cambiantes | Medio | Reglas tributarias como configuración, no código |

---

## 13. Preguntas abiertas

Resueltas: país (Colombia — D1), modelo de cobro (por dueño — D2), facturación electrónica (fuera del producto — D3), pagos manuales sin pasarela (D4).

Resueltas también: cobro como persona natural (D5), medios de pago Nequi / Bancolombia / Bre-B (D6), borrar usuarios actuales y crear usuarios de prueba por rol (D7).

Pendientes:
1. **¿El contador es un canal de venta?** (p. ej. cupón o plan gratis para contadores que recomiendan la app a sus clientes.)
2. **Validar precios** (COP 24.900 / 59.900) con 10–15 entrevistas a emprendedores antes de fijarlos.
3. **¿Presupuesto mensual de infraestructura?** (Supabase Pro + Vercel Pro + Resend + Sentry ≈ USD 70–100/mes al inicio.)
4. **Acceso al proyecto de Supabase** "Finanzasapp" desde la integración de Claude, para ejecutar la limpieza y el seed (hoy la integración solo ve otro proyecto).
