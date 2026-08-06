import type { Metadata } from "next";

import { CONTACT_EMAIL, NO_VAT_NOTE, chargesVat } from "@/lib/checkout";
import { OFFERS } from "@/lib/offers";
import { LegalFooter } from "../checkout/legal";
import { OfferCards } from "./offer-cards";

export const metadata: Metadata = {
  title: "Coaching-Angebote — Jerome Deres",
  description:
    "Einzelstunde, 5er-Paket oder 12 Wochen Intensiv mit Community — direkt buchbar.",
};

/**
 * Nur Angebote anzeigen, für die ein Stripe-Price hinterlegt ist. Eine Kachel,
 * deren Kasse nicht aufgeht, ist schlimmer als eine fehlende Kachel.
 *
 * Lokal ohne Envs werden alle gezeigt — dort geht es ohnehin nie zu Stripe.
 */
function bookableOffers() {
  const configured = OFFERS.filter((o) => !!process.env[o.priceEnv]);
  if (configured.length === 0) return OFFERS;
  for (const o of OFFERS) {
    if (!configured.includes(o)) {
      console.warn(`angebote: "${o.name}" ausgeblendet — ${o.priceEnv} fehlt`);
    }
  }
  return configured;
}

export default function AngebotePage() {
  const offers = bookableOffers();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 lg:py-16">
      <header className="mb-10 max-w-2xl">
        <p className="mb-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
          Coaching mit Jerome Deres
        </p>
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          Such dir aus, wie tief du einsteigen willst
        </h1>
        <p className="mt-3 leading-relaxed text-[color:var(--color-muted)]">
          Eine einzelne Stunde, wenn du erst schauen willst. Das 5er-Paket, wenn du an einer Sache
          dranbleiben willst. Und das 12-Wochen-Programm, wenn es wirklich etwas verändern soll.
          Alle Preise sind Endpreise{chargesVat() ? "" : ` — ${NO_VAT_NOTE}`}
        </p>
      </header>

      <OfferCards offers={offers} />

      <p className="mt-10 text-center text-sm text-[color:var(--color-muted)]">
        Unsicher, was passt? Schreib vorher an{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-[color:var(--color-accent)] hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <LegalFooter />
    </main>
  );
}
