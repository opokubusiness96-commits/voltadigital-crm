import { formatPrice } from "./checkout";

/**
 * Angebotsübersicht für die allgemeine Checkout-Seite (/angebote).
 *
 * Drei Wege ins Coaching nebeneinander. Bewusst als Code-Konfiguration wie
 * lib/checkout.ts: das Sortiment ändert sich selten, und ein Preis, der an
 * einer Stelle steht, kann nicht an zwei Stellen auseinanderlaufen.
 *
 * WICHTIG — warum das 12-Wochen-Programm NICHT in Stunden ausgezeichnet ist:
 * Bei 249 € je Einzelstunde wären zwölf Stunden 2.988 €, das Programm kostet
 * 4.999 €. Als "12 Stunden" verkauft, rechnete das jeder Interessent in
 * Sekunden nach und die ganze Preisliste verlöre Glaubwürdigkeit. Verkauft
 * werden deshalb WOCHEN, nicht Stunden: zwölf Wochen durchgehende Begleitung,
 * Community und WhatsApp-Support. Das sind Leistungen, die eine einzelne
 * Stunde gar nicht enthält — damit trägt das "bestes Preis-Leistungs-
 * Verhältnis" auf dieser Stufe und ist kein Stundenpreis-Versprechen.
 *
 * Die Staffel soll den Aufstieg lohnend machen, jede Stufe legt sichtbar nach:
 *   Einzelstunde  249 €      die Stunde, sonst nichts
 *   5er-Paket   1.000 €      200 € statt 249 € je Stunde → 245 € gespart
 *   12 Wochen   4.999 €      alles davon + Community + WhatsApp + 12 Wochen
 *                            durchgehend statt loser Termine
 * Wer hier etwas ändert: die Ersparnis im Badge des 5er-Pakets ist gerechnet
 * (5 × 249 − 1.000 = 245) und muss beim nächsten Preis mitgezogen werden.
 */

export type OfferId = "einzelstunde" | "paket5" | "programm12";

export type Offer = {
  id: OfferId;
  name: string;
  tagline: string;
  /** Preis EINER Einheit in EUR — Endpreis, es kommt nichts obendrauf. */
  unitPrice: number;
  /** Was eine Einheit ist ("Stunde"), wenn die Menge wählbar ist. */
  unitLabel?: string;
  /** Menge frei wählbar? Sonst genau eine Einheit. */
  quantity?: { min: number; max: number };
  priceEnv: string;
  mode: "payment" | "subscription";
  badge?: string;
  highlight?: boolean;
  includes: string[];
  /** Fussnote unter der Kachel, z. B. der Hinweis aufs günstigere Paket. */
  note?: string;
  /**
   * Was in der Bestätigungs-Mail unter "Wie es weitergeht" steht.
   *
   * Bewusst hier und nicht in der Brevo-Vorlage: eine einzelne Stunde,
   * fünf Sessions und ein Zwölf-Wochen-Programm brauchen unterschiedliche
   * Ansagen, und wer ein viertes Angebot anlegt, soll keine Vorlage
   * nachziehen müssen. `{n}` wird durch die gebuchte Menge ersetzt.
   */
  mailNextSteps: string;
};

export const OFFERS: Offer[] = [
  {
    id: "einzelstunde",
    name: "Einzelstunde",
    tagline: "60 Minuten 1:1 — zum Reinkommen",
    unitPrice: 249,
    unitLabel: "Stunde",
    // Ab der fünften Stunde ist das Paket günstiger. Der Regler endet genau
    // davor, statt den Kunden teurer buchen zu lassen als nötig.
    quantity: { min: 1, max: 4 },
    priceEnv: "STRIPE_PRICE_HOUR",
    mode: "payment",
    includes: [
      "60 Minuten 1:1 per Zoom",
      "Eigene Agenda — an dem, woran du gerade arbeitest",
      "Aufzeichnung und Notizen danach",
    ],
    note: "Ab 5 Stunden zahlst du im Paket weniger — und bekommst mehr dazu.",
    mailNextSteps:
      "Jerome meldet sich innerhalb von 24 Stunden persönlich bei dir und ihr legt den Termin " +
      "für deine {n} fest. Bring mit, woran du gerade arbeitest — die Stunde gehört komplett dir.",
  },
  {
    id: "paket5",
    name: "5er-Paket",
    tagline: "5 × 60 Minuten in deinem Tempo",
    unitPrice: 1000,
    priceEnv: "STRIPE_PRICE_CHECKOUT_ONCE",
    mode: "payment",
    badge: "Spare 245 €",
    includes: [
      "5 × 60 Minuten 1:1 Session mit Jerome (per Zoom)",
      "Termine flexibel in deinem Tempo — z. B. wöchentlich",
      "Eigene Agenda pro Session statt festem Programm",
      "Aufzeichnung und Notizen nach jeder Session",
      "Konkrete Umsetzungs-Schritte zwischen den Terminen",
    ],
    note: "200 € statt 249 € pro Stunde. In 2 oder 3 Raten zahlbar, ohne Aufschlag.",
    mailNextSteps:
      "Jerome meldet sich innerhalb von 24 Stunden persönlich bei dir. Ihr legt gemeinsam den " +
      "ersten Termin fest, die weiteren vier Sessions planst du flexibel in deinem Tempo dazu — " +
      "viele nehmen wöchentlich, manche alle zwei Wochen.",
  },
  {
    id: "programm12",
    name: "12 Wochen Intensiv",
    tagline: "12 Wochen Begleitung, Community und WhatsApp-Support",
    unitPrice: 4999,
    priceEnv: "STRIPE_PRICE_PROGRAM12",
    mode: "payment",
    badge: "Bestes Preis-Leistungs-Verhältnis",
    highlight: true,
    includes: [
      "12 Wochen durchgehende Begleitung, wöchentliche 1:1-Sessions",
      "WhatsApp-Support direkt mit Jerome — auch zwischen den Terminen",
      "Zugang zur Community, der dir nach den zwölf Wochen bleibt",
      "Arbeitsmaterial und Aufzeichnungen zu jeder Session",
      "Gemeinsamer Plan über die volle Strecke statt loser Einzeltermine",
    ],
    note: "Alles aus dem 5er-Paket plus Community und WhatsApp-Support — und Jerome bleibt zwölf Wochen an deiner Seite statt nur im Termin.",
    mailNextSteps:
      "Jerome meldet sich innerhalb von 24 Stunden persönlich bei dir. Ihr setzt den Startpunkt " +
      "und den Plan über die zwölf Wochen auf. Deinen Community-Zugang und den WhatsApp-Draht zu " +
      "Jerome bekommst du separat per E-Mail — die Community bleibt dir auch nach dem Programm.",
  },
];

export function findOffer(id: string | null | undefined): Offer | null {
  return OFFERS.find((o) => o.id === id) ?? null;
}

/** Gesamtpreis eines Angebots bei gewählter Menge. */
export function offerTotal(offer: Offer, quantity = 1): number {
  return Math.round(offer.unitPrice * clampQuantity(offer, quantity) * 100) / 100;
}

/** Menge auf den erlaubten Bereich zwingen — die kommt aus dem Browser. */
export function clampQuantity(offer: Offer, quantity: number): number {
  if (!offer.quantity) return 1;
  const n = Math.trunc(Number(quantity));
  if (!Number.isFinite(n)) return offer.quantity.min;
  return Math.min(offer.quantity.max, Math.max(offer.quantity.min, n));
}

/** Anzeige unter dem Preis, z. B. "249 € pro Stunde". */
export function offerUnitLine(offer: Offer, quantity = 1): string | null {
  if (!offer.unitLabel) return null;
  const n = clampQuantity(offer, quantity);
  return `${formatPrice(offer.unitPrice)} pro ${offer.unitLabel}${n > 1 ? ` · ${n} Stunden` : ""}`;
}

/**
 * Angebot zu einer Bestellung finden.
 *
 * `offer_slug` trägt bei Bestellungen von /angebote die Offer-ID, bei den
 * älteren vom 5er-Checkout dagegen den Angebots-Slug aus lib/checkout.ts.
 * Beide Wege müssen dieselbe Mail auslösen — deshalb hier beide abgedeckt.
 */
export function offerForOrderSlug(slug: string | null | undefined): Offer | null {
  if (!slug) return null;
  return (
    OFFERS.find((o) => o.id === slug) ??
    (slug === "jerome-5x60-1000" ? OFFERS.find((o) => o.id === "paket5") ?? null : null)
  );
}

/** "deine Stunde" / "deine 3 Stunden" — für Fliesstext in der Mail. */
export function unitPhrase(offer: Offer, quantity: number): string {
  if (!offer.unitLabel) return offer.name;
  return quantity > 1 ? `${quantity} ${offer.unitLabel}n` : offer.unitLabel;
}

/** Text für "Wie es weitergeht" mit eingesetzter Menge. */
export function mailNextSteps(offer: Offer, quantity: number): string {
  return offer.mailNextSteps.replace("{n}", unitPhrase(offer, quantity));
}
