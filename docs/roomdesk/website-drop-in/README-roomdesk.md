# RoomDesk-Reiter für voltadigital.agency

Drop-in für das Next.js-App-Router-Projekt der Volta-Digital-Website (Tailwind vorausgesetzt).

## Dateien

| Datei | Zweck |
|---|---|
| `app/roomdesk/page.tsx` | Öffentliche Vorstellungsseite `/roomdesk` (Hero, Funktionen, Preis, Pilot, Formular, dezenter Kunden-Login) |
| `app/roomdesk/RoomdeskForm.tsx` | Client-Formular „Hotel anfragen“ mit Danke-Zustand |
| `app/api/roomdesk/route.ts` | POST-Endpunkt: Kontakt in Brevo (SOURCE = roomdesk) + Benachrichtigung an hallo@voltadigital.agency |
| `public/roomdesk-hotel-questionnaire.pdf` | Fragebogen zum Download |

## Einbau

1. Die drei Ordner `app/roomdesk`, `app/api/roomdesk` und `public` ins Projekt kopieren.
2. Navigation: In der Header-Komponente einen neuen Hauptpunkt ergänzen, z. B.

   ```tsx
   <Link href="/roomdesk">RoomDesk</Link>
   ```

   Der Reiter führt zur Vorstellungsseite, nicht zum Software-Login.
3. Env-Variablen in Vercel setzen (Project → Settings → Environment Variables):

   ```
   BREVO_API_KEY=xkeysib-...            # gleicher Key wie beim Website-Fragebogen
   BREVO_SENDER_EMAIL=hallo@voltadigital.agency
   BREVO_SENDER_NAME=Volta Digital
   BREVO_ROOMDESK_LIST_ID=              # optional: Listen-ID in Brevo
   ROOMDESK_NOTIFY_EMAIL=hallo@voltadigital.agency
   ```

4. In Brevo einmalig die Kontakt-Attribute anlegen (Contacts → Settings → Contact attributes), falls noch nicht vorhanden:
   `SOURCE` (Text), `WHATSAPP` (Text), `HOTEL` (Text), `HOTEL_LOCATION` (Text), `HOTEL_ROOMS` (Number), `BOOKING_PROCESS` (Text).
   Unbekannte Attribute lehnt die Brevo-API ab.
5. Falls die Website schon einen Brevo-Helper für den Website-Fragebogen hat: in `route.ts` importieren und die beiden `fetch`-Aufrufe ersetzen, damit beide Formulare denselben Code nutzen.

## Design

Weißes Volta-Design: Weiß, warmes Off-White (#FBFAF7) für Bänder, Near-Black (#141311) für Text und Buttons, Volta-Gold (#B8962E, auf Weiß abgedunkelt) für Logo-Serifenschrift und Akzente. Die RoomDesk-Akzentlinie nutzt Gold, Grün und Rot (Ghana-Farben).

Falls das Projekt Brand-Tokens in `tailwind.config` hat, die Hex-Werte dort durch die Token-Klassen ersetzen.

## Sprache

Die Seite ist auf Deutsch (Du-Form) wie der Rest der Volta-Website. Die Zielgruppe (Hoteliers in Ghana und Togo) liest Englisch bzw. Französisch. Empfehlung: nach dem Launch eine `/en/roomdesk`-Variante ergänzen, die PDF ist bereits englisch.
