# Costo y rentabilidad de las funciones con IA

Fecha: 15 de octubre de 2026. Son estimaciones previas a cualquier implementación. Antes de fijar límites por plan hay que **medirlas con un piloto** de unos 50 recibos y 50 notas de voz reales, registrando `usage` (los tokens reales) de cada llamada.

## Supuestos

- **Tasa de cambio:** 1 USD = 4.000 COP (supuesto redondo; ajústalo a la TRM del día).
- **Precios de Claude** (API de Anthropic, tabla vigente al 6 de octubre de 2026), en USD por millón de tokens:

| Modelo | Entrada | Salida | Uso sugerido |
|---|---|---|---|
| Claude Haiku 5.5 | 0,10 | 0,50 | Modelo por defecto: leer recibos, entender notas de voz, resúmenes |
| Claude Sonnet 5.5 | 2,00 | 10,00 | Solo como respaldo cuando Haiku no logra leer bien |

  - Los precios de Haiku 5.5 aplican a prompts de hasta 100.000 tokens (los nuestros son de 1.000 a 5.000).
  - La **API de lotes (Batch)** cuesta 50 % menos. Sirve para el resumen semanal, que no es urgente.
  - El **caché de prompts** cobra las lecturas a cerca del 10 % del precio de entrada. Sirve para el prompt fijo con las instrucciones y las categorías del negocio.
- **Una foto de recibo** reducida a unos 1.100 × 1.450 px ocupa unos 1.800 tokens (fórmula aproximada: ancho × alto / 750).
- **Claude no transcribe audio.** La nota de voz necesita un servicio de voz a texto:
  - gpt-4o-mini-transcribe: unos USD 0,003 por minuto.
  - Deepgram: entre USD 0,0043 y 0,0077 por minuto.
  - Dictado del navegador o del teclado del celular: gratis y ocurre en el dispositivo.
- Los **tokens de salida** incluyen algo de razonamiento interno del modelo. Con `effort: "low"` se mantienen bajos.

## Costo por operación

| Operación | Tokens aprox. (entrada / salida) | Con Haiku 5.5 | Con Sonnet 5.5 |
|---|---|---|---|
| Leer foto de recibo (monto, fecha, proveedor, categoría) | 2.500 / 300 | USD 0,0004 ≈ **$ 1,6** | USD 0,008 ≈ $ 32 |
| Nota de voz de 15 s → movimiento (voz a texto + interpretación) | 800 / 200 + 15 s de audio | USD 0,0009 ≈ **$ 3,7** | USD 0,0044 ≈ $ 17 |
| Igual, pero con dictado gratis del celular | 800 / 200 | USD 0,0002 ≈ **$ 0,7** | USD 0,0036 ≈ $ 14 |
| Resumen semanal (por lotes, −50 %) | 3.000 / 500 | USD 0,0003 ≈ **$ 1,1** | USD 0,0055 ≈ $ 22 |
| Pregunta "¿cómo voy?" | 4.000 / 400 | USD 0,0006 ≈ **$ 2,4** | USD 0,012 ≈ $ 48 |

El resumen y las preguntas no deben recibir los movimientos crudos. Deben recibir **cifras ya calculadas en la base de datos**: totales del mes, las 5 categorías principales, quién debe y cuánto. Así el prompt es pequeño, sale más barato y la IA no inventa sumas.

## Costo mensual por usuario

| Perfil | Uso al mes | Con Haiku 5.5 | Con Sonnet 5.5 |
|---|---|---|---|
| Normal | 20 recibos, 20 notas de voz, 4 resúmenes, 10 preguntas | USD 0,034 ≈ **$ 135** | USD 0,39 ≈ $ 1.560 |
| Intensivo | 100 recibos, 100 notas de voz, 4 resúmenes, 40 preguntas | USD 0,16 ≈ **$ 630** | USD 1,74 ≈ $ 6.950 |

## Rentabilidad: costo de IA frente al precio del plan

| Plan (COP/mes) | Usuario normal con Haiku | Usuario intensivo con Haiku | Usuario intensivo con Sonnet |
|---|---|---|---|
| Emprendedor 24.900 | 0,5 % | 2,5 % | **28 %** |
| Negocio 59.900 | 0,2 % | 1,1 % | 12 % |
| Pro 129.900 | 0,1 % | 0,5 % | 5 % |

**Conclusión:** con Haiku 5.5 la IA es casi gratis frente al precio del plan, incluso para un usuario intensivo. Lo que destruye el margen es usar Sonnet para todo o no poner límites. La regla es: **Haiku siempre; Sonnet solo como respaldo** cuando Haiku devuelva campos vacíos o con baja confianza (se espera menos del 10 % de los recibos, lo que suma unos $ 3 por recibo en promedio).

## Límites sugeridos por plan (uso justo)

Los límites protegen contra el abuso y crean una razón para subir de plan. Un "registro con IA" es una foto de recibo o una nota de voz.

| Plan | Registros con IA al mes | Costo máximo con Haiku | % del precio |
|---|---|---|---|
| Gratis | 10 (para que la pruebe) | ≈ $ 37 | Costo de adquisición |
| Emprendedor | 100 | ≈ $ 370 | 1,5 % |
| Negocio | 400 | ≈ $ 1.480 | 2,5 % |
| Pro | 1.500 (uso justo) | ≈ $ 5.550 | 4,3 % |

El resumen semanal va incluido en todos los planes pagos (unos $ 5 al mes) y las preguntas "¿cómo voy?" se limitan a 30, 100 y 300 al mes. El conteo de uso se guarda en la base de datos, con el mismo mecanismo de `plan_limits` que ya existe, y la interfaz muestra "Te quedan N registros con IA este mes".

## Otros costos que hay que sumar

- **Guardar las fotos:**
  - Comprimidas a unos 200 KB, un usuario intensivo ocupa unos 20 MB al mes.
  - Supabase incluye 100 GB en el plan Pro y luego cobra unos USD 0,021 por GB.
  - Es despreciable: menos de $ 2 por usuario al mes.
- **WhatsApp Business** (si se registra por WhatsApp):
  - Cuando el usuario escribe primero, los mensajes de servicio son gratis desde noviembre de 2024 y la respuesta dentro de las 24 h no se cobra.
  - Lo que sí se cobra son las **plantillas** que inicia el negocio, como enviar el resumen semanal por WhatsApp. Se cobran por mensaje, y la tarifa de Colombia subió en octubre de 2025: hay que consultar la tabla oficial de Meta.
  - Si se usa un intermediario (Twilio, 360dialog), este suma su propia comisión por mensaje.
  - Recomendación: el resumen semanal va **por correo** (ya existe `email_outbox` con Resend) y WhatsApp solo recibe lo que el usuario escribe.
- **Comisión por pagar en dólares:** la tarjeta o el banco cobran entre 2 y 4 % de comisión de cambio sobre la factura de Anthropic.
- **Margen de error de la estimación:** conviene presupuestar el doble de lo calculado hasta tener datos del piloto.

## Recomendación

1. Empezar con **foto de recibo + Haiku 5.5**, con límites por plan y respaldo en Sonnet. Es la función más barata y la más visible.
2. **Notas de voz** primero con el dictado gratis del celular (cuesta $ 0,7 por registro). Agregar transcripción en el servidor solo si la calidad del dictado no alcanza.
3. **Resumen semanal por correo** con la API de lotes. Cuesta unos $ 5 por usuario al mes.
4. Instrumentar desde el día 1: guardar `input_tokens`, `output_tokens` y el modelo usado en cada llamada, y revisar cada mes el costo real por usuario y por plan en la consola de administración.

Con estos supuestos, la IA cuesta en promedio **menos de $ 300 al mes por usuario** (alrededor del 1 % del plan Emprendedor), así que se puede incluir en los planes pagos sin subir los precios.

## Fuentes
- Precios de Claude: tabla de modelos de la API de Anthropic (consultada el 6 de octubre de 2026).
- Voz a texto: [precios de APIs de voz a texto en 2026](https://convertaudiototext.com/blog/speech-to-text-api-pricing-2026), [Deepgram vs Whisper](https://costbench.com/compare/deepgram-vs-openai-whisper/), [precios de OpenAI Whisper en 2026](https://diyai.io/ai-tools/speech-to-text/openai-whisper-api-pricing-2026/).
- WhatsApp: [precios de WhatsApp Business Platform (Meta)](https://developers.facebook.com/docs/whatsapp/pricing), [guía de costos 2026 (Leadsales)](https://leadsales.io/?p=21532).
