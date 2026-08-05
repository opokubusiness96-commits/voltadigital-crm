// Öffentliche Checkout-Seite (/checkout) — Angebots-Konfiguration.
//
// Bewusst Code-Konfiguration (analog lib/products.ts): ein Angebot ändert sich
// selten und braucht keine eigene Tabelle. Die BESTELLUNGEN landen dagegen in
// der DB (public.checkout_orders, Migration 0017).
//
// WICHTIG: Alle Preise sind BRUTTO in EUR (inkl. MwSt). Der Client schickt beim
// Absenden nur die plan-ID — der Betrag wird IMMER serverseitig aus dieser Datei
// aufgelöst (app/checkout/actions.ts), nie aus dem Formular übernommen.

export type PaymentPlanId = "einmal" | "raten2";

export type PaymentPlan = {
  id: PaymentPlanId;
  label: string;
  hint: string;
  installments: number;
  /** Brutto pro Rate (inkl. MwSt) — das, was tatsächlich abgebucht wird. */
  installmentAmount: number;
  /** Brutto gesamt — bei allen Plänen identisch, kein Ratenaufschlag. */
  total: number;
  /**
   * Name der Env-Variable mit der Stripe-Price-ID. Der abgerechnete Betrag steht
   * damit in Stripe, nicht im Code — die Zahlen hier sind nur die Anzeige.
   *
   * WICHTIG: Der Betrag im Stripe-Price ist der BRUTTO-Endbetrag (1.000 € bzw.
   * 500 € pro Rate). Damit Stripe daraus nicht 1.190 € macht, MUSS der Steuersatz
   * hinter STRIPE_TAX_RATE `inclusive: true` sein — die 19 % sind im Betrag
   * enthalten und werden nur herausgerechnet. createStripeCheckout prüft das vor
   * jeder Session und bricht ab, statt zu viel abzubuchen.
   */
  priceEnv: string;
  /**
   * `payment` = eine Zahlung. `subscription` = echte Raten: monatlicher Preis,
   * der nach der letzten Rate automatisch endet (cancel_at wird gesetzt, sobald
   * die Session bezahlt ist — siehe app/checkout/fulfill.ts).
   */
  mode: "payment" | "subscription";
};

/** Kontaktadresse auf Seite, Danke-Seite und in der Bestätigungs-Mail. */
export const CONTACT_EMAIL = "coaching@jeromederes.com";

export type CheckoutOffer = {
  slug: string;
  /** organizations.slug, unter der die Bestellung im CRM landet. */
  orgSlug: string;
  name: string;
  tagline: string;
  description: string;
  /** Anzahl der enthaltenen Sessions (für "5 × 60 Min" + Preis pro Session) */
  sessionCount: number;
  /** Dauer einer Session in Minuten */
  sessionMinutes: number;
  /**
   * ENDPREIS in EUR — genau der Betrag, den der Kunde zahlt. Nichts kommt
   * obendrauf.
   */
  price: number;
  /**
   * Umsatzsteuersatz. **0 = es wird keine Umsatzsteuer ausgewiesen** (z. B.
   * Kleinunternehmerregelung § 19 UStG): Die Seite zeigt dann weder eine
   * Netto/Steuer-Aufteilung noch einen MwSt-Hinweis, und an der Stripe-Kasse
   * hängt kein Steuersatz — der Kunde zahlt glatt `price`.
   *
   * Wird später doch Umsatzsteuer fällig, reicht hier 0.19 — Anzeige,
   * Aufschlüsselung und der Stripe-Steuersatz schalten sich mit. Der Preis
   * bleibt dabei der Endbetrag, die Steuer ist dann darin enthalten.
   */
  vatRate: number;
  currency: "EUR";
  includes: string[];
  plans: PaymentPlan[];
};

export const CHECKOUT_OFFER: CheckoutOffer = {
  slug: "jerome-5x60-1000",
  orgSlug: "jerome",
  name: "5er-Paket 1:1 Sessions",
  tagline: "5 × 60 Minuten mit Jerome Deres",
  description:
    "Fünf persönliche 1:1-Sessions à 60 Minuten mit Jerome Deres. Jede Session " +
    "hat eine eigene Agenda — an dem, woran du gerade wirklich arbeitest, statt " +
    "an einem Standardprogramm.",
  sessionCount: 5,
  sessionMinutes: 60,
  price: 1000,
  vatRate: 0,
  currency: "EUR",
  includes: [
    "5 × 60 Minuten 1:1 Session mit Jerome (per Zoom)",
    "Termine flexibel in deinem Tempo — z. B. wöchentlich",
    "Eigene Agenda pro Session statt festem Programm",
    "Aufzeichnung und Notizen nach jeder Session",
    "Konkrete Umsetzungs-Schritte zwischen den Terminen",
  ],
  plans: [
    {
      id: "einmal",
      label: "Einmalzahlung",
      hint: "Komplett in einer Zahlung — Karte, Klarna, SEPA oder Link.",
      installments: 1,
      installmentAmount: 1000,
      total: 1000,
      priceEnv: "STRIPE_PRICE_CHECKOUT_ONCE",
      mode: "payment",
    },
    {
      id: "raten2",
      label: "2 Raten",
      hint: "Erste Rate sofort, zweite Rate 30 Tage später. Kein Aufschlag.",
      installments: 2,
      installmentAmount: 500,
      total: 1000,
      priceEnv: "STRIPE_PRICE_CHECKOUT_2X",
      // Karte oder SEPA-Lastschrift: Klarna kann keine wiederkehrende Zahlung,
      // Stripe blendet es im Raten-Checkout deshalb selbst aus.
      mode: "subscription",
    },
  ],
};

export function findPlan(id: string | null | undefined): PaymentPlan | null {
  return CHECKOUT_OFFER.plans.find((p) => p.id === id) ?? null;
}

/** Preis je Session — Ankerpreis neben der Gesamtsumme. */
export function pricePerSession(offer: CheckoutOffer = CHECKOUT_OFFER): number {
  return Math.round((offer.price / offer.sessionCount) * 100) / 100;
}

/**
 * Wird überhaupt Umsatzsteuer ausgewiesen? Steuert die Anzeige (Aufschlüsselung
 * und "inkl. MwSt."-Hinweise) UND ob an der Stripe-Kasse ein Steuersatz hängt.
 */
export function chargesVat(offer: CheckoutOffer = CHECKOUT_OFFER): boolean {
  return offer.vatRate > 0;
}

/** Nettoanteil des Endpreises. Ohne Umsatzsteuer identisch mit dem Preis. */
export function netPrice(offer: CheckoutOffer = CHECKOUT_OFFER): number {
  return vatSplit(offer.price, offer.vatRate).net;
}

/** Im Endpreis ENTHALTENE MwSt — kommt nicht obendrauf. Ohne Steuer: 0. */
export function vatAmount(offer: CheckoutOffer = CHECKOUT_OFFER): number {
  return vatSplit(offer.price, offer.vatRate).vat;
}

/**
 * Hinweis unter dem Preis, wenn keine Umsatzsteuer ausgewiesen wird. Wer als
 * Kleinunternehmer verkauft, muss den Grund nennen — deshalb per Env
 * überschreibbar, z. B. "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."
 */
export const NO_VAT_NOTE =
  process.env.NEXT_PUBLIC_CHECKOUT_VAT_NOTE || "Keine Umsatzsteuer ausgewiesen.";

// Kein grossPrice() mehr: `price` IST der Endbetrag. Eine Funktion, die nur
// ihren eigenen Eingabewert zurückgibt, verleitet zu der Annahme, der Preis wäre
// netto — genau die Verwechslung, die hier 190 € gekostet hätte.

// ── Rechtstexte ──────────────────────────────────────────────────────────────
// Ein Checkout, der an Verbraucher verkauft, muss AGB, Datenschutzerklärung,
// Widerrufsbelehrung und Impressum verlinken. Die URLs kommen aus der Env, damit
// sie auf die bestehenden Seiten (z. B. jeromederes.com/agb) zeigen können.
// NEXT_PUBLIC_*, weil das Formular eine Client Component ist.
// Nicht gesetzte Links werden als reiner Text gerendert — lieber kein Link als
// ein toter Link.

export type LegalDoc = "agb" | "privacy" | "withdrawal" | "imprint";

export const LEGAL_LABEL: Record<LegalDoc, string> = {
  agb: "AGB",
  privacy: "Datenschutzerklärung",
  withdrawal: "Widerrufsbelehrung",
  imprint: "Impressum",
};

export const LEGAL_URL: Record<LegalDoc, string | null> = {
  agb: process.env.NEXT_PUBLIC_LEGAL_AGB_URL || null,
  privacy: process.env.NEXT_PUBLIC_LEGAL_PRIVACY_URL || null,
  withdrawal: process.env.NEXT_PUBLIC_LEGAL_WITHDRAWAL_URL || null,
  imprint: process.env.NEXT_PUBLIC_LEGAL_IMPRINT_URL || null,
};

/** Netto/MwSt-Aufteilung eines Brutto-Betrags (kaufmännisch auf Cent gerundet). */
export function vatSplit(gross: number, rate: number): { net: number; vat: number } {
  const net = Math.round((gross / (1 + rate)) * 100) / 100;
  return { net, vat: Math.round((gross - net) * 100) / 100 };
}

/** Preisformat mit Cent — lib/utils formatEUR rundet bewusst auf volle Euro. */
export function formatPrice(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ── Formular-Daten ───────────────────────────────────────────────────────────

export type CheckoutInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  vatId: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  planId: string;
  notes: string;
  acceptTerms: boolean;
  acceptWithdrawal: boolean;
  // Attribution aus der URL (?utm_source=…) — landet mit an der Bestellung.
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
};

export type FieldErrors = Partial<Record<keyof CheckoutInput, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validierung — läuft in der Server Action (Quelle der Wahrheit) und im Client
 * für sofortiges Feedback. Deshalb bewusst frei von Server-Imports.
 */
export function validateCheckout(input: CheckoutInput): FieldErrors {
  const errors: FieldErrors = {};
  const req = (v: string) => v.trim().length > 0;

  if (!req(input.firstName)) errors.firstName = "Vorname fehlt.";
  if (!req(input.lastName)) errors.lastName = "Nachname fehlt.";
  if (!EMAIL_RE.test(input.email.trim())) errors.email = "Bitte eine gültige E-Mail-Adresse angeben.";
  if (input.phone.replace(/[^\d]/g, "").length < 6) errors.phone = "Bitte eine erreichbare Telefonnummer angeben.";
  if (!req(input.street)) errors.street = "Straße und Hausnummer fehlen.";
  if (!req(input.postalCode)) errors.postalCode = "PLZ fehlt.";
  if (!req(input.city)) errors.city = "Ort fehlt.";
  if (!req(input.country)) errors.country = "Land fehlt.";
  if (!findPlan(input.planId)) errors.planId = "Bitte ein Zahlungsmodell wählen.";
  if (!input.acceptTerms) errors.acceptTerms = "Bitte AGB und Datenschutz bestätigen.";
  if (!input.acceptWithdrawal) errors.acceptWithdrawal = "Bitte die Widerrufsbelehrung bestätigen.";

  return errors;
}

/**
 * Bestellnummer, z. B. "JD-2608-K3F9". Kein fortlaufender Zähler — die Eindeutigkeit
 * erzwingt der unique-Index auf checkout_orders.reference (Action retryt bei Kollision).
 */
export function makeOrderReference(now: Date, rand: () => number = Math.random): string {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne I/O/0/1
  let tail = "";
  for (let i = 0; i < 4; i++) tail += alphabet[Math.floor(rand() * alphabet.length)];
  return `JD-${yy}${mm}-${tail}`;
}
