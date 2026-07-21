// Academy-Kurse fürs CRM (für alle eingeloggten Nutzer sichtbar unter /academy).
// Die Videos liegen im PRIVATEN Storage-Bucket "academy" (Prefix crm-onboarding/),
// je Lektion eine .mp4 + .jpg als Poster mit gleichem Basename. Neue Lektion:
// beide Dateien in den Bucket hochladen und hier einen Eintrag ergänzen.
export type AcademyLesson = {
  num: number;
  slug: string;
  title: string;
  description: string;
  duration: string; // Anzeige-Dauer, z. B. "1:58"
  videoPath: string; // Pfad im Bucket "academy"
  posterPath: string; // Poster-Bild im Bucket "academy"
};

// Kurs-Metadaten (Kopf der Academy-Seite)
export const ACADEMY_COURSE = {
  title: "CRM Onboarding",
  subtitle: "5 Videos · ca. 13 Minuten",
};

export const ACADEMY_LESSONS: AcademyLesson[] = [
  {
    num: 1,
    slug: "01-willkommen-und-ueberblick",
    title: "Willkommen & Überblick",
    description:
      "Login, dein Dashboard und das obere Menü: Pipeline, Liste und Statistik — dein Einstieg ins CRM.",
    duration: "1:58",
    videoPath: "crm-onboarding/01-willkommen-und-ueberblick.mp4",
    posterPath: "crm-onboarding/01-willkommen-und-ueberblick.jpg",
  },
  {
    num: 2,
    slug: "02-dein-dashboard",
    title: "Dein Dashboard",
    description:
      "Die vier Kennzahlen, Umsatz- und Lead-Verlauf, Produkte und deine Alltags-Helfer — und der Einstieg in die Pipeline.",
    duration: "1:59",
    videoPath: "crm-onboarding/02-dein-dashboard.mp4",
    posterPath: "crm-onboarding/02-dein-dashboard.jpg",
  },
  {
    num: 3,
    slug: "03-die-pipeline-verstehen",
    title: "Die Pipeline verstehen",
    description:
      "Die Phasen von links nach rechts, Lead-Karten richtig lesen, Hover-Vorschau, Personen-Marker und Tags.",
    duration: "3:12",
    videoPath: "crm-onboarding/03-die-pipeline-verstehen.mp4",
    posterPath: "crm-onboarding/03-die-pipeline-verstehen.jpg",
  },
  {
    num: 4,
    slug: "04-in-der-pipeline-arbeiten",
    title: "In der Pipeline arbeiten",
    description:
      "Die täglichen Handgriffe: Leads verschieben, dir zuweisen, taggen, neue Leads anlegen, suchen und filtern.",
    duration: "2:42",
    videoPath: "crm-onboarding/04-in-der-pipeline-arbeiten.mp4",
    posterPath: "crm-onboarding/04-in-der-pipeline-arbeiten.jpg",
  },
  {
    num: 5,
    slug: "05-lead-detail-und-tagesablauf",
    title: "Lead-Detail & dein Tagesablauf",
    description:
      "Die Detailseite mit Kontaktdaten, Notizen und Verlauf — und dein empfohlener Tagesablauf im CRM.",
    duration: "2:10",
    videoPath: "crm-onboarding/05-lead-detail-und-tagesablauf.mp4",
    posterPath: "crm-onboarding/05-lead-detail-und-tagesablauf.jpg",
  },
];
