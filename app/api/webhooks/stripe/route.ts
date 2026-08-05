import { NextResponse } from "next/server";

import { verifyStripeSignature, stripeGet } from "@/lib/stripe";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { fulfillPaidOrder, endInstallmentPlanAfterLastRate } from "@/app/checkout/fulfill";
import { formatPrice } from "@/lib/checkout";

export const runtime = "nodejs";
// Der Body muss ROH bleiben — die Signatur wird über den unveränderten Text
// gebildet. Deshalb kein Body-Parsing durch das Framework.
export const dynamic = "force-dynamic";

/**
 * Stripe-Webhook für den öffentlichen Checkout.
 *
 * Wird vom Auth-Proxy durchgelassen (proxy.ts lässt /api/webhooks/ ohne Session
 * passieren) — die Authentifizierung macht ausschliesslich die Signatur.
 *
 * Verarbeitete Events:
 *  - checkout.session.completed  → Bestellung bezahlt: Lead, Activity, Mail
 *  - invoice.paid                → Folgerate einer Ratenzahlung protokollieren
 *  - invoice.payment_failed      → geplatzte Rate protokollieren (sonst merkt
 *                                  es niemand, bis das Geld fehlt)
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET fehlt");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const object = event.data?.object ?? {};

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleSessionCompleted(object);
        break;
      case "invoice.paid":
        await handleInvoice(object, true);
        break;
      case "invoice.payment_failed":
        await handleInvoice(object, false);
        break;
      default:
        break; // andere Events interessieren hier nicht
    }
  } catch (err) {
    // 500 → Stripe wiederholt. Die Verarbeitung ist idempotent, ein Retry ist
    // also ungefährlich und besser als eine still verlorene Zahlung.
    console.error("[stripe-webhook] Verarbeitung fehlgeschlagen", event.type, err);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleSessionCompleted(session: Record<string, unknown>): Promise<void> {
  // Nur wirklich bezahlte Sessions zählen. Bei "unpaid" (z. B. verzögerte
  // SEPA-Zahlung) passiert nichts — dafür kommt später invoice/async_payment.
  const paymentStatus = session.payment_status as string | undefined;
  if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") return;

  const metadata = (session.metadata as Record<string, string> | null) ?? {};
  const reference = metadata.reference;
  if (!reference) return;

  await fulfillPaidOrder(reference, String(session.id ?? ""));

  // Ratenzahlung: Enddatum setzen, damit nach der letzten Rate Schluss ist.
  const subscriptionId = session.subscription as string | undefined;
  const installments = Number(metadata.installments) || 0;
  if (subscriptionId && installments >= 2) {
    await endInstallmentPlanAfterLastRate(subscriptionId, installments);
  }
}

/**
 * Folgeraten protokollieren. Die erste Rate steckt schon in der
 * Bestellbestätigung — hier geht es um Rate 2 und darum, eine geplatzte
 * Lastschrift sichtbar zu machen.
 */
async function handleInvoice(invoice: Record<string, unknown>, paid: boolean): Promise<void> {
  // Die erste Rechnung eines Abos gehört zur Bestellung selbst.
  if (invoice.billing_reason !== "subscription_cycle") return;

  const subscriptionId = invoice.subscription as string | undefined;
  if (!subscriptionId) return;

  const subscription = (await stripeGet(`/subscriptions/${subscriptionId}`)) as {
    metadata?: Record<string, string>;
  };
  const reference = subscription.metadata?.reference;
  if (!reference) return;

  const admin = getSupabaseServiceRole();
  const { data: order } = await admin
    .from("checkout_orders")
    .select("org_id, lead_id")
    .eq("reference", reference)
    .maybeSingle();

  if (!order?.lead_id) return;

  const amount = Number(invoice.amount_paid ?? invoice.amount_due ?? 0) / 100;
  await admin.from("activities").insert({
    org_id: order.org_id as string,
    lead_id: order.lead_id as string,
    type: "note",
    content: paid
      ? `Folgerate eingegangen — ${formatPrice(amount)} zu Bestellung ${reference}`
      : `Folgerate FEHLGESCHLAGEN — ${formatPrice(amount)} zu Bestellung ${reference}. Bitte nachfassen.`,
    meta: { source: "checkout", reference, paid, amount, stripe_invoice: invoice.id },
  });
}
