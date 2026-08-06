"use server";

import { headers } from "next/headers";

import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { stripeGet, stripePost } from "@/lib/stripe";
import {
  CHECKOUT_OFFER,
  chargesVat,
  findPlan,
  makeOrderReference,
  planTotal,
  type PaymentPlan,
} from "@/lib/checkout";

export type CheckoutResult =
  | { ok: true; reference: string; url: string }
  | { ok: false; error: string };

function isDevFake(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEV_FAKE_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

const trim = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * Kasse öffnen.
 *
 * Der Käufer füllt bei uns KEIN Formular mehr aus — er wählt das
 * Zahlungsmodell, bestätigt die Rechtstexte und landet direkt bei Stripe.
 * Name, E-Mail, Telefon und Rechnungsadresse sammelt Stripe ein; dort sind sie
 * ohnehin nötig, und Apple Pay oder Google Pay füllen sie mit einem Tipp.
 *
 * Die Bestellung entsteht hier bereits — mit Referenz, Angebots-Snapshot und
 * Status "offen", aber ohne Kundendaten: die kennen wir vor der Zahlung nicht.
 * Sie werden aus der bezahlten Stripe-Session nachgetragen
 * (app/checkout/fulfill.ts), zusammen mit Lead, Activity und Bestätigungs-Mail.
 * Ein Abbruch an der Kasse hinterlässt damit keinen gewonnenen Deal.
 *
 * Preis und Raten kommen NIE vom Client, sondern aus lib/checkout.ts und dem
 * Stripe-Price dahinter — der Browser schickt ausschliesslich die Plan-ID.
 */
export async function startCheckout(rawPlanId: unknown): Promise<CheckoutResult> {
  const plan = findPlan(trim(rawPlanId, 20));
  if (!plan) return { ok: false, error: "Bitte ein Zahlungsmodell wählen." };

  if (isDevFake()) {
    const reference = makeOrderReference(new Date());
    return { ok: true, reference, url: `/checkout/danke?ref=${reference}` };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("checkout: Supabase-Env fehlt (URL / SERVICE_ROLE_KEY)");
    return { ok: false, error: "Bestellung konnte nicht gespeichert werden. Bitte per E-Mail melden." };
  }

  const admin = getSupabaseServiceRole();

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

  // Bestellnummer eindeutig würfeln; reference ist unique.
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
      amount_gross: planTotal(plan),
      vat_rate: CHECKOUT_OFFER.vatRate,
      currency: "EUR",
      // Kundendaten sind vor der Zahlung schlicht unbekannt. Die Spalten sind
      // NOT NULL (Migration 0017, aus der Formular-Zeit) — deshalb leer statt
      // erfunden. fulfillPaidOrder() trägt sie aus der Stripe-Session nach.
      first_name: "",
      last_name: "",
      email: "",
      street: "",
      postal_code: "",
      city: "",
      status: "offen",
      lead_id: null,
    });

    if (!error) {
      reference = candidate;
      break;
    }
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
    const url = await createStripeCheckout(plan, reference);
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
 * Stripe-Kasse für diese Bestellung.
 *
 * Kein vorab angelegter Customer mehr: Stripe erhebt Name, E-Mail, Telefon und
 * Rechnungsadresse selbst. Damit stehen Apple Pay, Google Pay, Klarna und Link
 * ohne Umweg zur Verfügung — die füllen genau diese Felder mit einem Tipp, und
 * jedes Feld, das wir vorher abfragen, ist ein Grund mehr abzuspringen.
 *
 * `payment_method_types` wird bewusst NICHT gesetzt: Stripe zeigt dann alles an,
 * was im Konto aktiv und für diesen Kauf zulässig ist. Bei den Ratenmodellen
 * (Abo) schränkt Stripe selbst auf wiederkehrungsfähige Methoden ein.
 */
async function createStripeCheckout(plan: PaymentPlan, reference: string): Promise<string> {
  const priceId = process.env[plan.priceEnv];
  if (!priceId) throw new Error(`${plan.priceEnv} fehlt — kein Stripe-Price hinterlegt`);
  await assertPriceMatchesPlan(priceId, plan);

  // Ohne ausgewiesene Umsatzsteuer (vatRate 0) hängt an der Kasse KEIN
  // Steuersatz — der Kunde zahlt glatt den Preis aus dem Stripe-Price.
  let taxRate: string | null = null;
  if (chargesVat()) {
    taxRate = process.env.STRIPE_TAX_RATE || null;
    if (!taxRate) throw new Error("STRIPE_TAX_RATE fehlt — MwSt-Satz nicht hinterlegt");
    await assertInclusiveTaxRate(taxRate, plan);
  } else if (process.env.STRIPE_TAX_RATE) {
    // Übrig gebliebene Env nach der Umstellung: bewusst ignoriert, aber sichtbar.
    console.warn(
      "checkout: STRIPE_TAX_RATE ist gesetzt, das Angebot weist aber keine Umsatzsteuer aus " +
        "(vatRate 0) — der Satz wird nicht angewendet. Env entfernen oder vatRate setzen.",
    );
  }

  const origin = await currentOrigin();

  const isSubscription = plan.mode === "subscription";

  const session = (await stripePost(
    "/checkout/sessions",
    {
      mode: plan.mode,
      locale: "de",
      // Rechnungsadresse ist Pflicht, weil daraus eine Rechnung entsteht.
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      // Im Abo-Modus legt Stripe den Kunden ohnehin an.
      ...(isSubscription ? {} : { customer_creation: "always" }),
      // Der Betrag kommt aus dem Stripe-Price. Ein Steuersatz wird nur angehängt,
      // wenn das Angebot überhaupt Umsatzsteuer ausweist — in Subscription-
      // Sessions gehört er ans Abo, nicht an die Position.
      line_items: [
        isSubscription || !taxRate
          ? { price: priceId, quantity: 1 }
          : { price: priceId, quantity: 1, tax_rates: [taxRate] },
      ],
      ...(isSubscription
        ? {
            subscription_data: {
              ...(taxRate ? { default_tax_rates: [taxRate] } : {}),
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
      // Der Widerrufshinweis steht direkt über dem Bezahlen-Button, nicht nur
      // auf der Seite davor — dort trifft der Käufer die Entscheidung.
      custom_text: {
        submit: {
          message:
            "Das Coaching beginnt auf deinen ausdrücklichen Wunsch vor Ablauf der " +
            "Widerrufsfrist. Bestellnummer " + reference + ".",
        },
      },
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

// Einmal pro Prozess geprüfte Stripe-Objekte. Preis und Steuersatz ändern sich
// nicht zwischen zwei Bestellungen — ein Request pro Kasse wäre verschenkt.
const verifiedPrices = new Set<string>();
const verifiedInclusiveTaxRates = new Set<string>();

/**
 * Der Betrag auf der Seite kommt aus `lib/checkout.ts`, abgebucht wird der
 * Betrag aus dem Stripe-Price. Das sind zwei Quellen, die auseinanderlaufen
 * können — genau das ist hier schon einmal passiert (Seite 1.000 €, Kasse
 * 1.190 €).
 *
 * Deshalb: vor der ersten Kasse den Preis bei Stripe lesen und mit dem
 * ausgezeichneten Ratenbetrag vergleichen. Bei Abweichung geht die Kasse nicht
 * auf — der Käufer sieht "Zahlungsseite konnte nicht geöffnet werden", statt
 * einen anderen Betrag zu zahlen, als er bestätigt hat.
 */
async function assertPriceMatchesPlan(priceId: string, plan: PaymentPlan): Promise<void> {
  if (verifiedPrices.has(priceId)) return;

  const price = (await stripeGet(`/prices/${priceId}`)) as {
    unit_amount?: number | null;
    currency?: string;
    active?: boolean;
    recurring?: { interval?: string } | null;
  };

  const expectedCents = Math.round(plan.installmentAmount * 100);
  if (price.unit_amount !== expectedCents) {
    const actual = typeof price.unit_amount === "number" ? price.unit_amount / 100 : "unbekannt";
    throw new Error(
      `${plan.priceEnv} (${priceId}) steht auf ${actual} €, die Seite zeigt aber ` +
        `${plan.installmentAmount} € pro Rate. Betrag in Stripe korrigieren oder ` +
        `installmentAmount in lib/checkout.ts anpassen.`,
    );
  }

  if (price.currency && price.currency.toLowerCase() !== CHECKOUT_OFFER.currency.toLowerCase()) {
    throw new Error(`${plan.priceEnv} (${priceId}) ist in ${price.currency}, erwartet wird EUR`);
  }

  // Raten brauchen einen wiederkehrenden Preis, die Einmalzahlung darf keiner sein —
  // sonst nimmt Stripe die Session gar nicht erst an bzw. bucht dauerhaft ab.
  const isRecurring = !!price.recurring;
  const shouldRecur = plan.mode === "subscription";
  if (isRecurring !== shouldRecur) {
    throw new Error(
      `${plan.priceEnv} (${priceId}) ist ${isRecurring ? "wiederkehrend" : "einmalig"}, ` +
        `der Plan "${plan.id}" braucht ${shouldRecur ? "einen monatlichen" : "einen einmaligen"} Preis`,
    );
  }

  if (price.active === false) {
    throw new Error(`${plan.priceEnv} (${priceId}) ist in Stripe archiviert`);
  }

  verifiedPrices.add(priceId);
}

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
    const total = planTotal(plan);
    const wrong = Math.round(total * (1 + CHECKOUT_OFFER.vatRate) * 100) / 100;
    throw new Error(
      `STRIPE_TAX_RATE ${taxRateId} ist nicht inclusive — Stripe würde ${wrong} € statt ` +
        `${total} € abbuchen. In Stripe einen Steuersatz mit "inklusive" anlegen ` +
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
