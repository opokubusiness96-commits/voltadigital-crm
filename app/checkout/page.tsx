import type { Metadata } from "next";
import { Check, ShieldCheck } from "lucide-react";
import { CHECKOUT_OFFER, formatPrice, vatSplit } from "@/lib/checkout";
import { CheckoutForm } from "./checkout-form";

// Öffentliche Seite — kein Login (siehe PUBLIC_PATHS in proxy.ts).
export const metadata: Metadata = {
  title: `Checkout — ${CHECKOUT_OFFER.name}`,
  description: `${CHECKOUT_OFFER.tagline} · ${formatPrice(CHECKOUT_OFFER.price)}`,
};

export default function CheckoutPage() {
  const { net, vat } = vatSplit(CHECKOUT_OFFER.price, CHECKOUT_OFFER.vatRate);

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
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-[color:var(--color-border)] pt-4 text-sm">
              <div className="flex justify-between text-[color:var(--color-muted)]">
                <dt>Nettobetrag</dt>
                <dd className="tabular-nums">{formatPrice(net)}</dd>
              </div>
              <div className="flex justify-between text-[color:var(--color-muted)]">
                <dt>zzgl. {Math.round(CHECKOUT_OFFER.vatRate * 100)} % MwSt.</dt>
                <dd className="tabular-nums">{formatPrice(vat)}</dd>
              </div>
              <div className="flex justify-between pt-2 font-semibold border-t border-[color:var(--color-border)] mt-2">
                <dt>Gesamt</dt>
                <dd className="tabular-nums">{formatPrice(CHECKOUT_OFFER.price)}</dd>
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
              Nach der Bestellung meldet sich Jerome persönlich innerhalb von 24 Stunden für den Start-Termin.
              Fragen vorab: <span className="text-[color:var(--color-text)]">info@jeromederes.com</span>
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
