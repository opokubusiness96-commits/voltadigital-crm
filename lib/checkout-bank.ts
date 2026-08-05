import "server-only";

// Bankdaten für die Überweisung — bewusst KEINE Platzhalter-IBAN im Code, sie
// kommen ausschliesslich aus der Env. Danke-Seite UND Bestätigungs-Mail lesen
// aus dieser einen Quelle, damit die Zahlungsdaten nirgends auseinanderlaufen.
// Ohne CHECKOUT_BANK_IBAN zeigt die Seite den Hinweis "Zahlungsdaten kommen mit
// der Rechnung", und die Mail lässt den Bank-Block weg.

export type BankDetails = {
  holder: string | null;
  iban: string;
  bic: string | null;
  bank: string | null;
};

export function bankDetails(): BankDetails | null {
  const iban = process.env.CHECKOUT_BANK_IBAN?.trim();
  if (!iban) return null;
  return {
    // Kein Fallback: ein geratener Kontoinhaber wäre schlimmer als keine Zeile.
    holder: process.env.CHECKOUT_BANK_HOLDER?.trim() || null,
    iban,
    bic: process.env.CHECKOUT_BANK_BIC?.trim() || null,
    bank: process.env.CHECKOUT_BANK_NAME?.trim() || null,
  };
}
