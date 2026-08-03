import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { CHECKOUT_OFFER, formatPrice } from "@/lib/checkout";

export const metadata: Metadata = {
  title: "Bestellung eingegangen — Jerome Deres Coaching",
};

export const dynamic = "force-dynamic";

// Bankdaten kommen aus der Env — bewusst KEINE Platzhalter-IBAN im Code.
// Ohne CHECKOUT_BANK_IBAN zeigt die Seite den Hinweis, dass die Zahlungsdaten
// mit der Rechnung per E-Mail kommen.
function bankDetails() {
  const iban = process.env.CHECKOUT_BANK_IBAN?.trim();
  if (!iban) return null;
  return {
    holder: process.env.CHECKOUT_BANK_HOLDER?.trim() || CHECKOUT_OFFER.name,
    iban,
    bic: process.env.CHECKOUT_BANK_BIC?.trim() || null,
    bank: process.env.CHECKOUT_BANK_NAME?.trim() || null,
  };
}

export default async function CheckoutDankePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  // Nur das eigene Referenz-Format rendern — kein fremder Text aus der URL.
  const reference = /^JD-\d{4}-[A-Z0-9]{4}$/.test(ref ?? "") ? ref! : null;
  const bank = bankDetails();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="w-12 h-12 text-[color:var(--color-accent)]" />
        <h1 className="mt-5 text-3xl font-bold tracking-tight">Bestellung eingegangen</h1>
        <p className="mt-3 text-[color:var(--color-muted)] leading-relaxed">
          Danke für dein Vertrauen. Du erhältst gleich eine Bestätigung per E-Mail — und Jerome meldet sich
          innerhalb von 24 Stunden persönlich für deinen Start-Termin.
        </p>
      </div>

      {reference && (
        <div className="mt-8 rounded-xl border border-[color:var(--color-accent)]/35 bg-[color:var(--color-accent)]/[0.07] p-5 text-center">
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-muted)]">Bestellnummer</div>
          <div className="mt-1 text-2xl font-bold font-display tabular-nums text-[color:var(--color-accent)]">
            {reference}
          </div>
          <p className="mt-2 text-xs text-[color:var(--color-muted)]">
            Bitte als Verwendungszweck bei der Überweisung angeben.
          </p>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <h2 className="text-base font-semibold tracking-tight">Deine Bestellung</h2>
        <div className="mt-3 flex items-baseline justify-between gap-3 text-sm">
          <span className="text-[color:var(--color-muted)]">{CHECKOUT_OFFER.name}</span>
          <span className="font-semibold tabular-nums">{formatPrice(CHECKOUT_OFFER.price)}</span>
        </div>

        <h3 className="mt-6 text-sm font-semibold tracking-tight">Zahlung</h3>
        {bank ? (
          <dl className="mt-2 space-y-1 text-sm">
            <Row label="Empfänger" value={bank.holder} />
            <Row label="IBAN" value={bank.iban} mono />
            {bank.bic && <Row label="BIC" value={bank.bic} mono />}
            {bank.bank && <Row label="Bank" value={bank.bank} />}
            {reference && <Row label="Verwendungszweck" value={reference} mono />}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[color:var(--color-muted)] leading-relaxed">
            Die Rechnung mit allen Zahlungsdaten kommt per E-Mail. Bitte gib bei der Überweisung deine
            Bestellnummer als Verwendungszweck an.
          </p>
        )}
      </div>

      <p className="mt-8 text-center text-sm text-[color:var(--color-muted)]">
        Fragen? Schreib an{" "}
        <Link href="mailto:info@jeromederes.com" className="text-[color:var(--color-accent)] hover:underline">
          info@jeromederes.com
        </Link>
      </p>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[color:var(--color-muted)] shrink-0">{label}</dt>
      <dd className={`text-right break-all ${mono ? "font-mono text-xs sm:text-sm" : ""}`}>{value}</dd>
    </div>
  );
}
