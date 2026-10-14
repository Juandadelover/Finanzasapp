// Envía por Resend los correos pendientes de public.email_outbox.
// La invoca pg_cron cada 10 minutos (ver migración *_email_reminders.sql).
//
// pg_cron envía el secreto "send_emails_cron_secret" de Vault en x-cron-secret
// y la función lo valida con public.check_cron_secret.
//
// Secretos de la función:
//   RESEND_API_KEY  API key de Resend
//   EMAIL_FROM      remitente, p. ej. "Finanzas <avisos@tudominio.com>"
//   APP_URL         URL pública de la app, p. ej. https://finanzas.vercel.app
// Sin RESEND_API_KEY o EMAIL_FROM no envía nada y los correos siguen en cola.

import { createClient } from "jsr:@supabase/supabase-js@2";

interface OutboxRow {
  id: number;
  to_email: string;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
}

const MAX_ATTEMPTS = 5;
const BATCH = 50;

const cop = (n: unknown) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    Number(n ?? 0)
  );

const fecha = (d: unknown) =>
  d
    ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${String(d).slice(0, 10)}T00:00:00Z`)
      )
    : "";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function render(row: OutboxRow, appUrl: string): { subject: string; html: string } {
  const p = row.payload;
  const hola = p.name ? `Hola ${esc(p.name)},` : "Hola,";
  const planesUrl = `${appUrl}/suscripcion`;
  const boton = (texto: string, url: string) =>
    appUrl
      ? `<p style="margin:24px 0"><a href="${url}" style="background:#8a05be;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">${texto}</a></p>`
      : "";
  const dias = (n: unknown) => (Number(n) === 1 ? "1 día" : `${n} días`);

  let subject = "";
  let body = "";
  switch (row.kind) {
    case "trial_ending":
      subject = `Tu prueba gratis termina en ${dias(p.days)}`;
      body = `<p>${hola}</p><p>Tu prueba del plan <b>${esc(p.plan)}</b> termina el <b>${fecha(p.date)}</b>. Después seguirás en el plan Gratis sin perder tus datos.</p><p>Si quieres seguir con todas las funciones, elige un plan y paga por Nequi, Bancolombia o Bre-B.</p>${boton("Ver planes", planesUrl)}`;
      break;
    case "renewal_due":
      subject = `Tu plan ${p.plan} vence en ${dias(p.days)}`;
      body = `<p>${hola}</p><p>Tu plan <b>${esc(p.plan)}</b> vence el <b>${fecha(p.date)}</b>. Para renovarlo paga <b>${cop(p.amount)}</b> (${p.cycle === "annual" ? "anual" : "mensual"}) y sube el comprobante en la app.</p>${boton("Renovar", planesUrl)}`;
      break;
    case "grace":
      subject = `Tu plan ${p.plan} venció: tienes hasta el ${fecha(p.date)}`;
      body = `<p>${hola}</p><p>Tu plan <b>${esc(p.plan)}</b> venció. Seguirás teniendo acceso hasta el <b>${fecha(p.date)}</b>; después tu cuenta pasará al plan Gratis (tus datos se conservan).</p>${boton("Renovar ahora", planesUrl)}`;
      break;
    case "expired":
      subject = "Tu cuenta pasó al plan Gratis";
      body = `<p>${hola}</p><p>Como no recibimos la renovación del plan <b>${esc(p.plan)}</b>, tu cuenta pasó al plan Gratis. Tus datos están intactos y puedes volver a un plan pagado cuando quieras.</p>${boton("Ver planes", planesUrl)}`;
      break;
    case "payment_approved":
      subject = "Confirmamos tu pago";
      body = `<p>${hola}</p><p>Recibimos tu pago de <b>${cop(p.amount)}</b> (referencia <b>${esc(p.reference)}</b>). Tu plan <b>${esc(p.plan)}</b> está activo${p.until ? ` hasta el <b>${fecha(p.until)}</b>` : ""}.</p><p>¡Gracias por confiar en Finanzas!</p>${boton("Ir a la app", appUrl)}`;
      break;
    case "payment_rejected":
      subject = "No pudimos confirmar tu pago";
      body = `<p>${hola}</p><p>Revisamos el comprobante de la referencia <b>${esc(p.reference)}</b> y no pudimos confirmarlo.</p><p>Motivo: <b>${esc(p.reason)}</b></p><p>Puedes subir un nuevo comprobante desde la app.</p>${boton("Subir comprobante", planesUrl)}`;
      break;
    case "admin_new_receipt":
      subject = `Nuevo comprobante por revisar: ${p.reference}`;
      body = `<p>Hay un comprobante nuevo por revisar.</p><p>Referencia <b>${esc(p.reference)}</b> · plan <b>${esc(p.plan)}</b> · esperado <b>${cop(p.amount)}</b> · declarado <b>${cop(p.declared)}</b> · medio <b>${esc(p.channel)}</b>.</p>${boton("Revisar pagos", `${appUrl}/admin/pagos`)}`;
      break;
    case "invitation": {
      const roles: Record<string, string> = {
        admin: "administrador", editor: "editor", accountant: "contador", recorder: "solo registro",
      };
      subject = `Te invitaron a ${p.workspace} en Finanzas`;
      body = `<p>Hola,</p><p>${p.inviter ? `<b>${esc(p.inviter)}</b> te invitó` : "Te invitaron"} a unirte al negocio <b>${esc(p.workspace)}</b> en Finanzas como <b>${esc(roles[String(p.role)] ?? p.role)}</b>.</p><p>La invitación vence en 7 días.</p>${boton("Aceptar invitación", `${appUrl}/invitacion/${encodeURIComponent(String(p.token))}`)}`;
      break;
    }
    default:
      throw new Error(`Tipo de correo desconocido: ${row.kind}`);
  }

  const html = `<!doctype html><html><body style="margin:0;background:#f6f4f8;font-family:Arial,Helvetica,sans-serif;color:#1f1f29">
<div style="max-width:520px;margin:0 auto;padding:24px">
<div style="background:#fff;border-radius:16px;padding:28px;line-height:1.55;font-size:15px">
<p style="margin:0 0 16px;font-weight:700;color:#8a05be;font-size:18px">Finanzas</p>${body}</div>
<p style="font-size:12px;color:#77738a;text-align:center;margin-top:16px">Recibes este correo porque tienes una cuenta en Finanzas.</p>
</div></body></html>`;
  return { subject, html };
}

Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: authorized } = await supabase.rpc("check_cron_secret", {
    p_secret: req.headers.get("x-cron-secret") ?? "",
  });
  if (authorized !== true) return new Response("No autorizado", { status: 401 });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!resendKey || !from) {
    return Response.json({ skipped: "Falta RESEND_API_KEY o EMAIL_FROM; los correos siguen en cola." });
  }
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

  const { data: rows, error } = await supabase
    .from("email_outbox")
    .select("id, to_email, kind, payload, attempts")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const row of (rows ?? []) as OutboxRow[]) {
    try {
      const { subject, html } = render(row, appUrl);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `outbox-${row.id}`,
        },
        body: JSON.stringify({ from, to: [row.to_email], subject, html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      await supabase
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), attempts: row.attempts + 1, last_error: null })
        .eq("id", row.id);
      sent++;
    } catch (e) {
      const attempts = row.attempts + 1;
      await supabase
        .from("email_outbox")
        .update({ status: attempts >= MAX_ATTEMPTS ? "failed" : "pending", attempts, last_error: String(e).slice(0, 500) })
        .eq("id", row.id);
      failed++;
    }
  }

  return Response.json({ sent, failed });
});
