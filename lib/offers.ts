import { formatPrice } from "./checkout";

/**
 * Angebotsübersicht für die allgemeine Checkout-Seite (/angebote).
 *
 * Drei Wege ins Coaching nebeneinander. Bewusst als Code-Konfiguration wie
 * lib/checkout.ts: das Sortiment ändert sich selten, und ein Preis, der an
 * einer Stelle steht, kann nicht an zwei Stellen auseinanderlaufen.
 *
 * WICHTIG — warum das 12-Wochen-Programm NICHT in Stunden ausgezeichnet ist:
 * Bei 249 € je Einzelstunde wären zwölf Stunden 2.988 €. Das Programm kostet
 * 4.999 €. Würde es als "12 Stunden" verkauft, rechnete das jeder Interessent
 * in Sekunden nach und die ganze Preisliste verlöre Glaubwürdigkeit. Verkauft
 * wird deshalb das PROGRAMM — Begleitung über zwölf Wochen, Community, Support
 * zwischen den Terminen. Das "bestes Preis-Leistungs-Verhältnis"-Etikett trägt
 * aus demselben Grund das 5er-Paket: dort stimmt die Rechnung (200 € statt
 * 249 € je Stunde).
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
    note: "Ab 5 Stunden zahlst du im Paket weniger.",
  },
  {
    id: "paket5",
    name: "5er-Paket",
    tagline: "5 × 60 Minuten in deinem Tempo",
    unitPrice: 1000,
    priceEnv: "STRIPE_PRICE_CHECKOUT_ONCE",
    mode: "payment",
    badge: "Bestes Preis-Leistungs-Verhältnis",
    includes: [
      "5 × 60 Minuten 1:1 Session mit Jerome (per Zoom)",
      "Termine flexibel in deinem Tempo — z. B. wöchentlich",
      "Eigene Agenda pro Session statt festem Programm",
      "Aufzeichnung und Notizen nach jeder Session",
      "Konkrete Umsetzungs-Schritte zwischen den Terminen",
    ],
    note: "200 € pro Stunde statt 249 € — auch in 2 oder 3 Raten zahlbar.",
  },
  {
    id: "programm12",
    name: "12 Wochen Intensiv",
    tagline: "Das komplette Programm mit Community",
    unitPrice: 4999,
    priceEnv: "STRIPE_PRICE_PROGRAM12",
    mode: "payment",
    badge: "Komplettprogramm",
    highlight: true,
    includes: [
      "12 Wochen durchgehende Begleitung, wöchentliche 1:1-Sessions",
      "Zugang zur Community — auch nach den zwölf Wochen",
      "Support zwischen den Terminen, nicht nur im Call",
      "Arbeitsmaterial und Aufzeichnungen zu jeder Session",
      "Gemeinsamer Plan über die volle Strecke statt Einzelterminen",
    ],
    note: "Ratenzahlung auf Anfrage — schreib uns vor der Buchung.",
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
