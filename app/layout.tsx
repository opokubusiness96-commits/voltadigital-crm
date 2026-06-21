import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoltaDigital CRM",
  description: "Volta Digital CRM",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
