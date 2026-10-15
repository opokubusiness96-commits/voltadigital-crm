import type { Metadata } from "next";
import Link from "next/link";
import { RoomdeskForm } from "./RoomdeskForm";

export const metadata: Metadata = {
  title: "RoomDesk – Hotelbuchung, die Mobile Money versteht | Volta Digital",
  description:
    "RoomDesk ist die Hotel-Buchungssoftware von Volta Digital für kleine und mittlere Hotels in Ghana und Togo. Belegungsplan, Zimmerkonto mit Kasse, eigene Buchungsseite, Mobile Money per Paystack.",
};

const FEATURES: { title: string; text: string }[] = [
  {
    title: "Belegungsplan als Tabelle",
    text: "Zimmer mal Tage auf einen Blick. Freie, belegte und reservierte Zimmer sind sofort erkennbar, Doppelbuchungen werden verhindert.",
  },
  {
    title: "Zimmerkonto mit integrierter Kasse",
    text: "Snacks, Getränke und Zusatzleistungen direkt aufs Zimmer buchen. Beim Check-out steht die komplette Rechnung bereit.",
  },
  {
    title: "Eigene Buchungsseite pro Hotel",
    text: "Gäste wählen Zimmer und Frühstücksoption online. Jedes Hotel bekommt seine eigene Seite und eigene Zugänge.",
  },
  {
    title: "Online-Zahlung per Mobile Money",
    text: "Gäste zahlen per MoMo oder Karte über Paystack. Das Geld landet direkt beim Hotel.",
  },
  {
    title: "Automatische Buchungsbestätigung",
    text: "Nach jeder Buchung geht eine Bestätigung per E-Mail an den Gast. Keine manuelle Nacharbeit an der Rezeption.",
  },
  {
    title: "Monatliches Abo ohne Einrichtungsgebühr",
    text: "RoomDesk kostet weniger als eine Zimmernacht pro Monat. Keine Hardware, kein Vertrag mit langer Laufzeit.",
  },
];

function GhanaLine() {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      <span className="h-1 w-8 rounded-full bg-[#D4AF37]" />
      <span className="h-1 w-8 rounded-full bg-[#1E7A4A]" />
      <span className="h-1 w-8 rounded-full bg-[#C8322B]" />
      <span className="h-1 w-8 rounded-full bg-[#D4AF37]" />
    </div>
  );
}

export default function RoomdeskPage() {
  return (
    <main className="bg-white text-[#141311]">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-3xl font-semibold text-[#B8962E] md:text-4xl">RoomDesk</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6E675C]">Africa</span>
        </div>
        <div className="mt-3">
          <GhanaLine />
        </div>
        <h1 className="mt-8 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          Hotelbuchung, die Mobile Money versteht.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#4A463F]">
          Buchungssoftware aus Deutschland für kleine und mittlere Hotels in Ghana und Togo. Belegungsplan,
          Zimmerkonto und Online-Zahlung per MoMo. Läuft bereits im Pilothotel in Accra.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#anfrage"
            className="inline-flex items-center rounded-md bg-[#141311] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2A2622]"
          >
            Pilotplatz sichern
          </a>
          <a
            href="/roomdesk-hotel-questionnaire.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border border-[#D9D3C5] px-6 py-3 text-sm font-semibold text-[#141311] transition hover:border-[#B8962E]"
          >
            Fragebogen als PDF herunterladen
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-[#EDE9E0] bg-[#FBFAF7]">
        <div className="mx-auto max-w-5xl px-6 py-14 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B8962E]">Was RoomDesk kann</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight md:text-3xl">
            Alles, was eine Rezeption in Accra oder Lomé täglich braucht.
          </h2>
          <ul className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="border-t border-[#D9D3C5] pt-4">
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#4A463F]">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pilot + Preis */}
      <section className="mx-auto max-w-5xl px-6 py-14 md:py-20">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B8962E]">Preis</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">Weniger als eine Zimmernacht pro Monat.</p>
            <p className="mt-3 text-sm leading-relaxed text-[#4A463F]">
              Monatliches Abo, jederzeit kündbar. Der Preis richtet sich nach der Zimmerzahl, kleinere Häuser zahlen
              weniger. Einrichtung und Schulung der Rezeption sind enthalten.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B8962E]">Pilotprogramm</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">Die ersten Hotels starten vergünstigt.</p>
            <p className="mt-3 text-sm leading-relaxed text-[#4A463F]">
              RoomDesk läuft bereits im Pilothotel in Accra. Für die nächsten Häuser in Ghana und Togo gibt es
              Sonderkonditionen, dafür wünschen wir uns dein Feedback und eine Referenz.
            </p>
          </div>
        </div>
      </section>

      {/* Formular */}
      <section id="anfrage" className="border-t border-[#EDE9E0] bg-[#FBFAF7]">
        <div className="mx-auto max-w-5xl px-6 py-14 md:py-20">
          <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B8962E]">Hotel anfragen</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                Sichere dir einen Pilotplatz für dein Hotel.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#4A463F]">
                Wir melden uns innerhalb von 24 Stunden mit einer Demo, 15 Minuten per WhatsApp oder Video-Call.
              </p>
              <p className="mt-6 text-sm leading-relaxed text-[#4A463F]">
                Lieber auf Papier? Lade den{" "}
                <a
                  href="/roomdesk-hotel-questionnaire.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#141311] underline decoration-[#B8962E] underline-offset-4"
                >
                  Fragebogen als PDF
                </a>{" "}
                herunter, fülle ihn aus und schicke ihn per E-Mail an hallo@voltadigital.agency oder per WhatsApp
                zurück.
              </p>
            </div>
            <RoomdeskForm />
          </div>
        </div>
      </section>

      {/* Dezenter Kunden-Login */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <p className="text-xs text-[#8A8275]">
          Du nutzt RoomDesk bereits?{" "}
          <Link href="https://book.voltadigital.agency/login" className="underline underline-offset-4 hover:text-[#141311]">
            Kunden-Login
          </Link>
        </p>
      </section>
    </main>
  );
}
