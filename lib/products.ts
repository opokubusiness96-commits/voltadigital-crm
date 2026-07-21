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
  salonceo: [
    {
      name: "The Salon CEO Mentoring",
      price: 2997,
      description:
        "Beauty Business Mentoring mit Heidi & Jerome — 1:1-Begleitung von der Idee bis zum eigenen Salon.",
      badge: "Hauptangebot",
    },
    {
      name: "The Salon CEO Mentoring Plus",
      price: 4997,
      description:
        "Die Plus-Variante mit intensiverer 1:1-Begleitung und erweitertem Support.",
      badge: "Premium",
    },
    {
      name: "Kostenloses Kennenlerngespräch",
      price: 0,
      description:
        "Unverbindliches Erstgespräch über das Formular auf thesalonceo.de.",
      badge: "Funnel",
    },
  ],
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
