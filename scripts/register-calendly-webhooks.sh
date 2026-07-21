#!/usr/bin/env bash
# Calendly-Webhooks für das Volta-CRM verwalten (Simon + Jerome, getrennte Accounts).
#
# Beide Subscriptions werden mit DEMSELBEN signing_key angelegt, damit der
# Webhook-Endpoint mit einem einzigen CALENDLY_WEBHOOK_SECRET auskommt
# (app/api/webhooks/calendly prüft genau ein Secret).
#
# Voraussetzung: Personal Access Token aus JEDEM Account (Calendly →
# Integrations → API & webhooks → Personal access tokens). Bezahlter Plan
# (Standard+) nötig — Webhooks gibt es nicht im Free-Plan.
#
# Nutzung:
#   SIMON_PAT=eyJ... JEROME_PAT=eyJ... scripts/register-calendly-webhooks.sh register
#   SIMON_PAT=eyJ... JEROME_PAT=eyJ... scripts/register-calendly-webhooks.sh list
#   SIMON_PAT=eyJ...                   scripts/register-calendly-webhooks.sh delete <webhook_uri>
#
#   register  legt in beiden Accounts eine Subscription auf das Volta-CRM an
#             und gibt am Ende den signing_key aus → als CALENDLY_WEBHOOK_SECRET
#             in Vercel (Production) setzen + Redeploy.
#   list      zeigt alle vorhandenen Subscriptions beider Accounts — damit
#             findest du auch die alten auf crm.jeromederes.com.
#   delete    löscht eine Subscription per URI (PAT des BESITZER-Accounts nötig).
set -euo pipefail

WEBHOOK_URL="https://crm.voltadigital.agency/api/webhooks/calendly"
API="https://api.calendly.com"
CMD="${1:-register}"

json() { python3 -c "import json,sys;d=json.load(sys.stdin);$1"; }

me_lookup() { # $1=PAT → setzt USER_URI + ORG_URI
  local body
  body=$(curl -sf -H "Authorization: Bearer $1" "$API/users/me")
  USER_URI=$(echo "$body" | json "print(d['resource']['uri'])")
  ORG_URI=$(echo "$body" | json "print(d['resource']['current_organization'])")
}

each_account() { # ruft $1 mit (Name, PAT) für jeden gesetzten PAT auf
  local fn="$1"
  [ -n "${SIMON_PAT:-}" ] && "$fn" "Simon" "$SIMON_PAT"
  [ -n "${JEROME_PAT:-}" ] && "$fn" "Jerome" "$JEROME_PAT"
  if [ -z "${SIMON_PAT:-}" ] && [ -z "${JEROME_PAT:-}" ]; then
    echo "FEHLER: SIMON_PAT und/oder JEROME_PAT als Env-Variable setzen." >&2
    exit 1
  fi
}

do_register() { # $1=Name $2=PAT
  echo "── $1: Subscription anlegen ──"
  me_lookup "$2"
  echo "  User-URI: $USER_URI   (für die SETTERS-Map im Webhook)"
  local resp http
  resp=$(curl -s -w "\n%{http_code}" -X POST "$API/webhook_subscriptions" \
    -H "Authorization: Bearer $2" -H "Content-Type: application/json" \
    -d "{\"url\":\"$WEBHOOK_URL\",\"events\":[\"invitee.created\",\"invitee.canceled\"],\"organization\":\"$ORG_URI\",\"user\":\"$USER_URI\",\"scope\":\"user\",\"signing_key\":\"$SIGNING_KEY\"}")
  http=$(echo "$resp" | tail -1)
  if [ "$http" = "201" ]; then
    echo "  ✅ angelegt: $(echo "$resp" | sed '$d' | json "print(d['resource']['uri'])")"
  else
    echo "  ❌ HTTP $http — Antwort:"
    echo "$resp" | sed '$d' | python3 -m json.tool 2>/dev/null | sed 's/^/     /' | head -8
  fi
}

do_list() { # $1=Name $2=PAT
  echo "── $1: vorhandene Subscriptions ──"
  me_lookup "$2"
  curl -sf -H "Authorization: Bearer $2" \
    "$API/webhook_subscriptions?organization=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$ORG_URI")&user=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$USER_URI")&scope=user" \
    | json "print('\n'.join(f\"  {c['state']:8} {c['callback_url']}\n           {c['uri']}\" for c in d['collection']) or '  (keine)')"
}

case "$CMD" in
  register)
    SIGNING_KEY="${SIGNING_KEY:-$(openssl rand -hex 32)}"
    each_account do_register
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "SIGNING KEY (→ Vercel-Projekt voltadigital-crm, Production,"
    echo "als CALENDLY_WEBHOOK_SECRET setzen, dann Redeploy):"
    echo ""
    echo "  $SIGNING_KEY"
    echo "════════════════════════════════════════════════════════════"
    ;;
  list)
    each_account do_list
    ;;
  delete)
    URI="${2:?Nutzung: delete <webhook_uri>}"
    PAT="${SIMON_PAT:-${JEROME_PAT:?PAT des Besitzer-Accounts setzen}}"
    curl -sf -X DELETE -H "Authorization: Bearer $PAT" "$URI" \
      && echo "✅ gelöscht: $URI" \
      || echo "❌ Löschen fehlgeschlagen (richtiger Account-PAT? URI korrekt?)"
    ;;
  *)
    echo "Unbekanntes Kommando: $CMD (register | list | delete)" >&2; exit 1 ;;
esac
