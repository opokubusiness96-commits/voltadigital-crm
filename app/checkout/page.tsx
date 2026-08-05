import type { Metadata } from "next";
import { Check, Clock, ShieldCheck, Video } from "lucide-react";
import {
  CHECKOUT_OFFER,
  CONTACT_EMAIL,
  chargesVat,
  formatPrice,
  netPrice,
  NO_VAT_NOTE,
  pricePerSession,
  vatAmount,
} from "@/lib/checkout";
import { CheckoutForm } from "./checkout-form";
import { LegalFooter } from "./legal";

// Öffentliche Seite — kein Login (siehe PUBLIC_PATHS in proxy.ts).
export const metadata: Metadata = {
  title: `Checkout — ${CHECKOUT_OFFER.name}`,
  description: `${CHECKOUT_OFFER.tagline} · ${formatPrice(CHECKOUT_OFFER.price)}`,
};

export default function CheckoutPage() {
  // Der ausgezeichnete Preis ist der Endbetrag. Ohne Umsatzsteuer (vatRate 0)
  // entfällt die Aufschlüsselung komplett — der Kunde sieht genau eine Zahl.
  const withVat = chargesVat();
  const net = netPrice();
  const vat = vatAmount();
  const vatPercent = Math.round(CHECKOUT_OFFER.vatRate * 100);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 lg:py-16">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-accent)] mb-3">
          Checkout
        </p>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">{CHECKOUT_OFFER.name}</h1>
        <p className="text-[color:var(--color-muted)] mt-2 max-w-2xl leading-relaxed">
          {CHECKOUT_OFFER.description}
        </p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[color:var(--color-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-4 h-4 text-[color:var(--color-accent)]" />
            {CHECKOUT_OFFER.sessionCount} Sessions
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[color:var(--color-accent)]" />
            je {CHECKOUT_OFFER.sessionMinutes} Minuten
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Video className="w-4 h-4 text-[color:var(--color-accent)]" />
            1:1 per Zoom
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-8 lg:gap-12 items-start">
        {/* Formular */}
        <div className="order-2 lg:order-1">
          <CheckoutForm />
        </div>

        {/* Bestellübersicht */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-10 space-y-4">
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <h2 className="text-base font-semibold tracking-tight">Bestellübersicht</h2>

            <div className="mt-4">
              <div className="text-sm font-medium">{CHECKOUT_OFFER.name}</div>
              <div className="text-xs text-[color:var(--color-muted)]">{CHECKOUT_OFFER.tagline}</div>
              <div className="mt-2 text-3xl font-bold font-display text-[color:var(--color-accent)] tabular-nums">
                {formatPrice(CHECKOUT_OFFER.price)}
              </div>
              <div className="text-xs text-[color:var(--color-muted)] mt-1">
                {withVat ? `inkl. ${vatPercent} % MwSt. · ` : ""}
                {formatPrice(pricePerSession())} pro Session
              </div>
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-[color:var(--color-border)] pt-4 text-sm">
              {withVat && (
                <>
                  <div className="flex justify-between text-[color:var(--color-muted)]">
                    <dt>Nettobetrag</dt>
                    <dd className="tabular-nums">{formatPrice(net)}</dd>
                  </div>
                  <div className="flex justify-between text-[color:var(--color-muted)]">
                    <dt>enthaltene MwSt. ({vatPercent} %)</dt>
                    <dd className="tabular-nums">{formatPrice(vat)}</dd>
                  </div>
                </>
              )}
              {/* "Paketpreis", nicht "Gesamtbetrag": diese Übersicht ist statisch,
                  während das Zahlungsmodell im Formular gewählt wird. Bei 3 Raten
                  liegt die Summe der Abbuchungen einen Cent darunter — der für den
                  gewählten Plan gültige Betrag steht direkt über dem Bestell-Button. */}
              <div
                className={`flex justify-between font-semibold ${
                  withVat ? "pt-2 border-t border-[color:var(--color-border)] mt-2" : ""
                }`}
              >
                <dt>Paketpreis</dt>
                <dd className="tabular-nums">{formatPrice(CHECKOUT_OFFER.price)}</dd>
              </div>
              <div className="text-right text-xs text-[color:var(--color-muted)]">
                Endpreis — es kommen keine weiteren Kosten dazu.
                {!withVat && ` ${NO_VAT_NOTE}`} Ratenzahlung wählbar.
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <h2 className="text-base font-semibold tracking-tight mb-3">Enthalten</h2>
            <ul className="space-y-2.5">
              {CHECKOUT_OFFER.includes.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-snug">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-[color:var(--color-accent)]" />
                  <span className="text-[color:var(--color-muted)]">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4 text-xs leading-relaxed text-[color:var(--color-muted)]">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[color:var(--color-accent)]" />
            <p>
              Nach der Bestellung meldet sich Jerome persönlich innerhalb von 24 Stunden — ihr legt gemeinsam
              den ersten Termin fest, die weiteren Sessions planst du flexibel dazu. Fragen vorab:{" "}
              <span className="text-[color:var(--color-text)]">{CONTACT_EMAIL}</span>
            </p>
          </div>
        </aside>
      </div>

      <LegalFooter />
    </main>
  );
}
