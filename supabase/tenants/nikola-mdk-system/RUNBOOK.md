# Runbook — Mandant „Nikola MDK System"

Landingpage: https://mdk-system.lovable.app/schmerzfrei

## Ausgangslage (live geprüft am 2026-07-02)
- Supabase-Projekt `lysphikolwkrltjnuzlf` ist **leer** — keine der Migrationen 0001–0009
  ist eingespielt (kein `organizations`/`profiles`/`leads`).
- Auth enthält **einen** User: `hallo@voltadigital.agency`.
- Es gibt **keinen** „Jerome Coaching"-Mandanten in dieser DB, von dem man kopieren könnte.
- Die 7 Kanban-Stages sind **globale Frontend-Konstanten** (`lib/types.ts`), keine
  per-Tenant-Daten → jeder Workspace rendert sie automatisch identisch. Nichts zu duplizieren.

## Entscheidungen / Defaults in diesen Artefakten
| Thema | Default | Anpassen in |
|---|---|---|
| Rolle „Coach" (existiert nicht: nur admin/closer/setter/viewer) | → `admin` (Inhaber-Vollzugriff auf eigenen Mandanten) | `20_create_users.sh` → `ROLE_COACH` |
| Branding Physioboii | Daten angelegt, **Frontend-Wiring offen** | `30_branding_optional.sql` + `app/layout.tsx` |
| Passwort-Wechsel bei 1. Login | Soft-Flag `user_metadata.must_change_password` (kein natives Supabase-Flag) | App-Gate nötig |

## Schritte

### 1. Basis-Schema deployen  ⚠️ Produktions-Write — Freigabe nötig
```bash
cd voltadigital-crm
# avatar_emoji-Lücke: 10_nikola_tenant.sql legt die Spalte idempotent mit an.
supabase link --project-ref lysphikolwkrltjnuzlf   # falls noch nicht verlinkt
supabase db push                                    # spielt Migrationen 0001–0009 ein
```
Prüfen:
```bash
set -a; source .env.local; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/organizations?select=slug" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
# erwartet: [{"slug":"jerome"}]
```

### 2. Nikola-Mandant + Tags anlegen
`10_nikola_tenant.sql` im Supabase SQL-Editor ausführen (oder via psql/`supabase db execute`).

### 3. Zwei Benutzer anlegen  ⚠️ legt echte Accounts an
```bash
set -a; source .env.local; set +a
export NIKOLA_COACH_EMAIL=... NIKOLA_COACH_PASSWORD=... \
       NIKOLA_CLOSER_EMAIL=... NIKOLA_CLOSER_PASSWORD=...
bash supabase/tenants/nikola-mdk-system/20_create_users.sh
```
Erzeugt (E-Mails/Passwörter kommen aus Env-Vars — nicht im Repo, public!):
- `$NIKOLA_COACH_EMAIL` — Coach → role `admin`, Avatar 🩺, Marker `#5F021F`
- `$NIKOLA_CLOSER_EMAIL` — Closer → role `closer`, Avatar 🎯, Marker `#2F5D50`
Beide `org_id = nikola-mdk-system`, `must_change_password = true`.

### 4. (Optional) Branding
`30_branding_optional.sql` ausführen **und** in `app/layout.tsx` die org-Farben als
CSS-Variablen injizieren (`--color-accent` = `brand_accent`, `--color-bg` = `brand_background`,
Buttons/Won-Badge = `brand_primary`). Ohne diesen Frontend-Schritt bleibt das Gold-Theme.

## Tests (nach Schritt 1–3)
1. **Login** je Account gegen die laufende App (nicht Fake-Auth: `NEXT_PUBLIC_DEV_FAKE_AUTH`
   in `.env.local` auf `false`, bzw. gegen die deployte Instanz).
2. **Mandanten-Trennung / RLS:** Als Nikola-User eingeloggt darf `GET /rest/v1/leads`
   **0** Jerome-Leads zurückgeben. Gegencheck mit dem anon-Key + User-JWT (nicht Service-Key,
   der umgeht RLS):
   ```
   # RLS-Beweis: mit User-JWT dürfen nur org_id=nikola-Zeilen sichtbar sein
   ```
3. **Kanban:** Board rendert alle 7 Stages (Setter Call gebucht → Setter No-Show →
   Setter Lost → Klarheitsgespräch gebucht → Klarheitsgespräch No-Show → Won → Lost),
   „Won" mit Gold-Akzent.

## Rückbau (falls nötig)
```sql
delete from public.profiles  where org_id = (select id from public.organizations where slug='nikola-mdk-system');
delete from public.tags      where org_id = (select id from public.organizations where slug='nikola-mdk-system');
delete from public.organizations where slug = 'nikola-mdk-system';
-- Auth-User: via Admin API DELETE /auth/v1/admin/users/<id>
```
