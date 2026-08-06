"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Lock, Minus, Plus } from "lucide-react";

import { formatPrice } from "@/lib/checkout";
import { clampQuantity, offerTotal, type Offer } from "@/lib/offers";
import { LegalLink } from "../checkout/legal";
import { startOfferCheckout } from "./actions";

/**
 * Drei Wege ins Coaching nebeneinander.
 *
 * Die Menge gibt es nur bei der Einzelstunde und nur bis vier — ab der fünften
 * ist das Paket günstiger, und der Regler soll niemanden in die teurere
 * Variante laufen lassen.
 *
 * Kein Formular: gewähltes Angebot, eine Bestätigung, Kasse. Name, Adresse und
 * Telefon erhebt Stripe.
 */
export function OfferCards({ offers }: { offers: Offer[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(offers.map((o) => [o.id, o.quantity?.min ?? 1])),
  );
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    setCancelled(new URLSearchParams(window.location.search).get("abgebrochen") === "1");
  }, []);

  function setQuantity(offer: Offer, next: number) {
    setQuantities((q) => ({ ...q, [offer.id]: clampQuantity(offer, next) }));
  }

  async function buy(offer: Offer) {
    if (!accepted[offer.id]) {
      setError({ id: offer.id, message: "Bitte AGB, Datenschutz und Widerrufsbelehrung bestätigen." });
      return;
    }
    setError(null);
    setBusy(offer.id);
    try {
      const res = await startOfferCheckout(offer.id, quantities[offer.id] ?? 1);
      if (!res.ok) {
        setError({ id: offer.id, message: res.error });
        setBusy(null);
        return;
      }
      window.location.href = res.url;
    } catch {
      setError({ id: offer.id, message: "Verbindung fehlgeschlagen. Bitte nochmal versuchen." });
      setBusy(null);
    }
  }

  return (
    <>
      {cancelled && (
        <p className="mb-6 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-muted)]">
          Die Zahlung wurde abgebrochen — es wurde nichts abgebucht.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        {offers.map((offer) => {
          const quantity = quantities[offer.id] ?? 1;
          const total = offerTotal(offer, quantity);
          const loading = busy === offer.id;
          const atMax = offer.quantity ? quantity >= offer.quantity.max : false;

          return (
            <section
              key={offer.id}
              className={`flex flex-col rounded-xl border p-6 ${
                offer.highlight
                  ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/[0.06] lg:-mt-3 lg:pb-8"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
              }`}
            >
              {offer.badge && (
                <span
                  className={`mb-3 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    offer.highlight
                      ? "bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)]"
                      : "border border-[color:var(--color-accent)]/40 text-[color:var(--color-accent)]"
                  }`}
                >
                  {offer.badge}
                </span>
              )}

              <h2 className="text-xl font-bold tracking-tight">{offer.name}</h2>
              <p className="mt-1 text-sm text-[color:var(--color-muted)]">{offer.tagline}</p>

              <div className="mt-5">
                <div className="text-3xl font-bold font-display tabular-nums text-[color:var(--color-accent)]">
                  {formatPrice(total)}
                </div>
                {offer.unitLabel && (
                  <div className="mt-1 text-xs text-[color:var(--color-muted)]">
                    {formatPrice(offer.unitPrice)} pro {offer.unitLabel}
                    {quantity > 1 && ` · ${quantity} Stunden`}
                  </div>
                )}
              </div>

              {/* Mengenwahl nur, wo sie sinnvoll ist. */}
              {offer.quantity && (
                <div className="mt-4">
                  <span className="mb-1.5 block text-xs text-[color:var(--color-muted)]">
                    Wie viele Stunden?
                  </span>
                  <div className="flex items-center gap-3">
                    <StepButton
                      label="Eine Stunde weniger"
                      disabled={loading || quantity <= offer.quantity.min}
                      onClick={() => setQuantity(offer, quantity - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </StepButton>
                    <span
                      aria-live="polite"
                      className="min-w-[3ch] text-center text-lg font-semibold tabular-nums"
                    >
                      {quantity}
                    </span>
                    <StepButton
                      label="Eine Stunde mehr"
                      disabled={loading || atMax}
                      onClick={() => setQuantity(offer, quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </StepButton>
                  </div>
                </div>
              )}

              <ul className="mt-5 space-y-2.5">
                {offer.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-snug">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-accent)]" />
                    <span className="text-[color:var(--color-muted)]">{item}</span>
                  </li>
                ))}
              </ul>

              {offer.note && (
                <p
                  className={`mt-4 text-xs leading-relaxed ${
                    atMax ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-muted)]"
                  }`}
                >
                  {offer.note}
                </p>
              )}

              <div className="mt-auto pt-6">
                <label className="flex items-start gap-2.5 text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[color:var(--color-accent)]"
                    checked={accepted[offer.id] ?? false}
                    disabled={loading}
                    onChange={(e) => {
                      setAccepted((a) => ({ ...a, [offer.id]: e.target.checked }));
                      if (e.target.checked) setError(null);
                    }}
                  />
                  <span className="text-[color:var(--color-muted)]">
                    <LegalLink doc="agb" />, <LegalLink doc="privacy" /> und{" "}
                    <LegalLink doc="withdrawal" /> gelesen. Das Coaching darf vor Ablauf der
                    Widerrufsfrist beginnen.
                  </span>
                </label>

                {error?.id === offer.id && (
                  <p role="alert" className="mt-2 text-xs text-[color:var(--color-red)]">
                    {error.message}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => buy(offer)}
                  disabled={loading}
                  className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md py-3 font-semibold disabled:opacity-50 ${
                    offer.highlight
                      ? "bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)]"
                      : "border border-[color:var(--color-accent)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10"
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Kasse wird geöffnet…
                    </>
                  ) : (
                    <>Zahlungspflichtig bestellen · {formatPrice(total)}</>
                  )}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[color:var(--color-muted)]">
        <Lock className="h-3.5 w-3.5" /> Bezahlung über Stripe — Apple Pay, Google Pay, Karte,
        Klarna, SEPA-Lastschrift oder Link. Deine Daten gibst du dort ein, nicht hier.
      </p>
    </>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--color-border)] text-[color:var(--color-text)] transition-colors hover:border-[color:var(--color-accent)] disabled:opacity-40 disabled:hover:border-[color:var(--color-border)]"
    >
      {children}
    </button>
  );
}
