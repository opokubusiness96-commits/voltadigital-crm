// Download-Ressourcen fürs CRM (für alle eingeloggten Nutzer sichtbar unter /downloads).
// Neue PDFs: Datei nach public/assets/ legen und hier einen Eintrag ergänzen.
export type DownloadItem = {
  title: string;
  description: string;
  file: string; // Pfad unter /public
  kind: string; // Badge, z. B. "PDF"
};

export const DOWNLOADS: DownloadItem[] = [
  {
    title: "Website Design Guide & Briefing",
    description:
      "Der Fragebogen, mit dem wir deine Website wirklich verstehen und perfekt auf dein Business abstimmen.",
    file: "/assets/volta-website-design-briefing.pdf",
    kind: "PDF",
  },
];
