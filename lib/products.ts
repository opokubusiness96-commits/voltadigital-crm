// Produkte / Angebote pro Mandant fürs Kunden-Dashboard.
// Bewusst als Code-Konfiguration (analog lib/mock/agency.ts): Produkte ändern
// sich selten, und es gibt (noch) keine products-Tabelle in Supabase.
// price: null = "Preis individuell", 0 = "Kostenlos".

export type OrgProduct = {
  name: string;
  price: number | null;
  description: string;
  badge?: string;
};

export const PRODUCTS_BY_ORG: Record<string, OrgProduct[]> = {
  "nikola-mdk-system": [
    {
      name: "MDK Elevate Method — 1:1 Programm",
      price: null,
      description:
        "Individuelles Schmerzfrei-Programm über Nervensystem, Faszien und Muskelkoordination.",
      badge: "Hauptangebot",
    },
    {
      name: "Kostenloses Erstgespräch (15 Min)",
      price: 0,
      description:
        "Kennenlern-Call mit Nikola: Passt das MDK-System zur individuellen Situation?",
      badge: "Funnel",
    },
    {
      name: "MDK Checkliste + Anleitung",
      price: 0,
      description:
        "7-Punkte-Checkliste, Selbsttest und 4-Phasen-Plan als kostenloser Download.",
      badge: "Lead-Magnet",
    },
  ],
};

export function getOrgProducts(orgSlug: string): OrgProduct[] {
  return PRODUCTS_BY_ORG[orgSlug] ?? [];
}
