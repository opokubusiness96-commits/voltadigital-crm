"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import {
  CHECKOUT_OFFER,
  chargesVat,
  formatPrice,
  planFirstAmount,
  planTotal,
  type PaymentPlan,
} from "@/lib/checkout";
import { LegalLink } from "./legal";
import { startCheckout } from "./actions";

const WITH_VAT = chargesVat();
const VAT_SUFFIX = WITH_VAT ? ` inkl. ${Math.round(CHECKOUT_OFFER.vatRate * 100)} % MwSt.` : "";

/**
 * Zahlungsmodell wählen, bestätigen, zur Kasse. Mehr nicht.
 *
 * Name, E-Mail, Telefon und Rechnungsadresse erhebt Stripe — dort füllen Apple
 * Pay, Google Pay und Link diese Felder mit einem Tipp. Jedes Feld, das wir
 * vorher abfragen, kostet Käufer.
 *
 * Die eine Checkbox bleibt: § 356 Abs. 4 BGB verlangt, dass der Kunde den
 * vorzeitigen Leistungsbeginn ausdrücklich verlangt — sonst darf Jerome vor
 * Ablauf der 14 Tage nicht anfangen. Zeitpunkt der Zustimmung wandert in die
 * Stripe-Metadaten und ist damit nachträglich nicht änderbar.
 */
export function CheckoutStart({ plans }: { plans: PaymentPlan[] }) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? CHECKOUT_OFFER.plans[0].id);
  const [accepted, setAccepted] = useState(false);
  const [showError, setShowError] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Rückkehr von der Kasse ohne Zahlung — freundlich einordnen statt schweigen.
  const [cancelled, setCancelled] = useState(false);
  useEffect(() => {
    setCancelled(new URLSearchParams(window.location.search).get("abgebrochen") === "1");
  }, []);

  const plan = plans.find((p) => p.id === planId) ?? plans[0];

  async function go() {
    if (!accepted) {
      setShowError(true);
      return;
    }
    setFormError(null);
    setLoading(true);
    try {
      const res = await startCheckout(planId);
      if (!res.ok) {
        setFormError(res.error);
        setLoading(false);
        return;
      }
      // Ziel liegt auf stripe.com — dorthin kann der Next-Router nicht routen.
      window.location.href = res.url;
    } catch {
      setFormError("Verbindung fehlgeschlagen. Bitte nochmal versuchen.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {cancelled && (
        <p className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-muted)]">
          Die Zahlung wurde abgebrochen — es wurde nichts abgebucht. Du kannst jederzeit neu starten.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Zahlungsmodell</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {plans.map((p) => {
            const active = p.id === planId;
            const total = planTotal(p);
            return (
              <label
                key={p.id}
                className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                  active
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/[0.07]"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-2)]"
                }`}
              >
                <span className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="plan"
                    className="mt-1 accent-[color:var(--color-accent)]"
                    checked={active}
                    disabled={loading}
                    onChange={() => setPlanId(p.id)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{p.label}</span>
                    <span className="mt-0.5 block text-lg font-bold font-display tabular-nums text-[color:var(--color-accent)]">
                      {p.installments > 1
                        ? `${p.installments} × ${formatPrice(p.installmentAmount)}`
                        : formatPrice(total)}
                    </span>
                    {p.installments > 1 && (
                      <span className="block text-xs text-[color:var(--color-muted)]">
                        {formatPrice(total)} gesamt
                        {/* Geht die Summe nicht glatt auf, liegt der Restcent auf
                            der ersten Rate. Das gehört sichtbar an die Kachel —
                            sonst wundert sich der Kunde über den Kontoauszug. */}
                        {planFirstAmount(p) !== p.installmentAmount && (
                          <> · erste Rate {formatPrice(planFirstAmount(p))}</>
                        )}
                      </span>
                    )}
                    <span className="mt-1 block text-xs leading-snug text-[color:var(--color-muted)]">
                      {p.hint}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <p className="text-xs leading-relaxed text-[color:var(--color-muted)]">
          Alle Beträge sind Endpreise{VAT_SUFFIX} — es kommen keine weiteren Kosten dazu. Bezahlt
          wird sicher über <strong className="text-[color:var(--color-text)]">Stripe</strong>: Apple
          Pay, Google Pay, Karte, Klarna, SEPA-Lastschrift oder Link. Deine Daten gibst du dort ein,
          nicht hier.
          {plan && plan.installments > 1 && (
            <>
              {" "}
              Bei Ratenzahlung akzeptiert Stripe Karte und SEPA-Lastschrift — Klarna und Apple Pay
              gelten für die Einmalzahlung.
            </>
          )}
        </p>
      </section>

      <section className="space-y-3">
        <label className="flex items-start gap-2.5 text-sm leading-relaxed">
          <input
            type="checkbox"
            className="mt-1 accent-[color:var(--color-accent)]"
            checked={accepted}
            disabled={loading}
            onChange={(e) => {
              setAccepted(e.target.checked);
              if (e.target.checked) setShowError(false);
            }}
          />
          <span className="text-[color:var(--color-muted)]">
            Ich akzeptiere die <LegalLink doc="agb" /> und habe die <LegalLink doc="privacy" />{" "}
            gelesen. Ich habe die <LegalLink doc="withdrawal" /> zur Kenntnis genommen und wünsche
            ausdrücklich, dass das Coaching schon vor Ablauf der Widerrufsfrist beginnt.
          </span>
        </label>

        {showError && !accepted && (
          <p role="alert" className="text-sm text-[color:var(--color-red)]">
            Bitte bestätige AGB, Datenschutz und Widerrufsbelehrung.
          </p>
        )}

        {formError && (
          <p
            role="alert"
            className="rounded-md border border-[color:var(--color-red)]/40 bg-[color:var(--color-red)]/10 px-3 py-2 text-sm text-[color:var(--color-red)]"
          >
            {formError}
          </p>
        )}

        <button
          type="button"
          onClick={go}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold rounded-md py-3.5 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Kasse wird geöffnet…
            </>
          ) : (
            <>
              Zahlungspflichtig bestellen · {plan ? formatPrice(planTotal(plan)) : ""}
            </>
          )}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-[color:var(--color-muted)]">
          <Lock className="w-3.5 h-3.5" /> Zahlung und Daten laufen verschlüsselt über Stripe.
        </p>
      </section>
    </div>
  );
}
