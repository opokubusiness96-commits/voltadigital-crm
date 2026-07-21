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
  api/webhooks/calendly/      # HMAC-verifizierter Webhook
  api/auth/check/             # Whitelist-Check vor Login
  api/auth/signout/           # Server-Side Logout
middleware.ts                 # Auth-Gate
lib/types.ts                  # Stage/Source Enums + Labels
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
