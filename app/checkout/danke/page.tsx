import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";

import {
  CHECKOUT_OFFER,
  CONTACT_EMAIL,
  chargesVat,
  formatPrice,
  netPrice,
  vatAmount,
} from "@/lib/checkout";
import { stripeGet } from "@/lib/stripe";
import { fulfillPaidOrder, endInstallmentPlanAfterLastRate } from "../fulfill";
import { LegalFooter } from "../legal";

export const metadata: Metadata = {
  title: "Bestellung eingegangen — Jerome Deres Coaching",
};

export const dynamic = "force-dynamic";

type StripeSession = {
  payment_status?: string;
  subscription?: string | null;
  metadata?: Record<string, string> | null;
};

/**
 * Zahlungsstatus direkt bei Stripe erfragen — nicht der URL glauben. Wer
 * /checkout/danke von Hand aufruft, soll keine Zahlungsbestätigung sehen.
 *
 * Gleichzeitig der Rettungsanker für den Webhook: kommt der nicht durch, wird
 * die Bestellung hier erfüllt. `fulfillPaidOrder` ist idempotent, doppelte
 * Mails gibt es dadurch nicht.
 */
async function resolvePayment(sessionId: string | null, reference: string | null) {
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { state: "unknown" as const };

  try {
    const session = (await stripeGet(`/checkout/sessions/${sessionId}`)) as StripeSession;
    const status = session.payment_status;
    const ref = reference || session.metadata?.reference || "";

    if (status === "paid" || status === "no_payment_required") {
      if (ref) {
        await fulfillPaidOrder(ref, sessionId);
        const installments = Number(session.metadata?.installments) || 0;
        if (session.subscription && installments >= 2) {
          await endInstallmentPlanAfterLastRate(String(session.subscription), installments);
        }
      }
      return { state: "paid" as const };
    }
    // SEPA-Lastschrift bestätigt Stripe erst nach ein paar Tagen.
    return { state: "pending" as const };
  } catch (err) {
    console.error("danke: Stripe-Session nicht lesbar", sessionId, err);
    return { state: "unknown" as const };
  }
}

export default async function CheckoutDankePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; session_id?: string }>;
}) {
  const { ref, session_id } = await searchParams;
  // Nur das eigene Referenz-Format rendern — kein fremder Text aus der URL.
  const reference = /^JD-\d{4}-[A-Z0-9]{4}$/.test(ref ?? "") ? ref! : null;
  const { state } = await resolvePayment(session_id ?? null, reference);

  const paid = state === "paid";
  const pending = state === "pending";

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex flex-col items-center text-center">
        {pending ? (
          <Clock className="w-12 h-12 text-[color:var(--color-accent)]" />
        ) : (
          <CheckCircle2 className="w-12 h-12 text-[color:var(--color-accent)]" />
        )}
        <h1 className="mt-5 text-3xl font-bold tracking-tight">
          {paid ? "Zahlung eingegangen" : pending ? "Zahlung wird verarbeitet" : "Bestellung eingegangen"}
        </h1>
        <p className="mt-3 text-[color:var(--color-muted)] leading-relaxed">
          {paid
            ? "Danke für dein Vertrauen. Die Bestätigung ist per E-Mail unterwegs — und Jerome meldet sich innerhalb von 24 Stunden persönlich für deinen Start-Termin."
            : pending
              ? "Deine Zahlung ist bei der Bank und wird in den nächsten Tagen bestätigt. Sobald sie durch ist, bekommst du die Bestätigung per E-Mail. Jerome meldet sich in der Zwischenzeit bei dir."
              : "Danke für dein Vertrauen. Du erhältst gleich eine Bestätigung per E-Mail — und Jerome meldet sich innerhalb von 24 Stunden persönlich für deinen Start-Termin."}
        </p>
      </div>

      {reference && (
        <div className="mt-8 rounded-xl border border-[color:var(--color-accent)]/35 bg-[color:var(--color-accent)]/[0.07] p-5 text-center">
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-muted)]">Bestellnummer</div>
          <div className="mt-1 text-2xl font-bold font-display tabular-nums text-[color:var(--color-accent)]">
            {reference}
          </div>
          <p className="mt-2 text-xs text-[color:var(--color-muted)]">
            Bitte bei Rückfragen zu deiner Bestellung angeben.
          </p>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <h2 className="text-base font-semibold tracking-tight">Deine Bestellung</h2>
        <div className="mt-3 flex items-baseline justify-between gap-4 text-sm">
          <span>
            {CHECKOUT_OFFER.name}
            <span className="block text-xs text-[color:var(--color-muted)]">{CHECKOUT_OFFER.tagline}</span>
          </span>
          <span className="font-semibold tabular-nums shrink-0">{formatPrice(CHECKOUT_OFFER.price)}</span>
        </div>

        <dl className="mt-4 space-y-1 text-sm">
          {chargesVat() && (
            <>
              <Row label="Nettobetrag" value={formatPrice(netPrice())} />
              <Row
                label={`enthaltene MwSt. (${Math.round(CHECKOUT_OFFER.vatRate * 100)} %)`}
                value={formatPrice(vatAmount())}
              />
            </>
          )}
          <Row label="Gesamtbetrag" value={formatPrice(CHECKOUT_OFFER.price)} highlight={chargesVat()} />
        </dl>

        <p className="mt-4 text-sm text-[color:var(--color-muted)] leading-relaxed">
          {paid
            ? "Die Zahlung ist bei uns eingegangen. Deine Rechnung kommt per E-Mail."
            : "Deine Rechnung kommt per E-Mail, sobald die Zahlung bestätigt ist."}
        </p>
      </div>

      <p className="mt-8 text-center text-sm text-[color:var(--color-muted)]">
        Fragen? Schreib an{" "}
        <Link href={`mailto:${CONTACT_EMAIL}`} className="text-[color:var(--color-accent)] hover:underline">
          {CONTACT_EMAIL}
        </Link>
      </p>

      <LegalFooter />
    </main>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${highlight ? "pt-2 border-t border-[color:var(--color-border)]" : ""}`}>
      <dt className={highlight ? "font-semibold" : "text-[color:var(--color-muted)]"}>{label}</dt>
      <dd className={`text-right tabular-nums ${highlight ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}
