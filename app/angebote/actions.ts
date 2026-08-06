"use server";

import { headers } from "next/headers";

import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { stripeGet, stripePost } from "@/lib/stripe";
import { CHECKOUT_OFFER, makeOrderReference } from "@/lib/checkout";
import { clampQuantity, findOffer, offerTotal, type Offer } from "@/lib/offers";

export type OfferCheckoutResult =
  | { ok: true; reference: string; url: string }
  | { ok: false; error: string };

/**
 * Kasse für die Angebotsübersicht.
 *
 * Gleiche Regeln wie beim 5er-Checkout: kein Formular, Stripe erhebt die
 * Kundendaten, und der Betrag kommt NIE aus dem Browser. Von dort kommen nur
 * Angebots-ID und Menge — beide werden hier gegen die Konfiguration geprüft.
 *
 * Die Bestellung landet in denselben `checkout_orders` wie der 5er-Checkout,
 * damit Erfüllung, Webhook und Bestätigungsmail unverändert weiterlaufen.
 */
export async function startOfferCheckout(
  rawOfferId: unknown,
  rawQuantity: unknown,
): Promise<OfferCheckoutResult> {
  const offer = findOffer(typeof rawOfferId === "string" ? rawOfferId : null);
  if (!offer) return { ok: false, error: "Bitte ein Angebot wählen." };

  const quantity = clampQuantity(offer, Number(rawQuantity) || 1);
  const total = offerTotal(offer, quantity);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("angebote: Supabase-Env fehlt");
    return { ok: false, error: "Bestellung konnte nicht gespeichert werden. Bitte per E-Mail melden." };
  }

  const admin = getSupabaseServiceRole();
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", CHECKOUT_OFFER.orgSlug)
    .maybeSingle();

  if (orgError || !org?.id) {
    console.error("angebote: Org nicht gefunden", orgError?.message);
    return { ok: false, error: "Bestellung konnte nicht gespeichert werden. Bitte per E-Mail melden." };
  }

  let reference = "";
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const candidate = makeOrderReference(new Date());
    const { error } = await admin.from("checkout_orders").insert({
      org_id: org.id as string,
      reference: candidate,
      offer_slug: offer.id,
      // Menge gehört in den Namen, sonst steht im CRM "Einzelstunde" bei einer
      // Bestellung über vier Stunden.
      offer_name: quantity > 1 ? `${offer.name} × ${quantity}` : offer.name,
      plan_id: "einmal",
      installments: 1,
      amount_gross: total,
      vat_rate: CHECKOUT_OFFER.vatRate,
      currency: "EUR",
      // Kundendaten kennt erst Stripe — siehe app/checkout/actions.ts.
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
    console.error("angebote: insert fehlgeschlagen", lastError);
    return { ok: false, error: "Bestellung konnte nicht gespeichert werden. Bitte per E-Mail melden." };
  }

  try {
    const url = await createOfferSession(offer, quantity, reference);
    return { ok: true, reference, url };
  } catch (err) {
    console.error("angebote: Stripe-Session fehlgeschlagen", reference, err);
    return { ok: false, error: "Die Zahlungsseite konnte nicht geöffnet werden. Bitte nochmal versuchen." };
  }
}

const verified = new Set<string>();

/**
 * Der ausgezeichnete Preis steht im Code, abgebucht wird der Stripe-Price.
 * Zwei Quellen, die auseinanderlaufen können — genau das ist auf der
 * 1.000-€-Seite schon passiert. Deshalb vor der ersten Kasse vergleichen und
 * lieber gar nicht öffnen, als einen anderen Betrag abzubuchen.
 */
async function assertUnitPrice(priceId: string, offer: Offer): Promise<void> {
  if (verified.has(priceId)) return;

  const price = (await stripeGet(`/prices/${priceId}`)) as {
    unit_amount?: number | null;
    currency?: string;
    active?: boolean;
    recurring?: unknown;
  };

  const expected = Math.round(offer.unitPrice * 100);
  if (price.unit_amount !== expected) {
    const actual = typeof price.unit_amount === "number" ? price.unit_amount / 100 : "unbekannt";
    throw new Error(
      `${offer.priceEnv} (${priceId}) steht auf ${actual} €, die Seite zeigt ${offer.unitPrice} €.`,
    );
  }
  if (price.currency && price.currency.toLowerCase() !== "eur") {
    throw new Error(`${offer.priceEnv} (${priceId}) ist nicht in EUR`);
  }
  if (price.active === false) throw new Error(`${offer.priceEnv} (${priceId}) ist archiviert`);
  if (offer.mode === "payment" && price.recurring) {
    throw new Error(`${offer.priceEnv} (${priceId}) ist wiederkehrend, erwartet wird einmalig`);
  }

  verified.add(priceId);
}

async function createOfferSession(
  offer: Offer,
  quantity: number,
  reference: string,
): Promise<string> {
  const priceId = process.env[offer.priceEnv];
  if (!priceId) throw new Error(`${offer.priceEnv} fehlt — kein Stripe-Price hinterlegt`);
  await assertUnitPrice(priceId, offer);

  const origin = await currentOrigin();

  const session = (await stripePost(
    "/checkout/sessions",
    {
      mode: offer.mode,
      locale: "de",
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      customer_creation: "always",
      line_items: [{ price: priceId, quantity }],
      payment_intent_data: {
        description: `${offer.name}${quantity > 1 ? ` × ${quantity}` : ""} — ${reference}`,
        metadata: { reference, offer_id: offer.id, quantity },
      },
      success_url: `${origin}/checkout/danke?ref=${reference}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/angebote?abgebrochen=1`,
      custom_text: {
        submit: {
          message:
            "Das Coaching beginnt auf deinen ausdrücklichen Wunsch vor Ablauf der " +
            "Widerrufsfrist. Bestellnummer " + reference + ".",
        },
      },
      metadata: {
        reference,
        offer_id: offer.id,
        quantity,
        // Beweis der Zustimmung zum vorzeitigen Leistungsbeginn (§ 356 Abs. 4 BGB).
        withdrawal_consent_at: new Date().toISOString(),
      },
    },
    `offer-${reference}`,
  )) as { url?: string };

  if (!session.url) throw new Error("Stripe lieferte keine Checkout-URL");
  return session.url;
}

async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL || "https://crm.voltadigital.agency";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}
