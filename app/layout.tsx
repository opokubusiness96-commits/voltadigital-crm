import type { Metadata } from "next";
import "./globals.css";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "VoltaDigital CRM",
  description: "Volta Digital CRM",
  robots: { index: false, follow: false },
};

type OrgBrand = {
  brand_primary: string | null;
  brand_secondary: string | null;
  brand_accent: string | null;
  brand_background: string | null;
};

// Luminanz-Check: helle brand_background → Light-Theme-Ableitung
function isLightHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// Per-Org-Branding (z.B. Physioboii für "Nikola MDK System"): liest die
// brand_*-Spalten der eigenen Org (RLS-scoped) und leitet daraus die
// CSS-Variablen ab. Orgs ohne Branding behalten das Volta-Gold-Theme.
async function getBrandVars(): Promise<{ css: string; light: boolean } | null> {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("organizations")
      .select("brand_primary, brand_secondary, brand_accent, brand_background");
    const org = (data as OrgBrand[] | null)?.find((o) => o.brand_background);
    if (!org || !org.brand_background || !org.brand_primary) return null;

    const light = isLightHex(org.brand_background);
    const accent2 = org.brand_accent || org.brand_primary;
    const vars: Record<string, string> = light
      ? {
          // Light-Ableitung (kalibriert für Bone-White-artige Hintergründe)
          "--color-bg": org.brand_background,
          "--color-surface": "#FFFFFF",
          "--color-surface-2": "#ECE8DD",
          "--color-border": "#D9D3C5",
          "--color-text": "#26211C",
          "--color-muted": "#70685B",
          "--color-accent": org.brand_primary,
          "--color-accent-2": accent2,
          "--color-accent-fg": "#FDFCF9",
          "--color-blue": org.brand_secondary || "#6B7280",
          "--color-green": accent2,
          "--color-amber": "#8A6D2E",
          "--color-red": "#8A3B3B",
        }
      : {
          // Dunkle Basis behalten, nur Akzente umfärben
          "--color-accent": org.brand_primary,
          "--color-accent-2": accent2,
        };
    const css =
      ":root{" +
      Object.entries(vars)
        .map(([k, v]) => `${k}:${v};`)
        .join("") +
      "}";
    return { css, light };
  } catch {
    return null; // Fake-Client / fehlende Spalten → Standard-Theme
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const brand = await getBrandVars();
  return (
    <html lang="de">
      <head>
        {/* Schriften wie die Landing Page: Montserrat (Display) + Poppins (Body).
            Laufzeit-Laden per Link statt next/font, damit der Dev-Server nicht
            am Font-Fetch hängt. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Poppins:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        {brand && <style dangerouslySetInnerHTML={{ __html: brand.css }} />}
      </head>
      <body
        className="min-h-screen"
        data-brand={brand?.light ? "light" : undefined}
      >
        {children}
      </body>
    </html>
  );
}
