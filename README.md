# VoltaDigital CRM — crm.voltadigital.agency

Internes CRM für Jerome Deres Coaching. Multi-tenant-ready (Org-Scoping per RLS),
Phase 1 single-org (`jerome`).

Stack: Next.js 16 App Router · TypeScript · Tailwind 4 · Supabase (DB + Auth) · Vercel.

---

## Phase-1-Scope

- Lead-Liste mit Filter / Suche / Sortierung
- Lead-Detail mit Inline-Edit aller Felder + Notiz-Stream + Activity-Log
- Manueller Lead-Anlage (`/leads/new`)
- Calendly-Webhook (`/api/webhooks/calendly`) mit HMAC-Signatur-Check
- Email/Passwort-Login mit Whitelist
- Stage-Wechsel werden automatisch in `activities` geloggt (DB-Trigger)
- Lost-Stages erzwingen `lost_reason` (UI fragt per Prompt)

Phase 2 (nicht in diesem Build): Kanban, Activity-Icons, Email-Versand, Tasks.

---

## Setup-Reihenfolge

1. Supabase-Projekt → Migration ausführen
2. Auth-User in Supabase Dashboard anlegen (David + Jerome)
3. `.env.local` ausfüllen
4. `npm install && npm run dev` lokal testen
5. Vercel-Projekt anlegen + Domain verbinden
6. Namecheap DNS auf Vercel zeigen
7. Calendly-Webhook eintragen

---

## 1. Supabase-Projekt

1. https://supabase.com/dashboard → **New Project** → Region `eu-central-1`
2. Settings → API → kopieren:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (geheim) → `SUPABASE_SERVICE_ROLE_KEY`
3. SQL Editor → New Query → Inhalt von `supabase/migrations/0001_init.sql` einfügen → **Run**
4. Authentication → Providers → **Email** aktivieren, "Confirm email" deaktivieren
   (für interne User unnötig)

## 2. Auth-User anlegen

Beide User müssen im Supabase Dashboard manuell angelegt werden — der DB-Trigger
`handle_new_user` hängt sie automatisch an die Default-Org `jerome` und legt ein Profil an.

Authentication → Users → **Add user → Create new user**:

| Email                          | Passwort           | Rolle  |
|--------------------------------|--------------------|--------|
| `info@jeromederes.com`         | `ghana2026jerome`  | closer |
| `hallo@voltadigital.agency`    | _(eigenes setzen)_ | admin  |

Nach dem Anlegen für David im SQL Editor zu admin promoten:

```sql
update public.profiles set role = 'admin' where email = 'hallo@voltadigital.agency';
```

> **Warum manuell?** Sicherheits-Policy: Account-Erstellung mit Passwort darf nur
> der Mensch selbst durchführen. Der Trigger erstellt nur das Profil, sobald
> der Auth-User existiert.

## 3. Environment

`.env.local` nach `.env.example` kopieren und ausfüllen:

```bash
cp .env.example .env.local
```

Pflicht-Variablen:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `CALENDLY_WEBHOOK_SECRET` (siehe Schritt 7)
- `AUTHORIZED_EMAILS` — Whitelist als Komma-Liste, default ist okay
- `DEFAULT_ORG_SLUG=jerome`

## 4. Lokal starten

```bash
npm install
npm run dev
```

→ http://localhost:3000/login → mit Jeromes Credentials einloggen.

## 5. Vercel-Deployment

1. https://vercel.com/new → GitHub-Repo importieren (oder per CLI `vercel`)
2. Framework wird als Next.js erkannt — keine Settings ändern
3. **Environment Variables** alle aus `.env.local` einfügen
   (`NEXT_PUBLIC_*` als Production+Preview, Secret-Keys nur Production)
4. **Deploy** klicken → erste Deployment-URL prüfen

## 6. Domain crm.voltadigital.agency

`voltadigital.agency` liegt auf **Vercel-Nameservern** — Subdomain direkt im
Vercel-Projekt anlegen (Settings → **Domains** → `crm.voltadigital.agency`),
DNS-Eintrag und SSL-Zertifikat entstehen automatisch.

> Die frühere Subdomain `crm.jeromederes.com` (Vorgänger-Projekt) ist
> abgeschaltet — Jerome läuft als Kunden-Org in diesem Multi-Tenant-CRM.

## 7. Calendly-Webhook

> Calendly-Webhooks brauchen die Calendly-API. Setup über die UI:
> Account → Integrations → Webhooks → "+ Webhook subscription"

Eintragen:
- **Subscription URL**: `https://crm.voltadigital.agency/api/webhooks/calendly`
- **Events**: `invitee.created`, `invitee.canceled`
- **Scope**: User (oder Organization, wenn Jerome auf Org-Level Calendly-Konto hat)
- **Signing Key generieren** → in `.env.local` und Vercel als
  `CALENDLY_WEBHOOK_SECRET` setzen

> **Wichtig**: Der Webhook erkennt den Event-Typ am **Event-Type-Namen**.
> Dein Calendly-Event-Type muss "Setter" oder "Erstgespraech"/"Erstgespräch"/"60"
> im Namen tragen, sonst wird der Lead mit `skipped: unknown event type`
> abgelehnt (siehe Logs).

## 8. UTMs aus Calendly

Damit UTMs durchgereicht werden, müssen sie an den Calendly-Link angehängt werden,
z.B. von der Landing Page:

```
https://calendly.com/jerome/setter?utm_source=meta&utm_medium=cpc&utm_campaign=cold_lookalike_april
```

Calendly speichert diese im Webhook-Payload unter `payload.invitee.tracking` —
der Webhook übernimmt sie automatisch in die `leads` Tabelle.

## 9. Checkout-Seite `/checkout`

Öffentliche Verkaufsseite für das **5er-Paket 1:1 Sessions — 5 × 60 Minuten mit
Jerome Deres, 1.000 €** (200 € pro Session). **Keine Umsatzsteuer**: der Kunde
zahlt glatt 1.000 €, es gibt keine Netto/MwSt-Aufschlüsselung.

Drei Zahlungsmodelle, alle **ohne Ratenaufschlag**:

| Modell | Abbuchung | Summe |
|---|---|---|
| Einmalzahlung | 1.000,00 € | 1.000,00 € |
| 2 Raten | 2 × 500,00 € monatlich | 1.000,00 € |
| 3 Raten | 3 × 333,33 € monatlich | 999,99 € |

> 1.000 ÷ 3 geht nicht glatt auf, und ein Stripe-Abo bucht jeden Monat denselben
> Betrag. Bei drei Raten bleibt deshalb **1 Cent beim Kunden** (999,99 € statt
> 1.000,00 €). Aufrunden auf 333,34 € wären 1.000,02 € — mehr, als ausgezeichnet
> ist, und damit die schlechtere Richtung. Cent-genaue 1.000 € bräuchten eine
> ungleiche erste Rate über eine Stripe Subscription Schedule.

Die Ratenabos beenden sich selbst: `endInstallmentPlanAfterLastRate` setzt
`cancel_at` auf das Ende der letzten Rate (+5 Tage Puffer), sobald die erste
Zahlung bestätigt ist.

**Setup — in dieser Reihenfolge, bevor die URL an Kunden geht:**

1. **Migration** `supabase/migrations/0017_checkout_orders.sql` im SQL Editor
   ausführen. Ohne die Tabelle scheitert jede Bestellung.
2. **Rechtstexte verlinken**: `NEXT_PUBLIC_LEGAL_AGB_URL`,
   `NEXT_PUBLIC_LEGAL_PRIVACY_URL`, `NEXT_PUBLIC_LEGAL_WITHDRAWAL_URL`,
   `NEXT_PUBLIC_LEGAL_IMPRINT_URL`. Nicht gesetzte Links erscheinen als reiner
   Text — ein Verkauf an Verbraucher ohne diese Dokumente ist nicht zulässig.
3. **Verkaufstexte prüfen**: Name, Beschreibung und Leistungen in
   `lib/checkout.ts` sind Platzhalter und gehören durch die echten ersetzt.
4. **Stripe einrichten** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` und die
   drei Preise `STRIPE_PRICE_CHECKOUT_ONCE` (1.000,00 € einmalig),
   `STRIPE_PRICE_CHECKOUT_2X` (500,00 € monatlich) und
   `STRIPE_PRICE_CHECKOUT_3X` (333,33 € monatlich). Siehe den Steuer-Hinweis
   unten: an keinem der Preise darf ein Steuersatz hängen.
5. Optional: `BREVO_TPL_CHECKOUT_CONFIRMATION` auf eine Brevo-Template-ID setzen
   → automatische Bestellbestätigung. Ohne ID wird keine Mail verschickt.

Nach dem Deploy erreichbar unter `https://crm.voltadigital.agency/checkout`
(bzw. unter der Domain, die auf das Vercel-Projekt zeigt).

**Was beim Absenden passiert** (`app/checkout/actions.ts`):

- Bestellung landet in `checkout_orders` mit Status `offen` und einer
  Bestellnummer (`JD-2608-K3F9`)
- Der Käufer geht zur Stripe-Kasse (Karte, Klarna, SEPA, Link)
- Erst wenn Stripe die Zahlung meldet (`app/checkout/fulfill.ts`), entstehen
  Lead (Stage `won`, `value_estimate = 1000`), Activity und Bestätigungs-Mail —
  ein Abbruch an der Kasse hinterlässt also keinen gewonnenen Deal
- UTMs aus der URL (`/checkout?utm_source=meta&…`) wandern an Bestellung + Lead

> **Ohne Umsatzsteuer — an den Stripe-Preisen darf kein Steuersatz hängen.**
> `lib/checkout.ts` steht auf `vatRate: 0`. Die Seite zeigt dann nur den
> Endbetrag, und die Server Action hängt an der Kasse bewusst keinen Steuersatz
> an. Alle drei Stripe-Prices müssen deshalb ohne Steuersatz und ohne
> automatische Steuer konfiguriert sein — sonst schlägt Stripe trotzdem etwas
> obendrauf.
>
> Wird später doch Umsatzsteuer fällig, reicht `vatRate: 0.19` plus ein
> **inklusiver** Steuersatz in `STRIPE_TAX_RATE`: Anzeige und Aufschlüsselung
> schalten sich mit, der Preis bleibt der Endbetrag. Ein *exklusiver* Satz würde
> aus 1.000 € an der Kasse 1.190 € machen — `assertInclusiveTaxRate` prüft das
> vor jeder Kasse bei Stripe und bricht ab, statt zu viel einzuziehen.

Als Kleinunternehmer gehört der Grund für die fehlende Umsatzsteuer auf die
Seite — Wortlaut über `NEXT_PUBLIC_CHECKOUT_VAT_NOTE` setzen (z. B. „Gemäß § 19
UStG wird keine Umsatzsteuer berechnet."). Ohne die Env steht dort nur
„Keine Umsatzsteuer ausgewiesen."

Preis, Leistungen und Ratenmodelle stehen in `lib/checkout.ts` — für die
Anzeige reicht eine Änderung dort. Der **abgerechnete** Betrag steht in Stripe:
eine Preisänderung braucht immer beides.

---

## Datenmodell (Kurz)

- `organizations` — Multi-Tenant-Container (Phase 1: nur `jerome`)
- `profiles` — verbindet `auth.users` mit `org_id` + `role`
- `leads` — alle Felder mit `org_id`-Scoping per RLS
- `activities` — Audit-Log (Trigger schreibt automatisch bei `stage`-Änderung)

RLS-Policies: alle Tabellen filtern strikt auf `current_org_id()`,
das aus dem `profiles.org_id` des eingeloggten Users gelesen wird.

## Wichtige Pfade

```
app/
  page.tsx                    # Lead-Liste (Server Component)
  login/                      # Email/Passwort Login
  leads/
    actions.ts                # Server Actions (updateLead, addNote, createLead)
    new/page.tsx              # Manueller Lead
    [id]/page.tsx             # Lead-Detail
    [id]/lead-editor.tsx      # Inline-Edit Client Component
    [id]/note-form.tsx        # Notiz-Eingabe
  checkout/                   # ÖFFENTLICHE Checkout-Seite (5 × 60 Min, 1.000 €)
    page.tsx                  # Angebot + Bestellübersicht
    checkout-form.tsx         # Formular (Client Component)
    actions.ts                # submitCheckout → Bestellung + Lead
    danke/page.tsx            # Bestellnummer + Zahlungsdaten
  api/webhooks/calendly/      # HMAC-verifizierter Webhook
  api/auth/check/             # Whitelist-Check vor Login
  api/auth/signout/           # Server-Side Logout
middleware.ts                 # Auth-Gate
lib/types.ts                  # Stage/Source Enums + Labels
lib/checkout.ts               # Checkout-Angebot (Preis, Raten, Validierung)
lib/supabase/                 # Server- + Browser-Clients
supabase/migrations/0001_init.sql
```

## Troubleshooting

- **"Diese Email ist nicht autorisiert"** → `AUTHORIZED_EMAILS` env prüfen
- **Calendly-Webhook gibt 401** → Signing Secret falsch oder noch nicht in Vercel
  als Env gesetzt (Redeploy nicht vergessen)
- **Lead taucht nicht auf nach Buchung** → Calendly Event-Type-Name muss "Setter"
  oder "Erstgespräch"/"60" enthalten; Vercel-Logs unter Functions checken
- **RLS blockt Queries** → User-Profil prüfen: `select * from profiles where email = '...'`
  muss eine Zeile mit `org_id` zurückgeben

## Phase 2 Roadmap

- `/board` Kanban (dnd-kit)
- Activity-Timeline mit Icons + Filter
- Brevo-Integration für Email-Versand aus Lead-Detail
- Tasks/Reminders
- Multi-Org-Onboarding-Flow + Subdomain-Routing pro Org
