// Rechtstext-Links für Checkout- und Danke-Seite.
// Bewusst ohne "use client": beide Komponenten sind reines Markup ohne Hooks und
// werden sowohl von der Server-Seite (page.tsx) als auch vom Client-Formular
// (checkout-form.tsx) importiert.

import { LEGAL_LABEL, LEGAL_URL, type LegalDoc } from "@/lib/checkout";

/**
 * Verlinkt ein Rechtsdokument, wenn dafür eine URL konfiguriert ist — sonst
 * bleibt es reiner Text. Ein toter Link wäre schlimmer als gar keiner.
 */
export function LegalLink({ doc, label }: { doc: LegalDoc; label?: string }) {
  const text = label ?? LEGAL_LABEL[doc];
  const url = LEGAL_URL[doc];
  if (!url) return <span className="text-[color:var(--color-text)]">{text}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[color:var(--color-accent)] underline underline-offset-2 hover:text-[color:var(--color-accent-2)]"
    >
      {text}
    </a>
  );
}

const FOOTER_DOCS: LegalDoc[] = ["imprint", "privacy", "agb", "withdrawal"];

export function LegalFooter() {
  const configured = FOOTER_DOCS.filter((d) => LEGAL_URL[d]);
  if (configured.length === 0) return null;
  return (
    <footer className="mt-14 border-t border-[color:var(--color-border)] pt-6">
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-[color:var(--color-muted)]">
        {configured.map((doc) => (
          <a
            key={doc}
            href={LEGAL_URL[doc]!}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[color:var(--color-accent)]"
          >
            {LEGAL_LABEL[doc]}
          </a>
        ))}
      </nav>
    </footer>
  );
}
