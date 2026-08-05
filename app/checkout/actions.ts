"use server";

import { headers } from "next/headers";

import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { stripeGet, stripePost } from "@/lib/stripe";
import {
  CHECKOUT_OFFER,
  findPlan,
  makeOrderReference,
  validateCheckout,
  type CheckoutInput,
  type FieldErrors,
  type PaymentPlan,
} from "@/lib/checkout";

export type CheckoutResult =
  | { ok: true; reference: string; url: string }
  | { ok: false; error: string; fields?: FieldErrors };

function isDevFake(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEV_FAKE_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

const trim = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * Bestellung der öffentlichen Checkout-Seite entgegennehmen und den Käufer zur
 * Stripe-Kasse schicken.
 *
 * Läuft ohne Login — deshalb:
 *  - Preis/Raten kommen NIE aus dem Formular, sondern aus lib/checkout.ts bzw.
 *    aus dem Stripe-Price hinter der Env-Variable des Plans
 *  - geschrieben wird mit dem Service-Role-Key (RLS-Bypass, Migration 0017)
 *  - alle Eingaben werden hier nochmal validiert und längenbegrenzt
 *
 * Die Bestellung entsteht hier mit Status "offen" — Lead, Activity und
 * Bestätigungs-Mail folgen erst, wenn Stripe die Zahlung meldet
 * (app/checkout/fulfill.ts). Ein Abbruch an der Kasse hinterlässt damit keinen
 * gewonnenen Deal in der Pipeline.
 */
export async function submitCheckout(raw: CheckoutInput): Promise<CheckoutResult> {
  const input: CheckoutInput = {
    firstName: trim(raw.firstName, 80),
    lastName: trim(raw.lastName, 80),
    email: trim(raw.email, 160).toLowerCase(),
    phone: trim(raw.phone, 40),
    company: trim(raw.company, 120),
    vatId: trim(raw.vatId, 40),
    street: trim(raw.street, 160),
    postalCode: trim(raw.postalCode, 16),
    city: trim(raw.city, 100),
    country: trim(raw.country, 80) || "Deutschland",
    planId: trim(raw.planId, 20),
    notes: trim(raw.notes, 1000),
    acceptTerms: raw.acceptTerms === true,
    acceptWithdrawal: raw.acceptWithdrawal === true,
    utmSource: trim(raw.utmSource, 120) || undefined,
    utmMedium: trim(raw.utmMedium, 120) || undefined,
    utmCampaign: trim(raw.utmCampaign, 120) || undefined,
    utmContent: trim(raw.utmContent, 120) || undefined,
  };

  const fields = validateCheckout(input);
  if (Object.keys(fields).length > 0) {
    return { ok: false, error: "Bitte die markierten Felder prüfen.", fields };
  }

  // Betrag serverseitig auflösen — das Formular liefert nur die plan-ID.
  const plan = findPlan(input.planId)!;
  const fullName = `${input.firstName} ${input.lastName}`.trim();

  // DEV-ONLY: ohne echtes Backend durchklickbar (analog getSupabaseServer).
  if (isDevFake()) {
    const reference = makeOrderReference(new Date());
    return { ok: true, reference, url: `/checkout/danke?ref=${reference}` };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("checkout: Supabase-Env fehlt (URL / SERVICE_ROLE_KEY)");
    return { ok: false, error: "Bestellung konnte nicht gespeichert werden. Bitte per E-Mail melden." };
  }

  const admin = getSupabaseServiceRole();

  // Ziel-Org auflösen (Angebot gehört zu genau einer Org).
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", CHECKOUT_OFFER.orgSlug)
    .maybeSingle();

  if (orgError || !org?.id) {
    console.error("checkout: Org nicht gefunden", CHECKOUT_OFFER.orgSlug, orgError?.message);
    return { ok: false, error: "Bestellung konnte nicht gespeichert werden. Bitte per E-Mail melden." };
  }
  const orgId = org.id as string;

  // Bestellung schreiben. reference ist unique → bei Kollision neu würfeln.
  let reference = "";
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const candidate = makeOrderReference(new Date());
    const { error } = await admin.from("checkout_orders").insert({
      org_id: orgId,
      reference: candidate,
      offer_slug: CHECKOUT_OFFER.slug,
      offer_name: CHECKOUT_OFFER.name,
      plan_id: plan.id,
      installments: plan.installments,
      amount_gross: plan.total,
      vat_rate: CHECKOUT_OFFER.vatRate,
      currency: CHECKOUT_OFFER.currency,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone || null,
      company: input.company || null,
      vat_id: input.vatId || null,
      street: input.street,
      postal_code: input.postalCode,
      city: input.city,
      country: input.country,
      notes: input.notes || null,
      status: "offen",
      lead_id: null,
      utm_source: input.utmSource ?? null,
      utm_medium: input.utmMedium ?? null,
      utm_campaign: input.utmCampaign ?? null,
      utm_content: input.utmContent ?? null,
    });

    if (!error) {
      reference = candidate;
      break;
    }
    // 23505 = unique_violation auf reference → nächster Versuch
    if ((error as { code?: string }).code !== "23505") {
      lastError = error.message;
      break;
    }
  }

  if (!reference) {
    console.error("checkout: insert fehlgeschlagen", lastError);
    return { ok: false, error: "Bestellung konnte nicht gespeichert werden. Bitte per E-Mail melden." };
  }

  try {
    const url = await createStripeCheckout(plan, input, fullName, reference);
    return { ok: true, reference, url };
  } catch (err) {
    console.error("checkout: Stripe-Session fehlgeschlagen", reference, err);
    return {
      ok: false,
      error: "Die Zahlungsseite konnte nicht geöffnet werden. Bitte nochmal versuchen.",
    };
  }
}

/**
 * Stripe-Kasse für diese Bestellung. Der Kunde wird vorher als Customer
 * angelegt, damit Rechnung und Beleg die Adresse tragen, die er hier eingegeben
 * hat — er muss sie bei Stripe nicht ein zweites Mal tippen.
 *
 * Der Preis im Stripe-Price ist der BRUTTO-Endbetrag, der Steuersatz muss
 * deshalb `inclusive` sein: Stripe rechnet die 19 % dann heraus statt sie
 * draufzuschlagen und weist Netto, MwSt und Gesamtbetrag getrennt aus — exakt
 * dieselbe Summe wie unsere Bestellübersicht. assertInclusiveTaxRate erzwingt
 * das, bevor eine Kasse aufgeht.
 */
async function createStripeCheckout(
  plan: PaymentPlan,
  input: CheckoutInput,
  fullName: string,
  reference: string,
): Promise<string> {
  const priceId = process.env[plan.priceEnv];
  if (!priceId) throw new Error(`${plan.priceEnv} fehlt — kein Stripe-Price hinterlegt`);

  const taxRate = process.env.STRIPE_TAX_RATE;
  if (!taxRate) throw new Error("STRIPE_TAX_RATE fehlt — MwSt-Satz nicht hinterlegt");
  await assertInclusiveTaxRate(taxRate, plan);

  const origin = await currentOrigin();

  const customer = (await stripePost(
    "/customers",
    {
      name: input.company || fullName,
      email: input.email,
      phone: input.phone || undefined,
      address: {
        line1: input.street,
        postal_code: input.postalCode,
        city: input.city,
        country: countryCode(input.country),
      },
      metadata: { reference, offer_slug: CHECKOUT_OFFER.slug },
    },
    // Zweimal Absenden darf keinen zweiten Kunden anlegen.
    `customer-${reference}`,
  )) as { id: string };

  const isSubscription = plan.mode === "subscription";

  const session = (await stripePost(
    "/checkout/sessions",
    {
      mode: plan.mode,
      customer: customer.id,
      locale: "de",
      // Preis kommt aus Stripe, Steuersatz kommt oben drauf. In Subscription-
      // Sessions gehören die Sätze ans Abo, nicht an die Position.
      line_items: [
        isSubscription
          ? { price: priceId, quantity: 1 }
          : { price: priceId, quantity: 1, tax_rates: [taxRate] },
      ],
      ...(isSubscription
        ? {
            subscription_data: {
              default_tax_rates: [taxRate],
              description: `${CHECKOUT_OFFER.name} — ${plan.installments} Raten`,
              metadata: { reference, plan_id: plan.id, installments: plan.installments },
            },
          }
        : {
            payment_intent_data: {
              description: `${CHECKOUT_OFFER.name} — ${reference}`,
              metadata: { reference, plan_id: plan.id },
            },
          }),
      success_url: `${origin}/checkout/danke?ref=${reference}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?abgebrochen=1`,
      metadata: {
        reference,
        offer_slug: CHECKOUT_OFFER.slug,
        plan_id: plan.id,
        installments: plan.installments,
        // Beweis der Zustimmung zum vorzeitigen Leistungsbeginn (§ 356 Abs. 4
        // BGB) — liegt damit unveränderbar bei Stripe.
        withdrawal_consent_at: new Date().toISOString(),
      },
    },
    `session-${reference}`,
  )) as { url?: string };

  if (!session.url) throw new Error("Stripe lieferte keine Checkout-URL");
  return session.url;
}

// Einmal pro Prozess geprüfte Steuersätze. Der Satz ändert sich nicht zwischen
// zwei Bestellungen — ein zusätzlicher Stripe-Request pro Kasse wäre verschenkt.
const verifiedInclusiveTaxRates = new Set<string>();

/**
 * Sicherung gegen den teuersten denkbaren Konfigurationsfehler: Die Seite zeichnet
 * Endpreise aus (1.000 € inkl. MwSt). Ist der Stripe-Steuersatz NICHT `inclusive`,
 * schlägt Stripe die 19 % oben drauf und bucht 1.190 € ab — der Käufer zahlt
 * 190 € mehr, als er zugestimmt hat.
 *
 * Deshalb: lieber die Kasse gar nicht öffnen (der Käufer sieht "Zahlungsseite
 * konnte nicht geöffnet werden") als den falschen Betrag einziehen.
 */
async function assertInclusiveTaxRate(taxRateId: string, plan: PaymentPlan): Promise<void> {
  if (verifiedInclusiveTaxRates.has(taxRateId)) return;

  const rate = (await stripeGet(`/tax_rates/${taxRateId}`)) as {
    inclusive?: boolean;
    percentage?: number;
  };

  if (rate.inclusive !== true) {
    const wrong = Math.round(plan.total * (1 + CHECKOUT_OFFER.vatRate) * 100) / 100;
    throw new Error(
      `STRIPE_TAX_RATE ${taxRateId} ist nicht inclusive — Stripe würde ${wrong} € statt ` +
        `${plan.total} € abbuchen. In Stripe einen Steuersatz mit "inklusive" anlegen ` +
        `und die Env darauf zeigen lassen.`,
    );
  }

  // Kein Abbruch: ein abweichender Satz ändert nur die Netto/MwSt-Aufteilung auf
  // der Rechnung, nicht den Gesamtbetrag. Sichtbar sein soll es trotzdem.
  const expected = Math.round(CHECKOUT_OFFER.vatRate * 100);
  if (typeof rate.percentage === "number" && Math.round(rate.percentage) !== expected) {
    console.error(
      `checkout: Stripe-Steuersatz ${rate.percentage} % weicht von vatRate ${expected} % ab — ` +
        `die Aufschlüsselung auf der Seite passt dann nicht zur Rechnung`,
    );
  }

  verifiedInclusiveTaxRates.add(taxRateId);
}

/** ISO-Ländercode für Stripe — das Formular bietet genau diese drei an. */
function countryCode(country: string): string {
  const map: Record<string, string> = { Deutschland: "DE", Österreich: "AT", Schweiz: "CH" };
  return map[country] ?? "DE";
}

/**
 * Basis-URL für success/cancel. Muss die Domain sein, auf der der Käufer
 * gerade steht (checkout1000.jeromederes.com ODER die CRM-Adresse) — sonst
 * landet er nach der Zahlung auf einem fremden Host.
 */
async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL || "https://crm.voltadigital.agency";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}
