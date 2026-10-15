# RoomDesk – Vorstellungsseite und Unterlagen

RoomDesk ist die Hotel-Buchungssoftware von Volta Digital für kleine und mittlere Hotels in Westafrika
(zuerst Ghana, dann Togo). Die Software selbst läuft unter https://book.voltadigital.agency und ist
nicht Teil dieses Repos. Hier liegt alles für den öffentlichen Reiter „RoomDesk“ auf voltadigital.agency.

| Pfad | Inhalt |
|---|---|
| `website-drop-in/` | Fertiger Next.js-Code für die Volta-Website: Seite `/roomdesk`, Formular „Hotel anfragen“, API-Route mit Brevo-Anbindung (SOURCE = roomdesk), PDF. Einbau-Anleitung in `website-drop-in/README-roomdesk.md`. |
| `roomdesk-vorschau.html` | Statische Vorschau der Seite im weißen Volta-Design, im Browser direkt öffnen. Formular sendet in der Vorschau nichts. |
| `roomdesk-hotel-questionnaire.pdf` | Englischer Fragebogen für Hotels (18 Fragen), zum Ausfüllen und Zurückschicken per E-Mail oder WhatsApp. |
| `Anbieter-Vergleich_roomdesk.app.pdf` | Zusammenfassung des fremden Anbieters roomdesk.app (nicht unser Produkt), zur Abgrenzung. |

## Website-Projekt

Die Volta-Website liegt lokal auf dem Mac unter `Desktop/der alles ordner/Volta Digital/volta-digital`
und wird direkt per Vercel-Befehl in das Projekt `volta-digital` veröffentlicht. Zum Einbau die drei
Ordner aus `website-drop-in/` ins Projekt kopieren und der Anleitung folgen.

## Vertrieb (intern, nicht auf der Seite)

- Preisanker: „kostet weniger als eine Zimmernacht pro Monat“, kleinere Häuser zahlen weniger.
- Pilot: Richop und die ersten 3 bis 5 Hotels kostenlos oder stark vergünstigt, dafür Testimonial und Referenz.
- Verkauf über direkte Ansprache per WhatsApp oder Anruf plus 15-Minuten-Demo am Handy, nicht über Anzeigen.
