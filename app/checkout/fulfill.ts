import "server-only";

import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { sendBrevoEmail } from "@/lib/brevo";
import { stripeGet, stripePost } from "@/lib/stripe";
import {
  CHECKOUT_OFFER,
  CONTACT_EMAIL,
  findPlan,
  formatPrice,
  vatSplit,
} from "@/lib/checkout";

/**
 * Alles, was NACH der bezahlten Stripe-Session passiert: Bestellung auf
 * "bezahlt", Lead auf "won", Activity, Bestätigungs-Mail.
 *
 * Wird von ZWEI Seiten aufgerufen — dem Stripe-Webhook und der Danke-Seite.
 * Der Webhook ist der Normalfall, die Danke-Seite der Rettungsanker, falls er
 * ausfällt; sonst hätte ein Käufer bezahlt und stünde nirgends im CRM.
 *
 * Deshalb ist die Funktion **idempotent**: den Zuschlag bekommt der erste
 * Aufrufer, der die Bestellung per bedingtem UPDATE (`status = 'offen'`) für
 * sich reklamiert. Wer leer ausgeht, macht nichts weiter — insbesondere geht
 * die Mail nur ein einziges Mal raus.
 */
export async function fulfillPaidOrder(reference: string, stripeSessionId: string): Promise<void> {
  if (!reference) return;

  const admin = getSupabaseServiceRole();

  // Bedingtes UPDATE als Schloss: nur die Zeile, die noch "offen" ist. Zwei
  // parallele Aufrufe können nicht beide gewinnen.
  const { data: claimed, error: claimError } = await admin
    .from("checkout_orders")
    .update({ status: "bezahlt" })
    .eq("reference", reference)
    .eq("status", "offen")
    .select("*");

  if (claimError) {
    console.error("fulfill: Bestellung konnte nicht auf bezahlt gesetzt werden", claimError.message);
    return;
  }
  if (!claimed || claimed.length === 0) return; // schon erledigt

  const order = claimed[0] as Record<string, unknown>;
  const orgId = order.org_id as string;
  const planId = order.plan_id as string;
  const plan = findPlan(planId);
  // Der Name kommt aus der BESTELLUNG, nicht aus der Angebots-Konfiguration:
  // seit /angebote laufen mehrere Produkte durch dieselbe Erfüllung, und bei
  // einer Einzelstunde stünde sonst "5er-Paket" in Mail und CRM.
  const offerName = String(order.offer_name || CHECKOUT_OFFER.name);

  // Kundendaten kommen von Stripe, nicht aus einem Formular vor der Zahlung:
  // die Bestellung wurde ohne sie angelegt. Erst hier stehen Name, E-Mail,
  // Telefon und Rechnungsadresse fest — und zwar so, wie der Käufer sie
  // gegenüber dem Zahlungsdienstleister angegeben hat.
  const details = await customerDetailsFrom(stripeSessionId);
  if (details) {
    Object.assign(order, details);
    const { error } = await admin
      .from("checkout_orders")
      .update(details)
      .eq("reference", reference);
    if (error) console.error("fulfill: Kundendaten nicht gespeichert", error.message);
  }

  const fullName = `${order.first_name} ${order.last_name}`.trim();
  const email = String(order.email ?? "");

  if (!email) {
    // Ohne Adresse gibt es keine Bestätigung und keinen sinnvollen Lead. Die
    // Zahlung steht trotzdem — deshalb laut scheitern statt still weiterlaufen.
    console.error("fulfill: keine E-Mail aus der Stripe-Session", reference, stripeSessionId);
  }

  // Ab hier ist die Bestellung bezahlt — kein Teilschritt darf das kippen.
  const leadId = await upsertWonLead(admin, orgId, order, fullName, email);

  if (leadId) {
    if (leadId !== order.lead_id) {
      await admin.from("checkout_orders").update({ lead_id: leadId }).eq("reference", reference);
    }
    const { error: activityError } = await admin.from("activities").insert({
      org_id: orgId,
      lead_id: leadId,
      type: "note",
      content:
        `Zahlung eingegangen — Bestellung ${reference}, ${offerName}` +
        `${plan ? `, ${plan.label}` : ""} (${formatPrice(Number(order.amount_gross))} brutto)`,
      meta: {
        source: "checkout",
        reference,
        plan_id: planId,
        amount_gross: Number(order.amount_gross),
        stripe_session: stripeSessionId,
      },
    });
    if (activityError) console.error("fulfill: Activity fehlgeschlagen", activityError.message);
  }

  await sendConfirmation(order, fullName, reference, plan?.label ?? planId);
}

/**
 * Name, E-Mail, Telefon und Rechnungsadresse aus der bezahlten Stripe-Session.
 *
 * Stripe liefert einen zusammenhängenden Namen ("Ama Boateng"); die Bestellung
 * führt Vor- und Nachname getrennt. Alles vor dem letzten Leerzeichen ist
 * Vorname — bei einem einzelnen Wort bleibt der Nachname leer, statt zu raten.
 */
async function customerDetailsFrom(
  sessionId: string,
): Promise<Record<string, string> | null> {
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;

  try {
    const session = (await stripeGet(`/checkout/sessions/${sessionId}`)) as {
      customer_details?: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        address?: {
          line1?: string | null;
          line2?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string | null;
        } | null;
      } | null;
    };

    const d = session.customer_details;
    if (!d) return null;

    const name = (d.name ?? "").trim();
    const cut = name.lastIndexOf(" ");
    const street = [d.address?.line1, d.address?.line2].filter(Boolean).join(", ");

    return {
      first_name: cut > 0 ? name.slice(0, cut) : name,
      last_name: cut > 0 ? name.slice(cut + 1) : "",
      email: (d.email ?? "").trim().toLowerCase(),
      phone: (d.phone ?? "").trim(),
      street,
      postal_code: (d.address?.postal_code ?? "").trim(),
      city: (d.address?.city ?? "").trim(),
      country: countryName(d.address?.country),
    };
  } catch (err) {
    console.error("fulfill: Stripe-Session nicht lesbar", sessionId, err);
    return null;
  }
}

/** Stripe liefert ISO-Codes, die Bestellung führt Klartext. */
function countryName(code: string | null | undefined): string {
  const map: Record<string, string> = {
    DE: "Deutschland",
    AT: "Österreich",
    CH: "Schweiz",
  };
  return (code && map[code.toUpperCase()]) || code || "Deutschland";
}

type AdminClient = ReturnType<typeof getSupabaseServiceRole>;

/**
 * Der Lead entsteht erst mit der Zahlung — Abbrecher an der Stripe-Kasse sollen
 * die Pipeline nicht mit gewonnenen Deals fluten. Bestehende Leads (gleiche Org,
 * gleiche E-Mail) werden gehoben statt doppelt angelegt.
 */
async function upsertWonLead(
  admin: AdminClient,
  orgId: string,
  order: Record<string, unknown>,
  fullName: string,
  email: string,
): Promise<string | null> {
  const amount = Number(order.amount_gross);
  try {
    // ilike statt eq wegen gemischter Schreibweise bei manuell angelegten Leads.
    // %, _ und \ escapen, sonst wäre "max_mustermann@…" ein Suchmuster.
    const emailPattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: existing } = await admin
      .from("leads")
      .select("id, name, first_name, last_name, phone")
      .eq("org_id", orgId)
      .ilike("email", emailPattern)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await admin
        .from("leads")
        .update({
          stage: "won",
          value_estimate: amount,
          // Vorhandene Felder nicht überschreiben — nur Lücken füllen.
          name: existing.name || fullName,
          first_name: existing.first_name || (order.first_name as string),
          last_name: existing.last_name || (order.last_name as string),
          phone: existing.phone || (order.phone as string | null),
        })
        .eq("id", existing.id as string);
      if (error) throw new Error(error.message);
      return existing.id as string;
    }

    const { data: created, error } = await admin
      .from("leads")
      .insert({
        org_id: orgId,
        source: "manual",
        source_manual: `Checkout ${order.offer_name || CHECKOUT_OFFER.name}`,
        stage: "won",
        name: fullName,
        first_name: order.first_name as string,
        last_name: order.last_name as string,
        email,
        phone: (order.phone as string | null) || null,
        value_estimate: amount,
        notes: (order.notes as string | null) || null,
        utm_source: (order.utm_source as string | null) ?? null,
        utm_medium: (order.utm_medium as string | null) ?? null,
        utm_campaign: (order.utm_campaign as string | null) ?? null,
        utm_content: (order.utm_content as string | null) ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return (created?.id as string) ?? null;
  } catch (err) {
    console.error("fulfill: Lead-Verknüpfung fehlgeschlagen", err);
    return null;
  }
}

/** Bestätigungs-Mail über Brevo. Ohne Template-ID passiert nichts. */
async function sendConfirmation(
  order: Record<string, unknown>,
  fullName: string,
  reference: string,
  planLabel: string,
): Promise<void> {
  const templateId = Number(process.env.BREVO_TPL_CHECKOUT_CONFIRMATION);
  if (!Number.isFinite(templateId) || templateId <= 0) return;

  const gross = Number(order.amount_gross);
  const rate = Number(order.vat_rate);
  const installments = Number(order.installments) || 1;
  const { net, vat } = vatSplit(gross, rate);

  try {
    const res = await sendBrevoEmail({
      to: { email: String(order.email), name: fullName },
      templateId,
      sender: { email: CONTACT_EMAIL, name: "Jerome Deres Coaching" },
      params: {
        firstName: order.first_name,
        fullName,
        reference,
        offerName: order.offer_name || CHECKOUT_OFFER.name,
        planLabel,
        installments,
        installmentAmount: formatPrice(gross / installments),
        amountGross: formatPrice(gross),
        amountNet: formatPrice(net),
        amountVat: formatPrice(vat),
        vatRate: Math.round(rate * 100),
        contactEmail: CONTACT_EMAIL,
      },
    });
    if (!res.ok) console.error("fulfill: Bestätigungs-Mail fehlgeschlagen", res.error);
  } catch (err) {
    console.error("fulfill: Bestätigungs-Mail fehlgeschlagen", err);
  }
}

/**
 * Ratenzahlung beenden, sobald sie bezahlt ist.
 *
 * Stripe Checkout kann beim Anlegen kein Enddatum mitgeben, ein Abo liefe also
 * ewig weiter. Deshalb wird `cancel_at` gesetzt, sobald die erste Rate durch
 * ist: kurz nach der letzten fälligen Rate, aber lange vor der nächsten. Bei
 * 2 × monatlich heißt das ~1 Monat + 5 Tage — Rate 2 wird noch abgerechnet,
 * Rate 3 kann nicht mehr entstehen.
 *
 * Läuft aus Webhook UND Danke-Seite (beide idempotent), damit ein verpasster
 * Webhook keine Dauerabbuchung hinterlässt.
 */
export async function endInstallmentPlanAfterLastRate(
  subscriptionId: string,
  installments: number,
): Promise<void> {
  if (!subscriptionId || installments < 2) return;
  try {
    const sub = (await stripePost(`/subscriptions/${subscriptionId}`, {})) as {
      current_period_start?: number;
      current_period_end?: number;
      cancel_at?: number | null;
      status?: string;
    };
    if (sub.cancel_at) return; // schon gesetzt

    const start = sub.current_period_start;
    const end = sub.current_period_end;
    if (!start || !end) return;

    // Eine Periode = ein Monat. Nach `installments` Perioden ist die letzte Rate
    // abgerechnet; +5 Tage Puffer, damit die Abrechnung sicher durch ist.
    const periodLength = end - start;
    const cancelAt = start + periodLength * installments + 5 * 24 * 60 * 60;

    await stripePost(`/subscriptions/${subscriptionId}`, { cancel_at: cancelAt });
  } catch (err) {
    console.error("fulfill: Raten-Abo konnte nicht terminiert werden", subscriptionId, err);
  }
}
