#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Nikola MDK System — zwei Benutzer anlegen und dem Mandanten zuordnen
#
# Legt via Supabase Admin API zwei Auth-User an und patcht ihre profiles-Zeile
# auf die Nikola-Org (org_id), Rolle, Anzeigename und Avatar (avatar_emoji +
# marker_color). RLS bleibt intakt: durch org_id = nikola sehen sie NUR Nikola-Leads.
#
# WICHTIG:
#   - Erst 10_nikola_tenant.sql einspielen (Org + avatar_emoji-Spalte müssen existieren).
#   - Der Trigger handle_new_user hängt neue User zunächst an 'jerome'; dieses Script
#     überschreibt org_id direkt danach auf Nikola. Ohne diesen Patch landen die
#     User im FALSCHEN Mandanten.
#   - Rolle "Coach" existiert im Schema nicht → hier auf 'admin' abgebildet
#     (Inhaber-Vollzugriff auf DEN EIGENEN Mandanten). Bei Bedarf ROLE_COACH ändern.
#   - "Passwort beim ersten Login ändern": Supabase hat KEIN natives Flag. Wird als
#     user_metadata.must_change_password=true gesetzt (die App muss das auswerten).
#
# Nutzung:
#   cd voltadigital-crm
#   set -a; source .env.local; set +a
#   export NIKOLA_COACH_EMAIL=... NIKOLA_COACH_PASSWORD=... \
#          NIKOLA_CLOSER_EMAIL=... NIKOLA_CLOSER_PASSWORD=...
#   bash supabase/tenants/nikola-mdk-system/20_create_users.sh
#
# Benötigt: curl, jq
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL fehlt (aus .env.local sourcen)}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY fehlt (aus .env.local sourcen)}"
# Credentials NICHT im Repo (public!) — vor Aufruf als Env setzen:
: "${NIKOLA_COACH_EMAIL:?NIKOLA_COACH_EMAIL fehlt}"
: "${NIKOLA_COACH_PASSWORD:?NIKOLA_COACH_PASSWORD fehlt}"
: "${NIKOLA_CLOSER_EMAIL:?NIKOLA_CLOSER_EMAIL fehlt}"
: "${NIKOLA_CLOSER_PASSWORD:?NIKOLA_CLOSER_PASSWORD fehlt}"

URL="$NEXT_PUBLIC_SUPABASE_URL"
KEY="$SUPABASE_SERVICE_ROLE_KEY"
ORG_SLUG="nikola-mdk-system"
ROLE_COACH="admin"   # "Coach" → admin (kein 'coach' im Check-Constraint). Anpassbar.

command -v jq >/dev/null || { echo "jq wird benötigt (brew install jq)"; exit 1; }

# Nikola-Org-ID holen
ORG_ID=$(curl -s "$URL/rest/v1/organizations?slug=eq.$ORG_SLUG&select=id" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq -r '.[0].id // empty')
if [ -z "$ORG_ID" ]; then
  echo "❌ Org '$ORG_SLUG' nicht gefunden. Erst 10_nikola_tenant.sql einspielen."
  exit 1
fi
echo "→ Nikola org_id: $ORG_ID"

# create_user EMAIL PASSWORT ROLLE ANZEIGENAME AVATAR_EMOJI MARKER_COLOR
create_user() {
  local email="$1" pass="$2" role="$3" name="$4" emoji="$5" color="$6"

  echo "→ Lege an: $email (role=$role)"
  local resp uid
  resp=$(curl -s "$URL/auth/v1/admin/users" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg e "$email" --arg p "$pass" \
        '{email:$e, password:$p, email_confirm:true,
          user_metadata:{must_change_password:true}}')")

  uid=$(echo "$resp" | jq -r '.id // empty')
  if [ -z "$uid" ]; then
    # evtl. existiert der User schon → per E-Mail nachschlagen
    uid=$(curl -s "$URL/auth/v1/admin/users?per_page=200" \
      -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
      | jq -r --arg e "$email" '.users[] | select(.email==$e) | .id' | head -1)
  fi
  [ -z "$uid" ] && { echo "❌ Konnte User-ID für $email nicht ermitteln:"; echo "$resp"; exit 1; }
  echo "   auth id: $uid"

  # profiles-Zeile auf Nikola patchen (Trigger hat sie zunächst an jerome gehängt).
  # Upsert per POST + merge-duplicates, falls der Trigger deaktiviert sein sollte.
  curl -s "$URL/rest/v1/profiles?on_conflict=id" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates,return=representation" \
    -d "$(jq -n --arg id "$uid" --arg org "$ORG_ID" --arg em "$email" \
          --arg r "$role" --arg n "$name" --arg av "$emoji" --arg mc "$color" \
          '{id:$id, org_id:$org, email:$em, role:$r,
            display_name:$n, avatar_emoji:$av, marker_color:$mc}')" \
    | jq -r '.[0] | "   profile → org=\(.org_id) role=\(.role) avatar=\(.avatar_emoji)"'
}

# ── Benutzer 1: Coach (Physioboii Bordeaux) ──────────────────────────────────
create_user "$NIKOLA_COACH_EMAIL"  "$NIKOLA_COACH_PASSWORD"  "$ROLE_COACH" \
            "Ahmad (Coach)"   "🩺" "#5F021F"

# ── Benutzer 2: Closer (Physioboii Waldgrün) ─────────────────────────────────
create_user "$NIKOLA_CLOSER_EMAIL" "$NIKOLA_CLOSER_PASSWORD" "closer" \
            "Nikola Uljarevic" "🎯" "#2F5D50"

echo
echo "✅ Fertig. Kontrolle:"
curl -s "$URL/rest/v1/profiles?org_id=eq.$ORG_ID&select=email,role,display_name,avatar_emoji,marker_color" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq .
