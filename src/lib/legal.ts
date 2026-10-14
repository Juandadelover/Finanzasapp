export const TERMS_VERSION = "2026-10-14";
export const LEGAL_UPDATED = "14 de octubre de 2026";

export const LEGAL_PLACEHOLDERS = {
  responsable: "[NOMBRE DEL RESPONSABLE]",
  cedula: "[CÉDULA]",
  email: "[EMAIL DE CONTACTO]",
  ciudad: "[CIUDAD]",
};

export interface LegalSection {
  id: string;
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDoc {
  slug: "terminos" | "privacidad" | "reembolsos" | "aviso";
  title: string;
  summary: string;
  toc: boolean;
  sections: LegalSection[];
}

const R = LEGAL_PLACEHOLDERS;

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terminos",
    title: "Términos y condiciones",
    summary: "Reglas de uso del servicio Finanzas.",
    toc: true,
    sections: [
      {
        id: "objeto",
        heading: "1. Objeto y aceptación",
        paragraphs: [
          `Finanzas es un servicio de software en línea para llevar el control del dinero de tu negocio (ingresos, gastos, cuentas, cartera y reportes). Es operado por ${R.responsable}, persona natural, identificada con ${R.cedula}, domiciliada en ${R.ciudad} (el "Operador").`,
          "Al crear una cuenta o usar el servicio aceptas estos Términos y la Política de tratamiento de datos personales. Si no estás de acuerdo, no uses el servicio.",
        ],
      },
      {
        id: "cuenta",
        heading: "2. Tu cuenta",
        items: [
          "Debes ser mayor de edad y dar información veraz.",
          "Eres responsable de la confidencialidad de tu contraseña y de lo que ocurra en tu cuenta.",
          "Si invitas a otras personas a tu negocio, tú respondes por los permisos que les das.",
        ],
      },
      {
        id: "planes",
        heading: "3. Planes, precios y pagos",
        paragraphs: [
          "Existe un plan Gratis y planes de pago (Emprendedor, Negocio y Pro) con precios en pesos colombianos (COP) publicados en la página de precios. El Operador es persona natural no responsable de IVA, por lo que los precios no incluyen IVA.",
          "Los planes de pago incluyen una prueba gratuita de 14 días, sin tarjeta. El pago se hace por fuera de la aplicación, por Nequi, transferencia Bancolombia o llave Bre-B, y se confirma de forma manual al verificar el comprobante que subes en la app.",
          "El plan anual equivale a diez (10) mensualidades. Antes de pagar verás el monto exacto, el periodo que cubre y la referencia de pago.",
        ],
      },
      {
        id: "renovacion",
        heading: "4. Vencimiento, renovación y cancelación",
        items: [
          "No hay cobros automáticos: cada periodo se renueva cuando tú pagas de nuevo.",
          "Si el plan vence sin pago, hay 5 días de gracia y luego tu cuenta pasa al plan Gratis, sin borrar tus datos. Algunas funciones o cantidades pueden quedar limitadas según los límites del plan Gratis.",
          "Puedes cancelar en cualquier momento. Conservas el acceso hasta el final del periodo pagado. Ver la Política de reembolsos.",
        ],
      },
      {
        id: "uso",
        heading: "5. Uso aceptable",
        items: [
          "No uses el servicio para actividades ilegales ni para almacenar contenido que infrinja derechos de terceros.",
          "No intentes acceder a datos de otros usuarios, interferir con el servicio ni hacer ingeniería inversa.",
          "El Operador puede suspender cuentas que incumplan estos Términos.",
        ],
      },
      {
        id: "datos",
        heading: "6. Tus datos",
        paragraphs: [
          "Tus datos financieros son tuyos. Puedes exportarlos y solicitar la eliminación de tu cuenta desde la sección Cuenta. La eliminación se hace efectiva 30 días después de solicitarla y puedes cancelarla en ese lapso.",
          "El tratamiento de datos personales se rige por la Política de tratamiento de datos personales.",
        ],
      },
      {
        id: "facturacion",
        heading: "7. Facturación",
        paragraphs: [
          "Finanzas no emite facturas electrónicas de venta por ti: no es un software de facturación electrónica ante la DIAN. Las cotizaciones y cuentas de cobro que genera la app son documentos informativos. Por los cobros del servicio, el Operador entregará el soporte que corresponda según su régimen tributario.",
        ],
      },
      {
        id: "responsabilidad",
        heading: "8. Limitación de responsabilidad",
        paragraphs: [
          'El servicio se presta "tal cual". El Operador hace esfuerzos razonables por mantenerlo disponible y respaldado, pero no garantiza que no tendrá interrupciones o errores. Finanzas es una herramienta de organización y no reemplaza asesoría contable ni tributaria (ver Aviso importante).',
          "En la medida permitida por la ley, la responsabilidad total del Operador frente a ti se limita al valor pagado por el servicio en los últimos tres (3) meses. Esto no afecta los derechos irrenunciables que te otorga el Estatuto del Consumidor.",
        ],
      },
      {
        id: "cambios",
        heading: "9. Cambios a estos Términos",
        paragraphs: [
          "Podemos actualizar estos Términos. Si el cambio es importante, te lo avisaremos por la app o por correo y se te pedirá aceptar la nueva versión.",
        ],
      },
      {
        id: "ley",
        heading: "10. Ley aplicable y contacto",
        paragraphs: [
          `Estos Términos se rigen por las leyes de la República de Colombia. Para dudas o reclamos escribe a ${R.email}.`,
        ],
      },
    ],
  },
  {
    slug: "privacidad",
    title: "Política de tratamiento de datos personales",
    summary: "Cómo recolectamos y usamos tus datos, conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.",
    toc: true,
    sections: [
      {
        id: "responsable",
        heading: "1. Responsable del tratamiento",
        items: [
          `Nombre: ${R.responsable}`,
          `Identificación: ${R.cedula}`,
          `Domicilio: ${R.ciudad}, Colombia`,
          `Correo para consultas y reclamos: ${R.email}`,
        ],
      },
      {
        id: "datos",
        heading: "2. Datos que tratamos",
        items: [
          "Datos de cuenta: nombre, correo electrónico y contraseña (almacenada cifrada).",
          "Datos que tú registras: movimientos, cuentas, clientes y proveedores, documentos de cobro y comprobantes de pago.",
          "Datos técnicos mínimos: registros de acceso y de errores para seguridad y soporte.",
          "No solicitamos datos sensibles. Te pedimos no registrar información sensible innecesaria en campos de texto libre.",
        ],
      },
      {
        id: "finalidades",
        heading: "3. Finalidades",
        items: [
          "Crear y administrar tu cuenta y prestarte el servicio contratado.",
          "Verificar pagos de suscripción y gestionar tu plan.",
          "Enviarte comunicaciones del servicio: confirmación de cuenta, recuperación de contraseña, recordatorios de vencimiento y avisos importantes.",
          "Seguridad, prevención de fraude y mejora del servicio.",
          "Cumplir obligaciones legales.",
        ],
        paragraphs: ["No vendemos tus datos ni los usamos para publicidad de terceros."],
      },
      {
        id: "derechos",
        heading: "4. Derechos del titular",
        paragraphs: ["Como titular de los datos tienes derecho a:"],
        items: [
          "Conocer los datos que tenemos sobre ti y cómo los usamos.",
          "Actualizar y rectificar tus datos cuando sean inexactos o incompletos.",
          "Solicitar prueba de la autorización que otorgaste.",
          "Ser informado sobre el uso que se ha dado a tus datos.",
          "Suprimir tus datos y revocar la autorización, cuando no exista un deber legal o contractual de conservarlos. Puedes solicitar la eliminación de tu cuenta desde la sección Cuenta de la app.",
          "Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).",
        ],
      },
      {
        id: "procedimiento",
        heading: "5. Consultas y reclamos",
        paragraphs: [
          `Consultas: escríbenos a ${R.email} indicando tu nombre y el correo de tu cuenta. Responderemos en un máximo de diez (10) días hábiles. Si no es posible, te informaremos el motivo y la nueva fecha, que no superará cinco (5) días hábiles adicionales.`,
          `Reclamos (corrección, actualización, supresión o revocatoria): escríbenos a ${R.email} con la descripción de los hechos y lo que solicitas. Responderemos en un máximo de quince (15) días hábiles. Si no es posible, te informaremos el motivo y la nueva fecha, que no superará ocho (8) días hábiles adicionales. Si el reclamo está incompleto, te pediremos completarlo dentro de los 5 días siguientes.`,
        ],
      },
      {
        id: "transferencia",
        heading: "6. Encargados y transferencia internacional",
        paragraphs: [
          "Para prestar el servicio usamos proveedores que actúan como encargados del tratamiento y que pueden almacenar o procesar datos fuera de Colombia:",
        ],
        items: [
          "Supabase: base de datos, autenticación y archivos. Servidores en la región sa-east-1 (São Paulo, Brasil).",
          "Vercel: alojamiento de la aplicación web.",
          "Resend: envío de correos electrónicos del servicio.",
        ],
      },
      {
        id: "seguridad",
        heading: "7. Seguridad",
        paragraphs: [
          "Aplicamos medidas razonables: conexiones cifradas, contraseñas cifradas, y reglas de acceso para que cada usuario solo vea los datos de sus propios negocios. Ningún sistema es infalible; si ocurre un incidente que afecte tus datos, te lo informaremos.",
        ],
      },
      {
        id: "vigencia",
        heading: "8. Vigencia y cambios",
        paragraphs: [
          "Los datos se conservan mientras tu cuenta esté activa y, después, por el tiempo necesario para cumplir obligaciones legales. Esta política rige desde la fecha indicada arriba; los cambios se publicarán en esta página y, si son importantes, te los avisaremos.",
        ],
      },
    ],
  },
  {
    slug: "reembolsos",
    title: "Política de cancelación y reembolsos",
    summary: "Cómo cancelar tu plan y cuándo aplica un reembolso.",
    toc: false,
    sections: [
      {
        id: "cancelacion",
        heading: "Cancelación",
        paragraphs: [
          "Puedes cancelar tu plan en cualquier momento. Conservas el acceso a las funciones de tu plan hasta el final del periodo que ya pagaste; después tu cuenta pasa al plan Gratis y tus datos se conservan.",
          "No hay cobros automáticos, así que no necesitas hacer nada más para evitar nuevos cargos.",
        ],
      },
      {
        id: "reembolsos",
        heading: "Reembolsos",
        paragraphs: [
          "No hacemos reembolsos proporcionales por el tiempo no usado del periodo pagado, salvo que haya un error de cobro (por ejemplo, un monto distinto al publicado o un pago duplicado). En ese caso devolvemos la diferencia por el mismo medio de pago.",
        ],
      },
      {
        id: "retracto",
        heading: "Derecho de retracto",
        paragraphs: [
          "Si contratas a distancia (por medios electrónicos) y pagas tu primera suscripción, puedes ejercer el derecho de retracto dentro de los cinco (5) días hábiles siguientes a la contratación, conforme al artículo 47 de la Ley 1480 de 2011 (Estatuto del Consumidor). Te devolveremos el valor pagado sin penalidad.",
          `Para ejercerlo escribe a ${R.email} con el correo de tu cuenta y la referencia del pago.`,
        ],
      },
      {
        id: "prueba",
        heading: "Prueba gratuita",
        paragraphs: ["Los primeros 14 días de un plan de pago son gratis y sin tarjeta, para que lo pruebes antes de pagar."],
      },
    ],
  },
  {
    slug: "aviso",
    title: "Aviso importante",
    summary: "Finanzas no reemplaza asesoría contable ni tributaria.",
    toc: false,
    sections: [
      {
        id: "aviso",
        heading: "No es asesoría profesional",
        paragraphs: [
          "Finanzas es una herramienta para organizar y visualizar el dinero de tu negocio. La información, los reportes y los cálculos que muestra son de carácter informativo y no reemplazan asesoría contable, tributaria, legal ni financiera.",
          "Para decisiones tributarias, declaraciones, facturación electrónica o contabilidad formal, consulta con un contador público. Tú eres responsable de verificar la exactitud de los datos que registras y de tus obligaciones ante la DIAN y demás autoridades.",
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
