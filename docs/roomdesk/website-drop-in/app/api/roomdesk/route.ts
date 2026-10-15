import { NextResponse } from "next/server";

/**
 * RoomDesk "Hotel anfragen" – Formular-Endpunkt.
 *
 * 1. Legt den Kontakt in Brevo an (bzw. aktualisiert ihn), Attribut SOURCE = "roomdesk".
 * 2. Schickt eine Benachrichtigungs-Mail mit allen Feldern an hallo@voltadigital.agency.
 *
 * Env: BREVO_API_KEY (Pflicht), BREVO_SENDER_EMAIL, BREVO_SENDER_NAME,
 *      BREVO_ROOMDESK_LIST_ID (optional, numerische Listen-ID in Brevo),
 *      ROOMDESK_NOTIFY_EMAIL (Default hallo@voltadigital.agency).
 *
 * Wenn die Website bereits einen Brevo-Helper für den Website-Fragebogen hat,
 * diesen hier importieren und die beiden fetch-Aufrufe unten dadurch ersetzen.
 */

const BREVO_CONTACTS = "https://api.brevo.com/v3/contacts";
const BREVO_SMTP = "https://api.brevo.com/v3/smtp/email";

type Payload = {
  hotel?: string;
  location?: string;
  rooms?: string;
  booking_process?: string;
  contact_name?: string;
  email?: string;
  whatsapp?: string;
  message?: string;
};

const REQUIRED: (keyof Payload)[] = ["hotel", "location", "rooms", "contact_name", "email", "whatsapp"];

function clean(v: unknown, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }

  const data = {
    hotel: clean(body.hotel, 200),
    location: clean(body.location, 200),
    rooms: clean(body.rooms, 10),
    booking_process: clean(body.booking_process, 100),
    contact_name: clean(body.contact_name, 200),
    email: clean(body.email, 200).toLowerCase(),
    whatsapp: clean(body.whatsapp, 50),
    message: clean(body.message, 2000),
  };

  const missing = REQUIRED.filter((k) => !data[k]);
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, error: "Bitte alle Pflichtfelder ausfüllen." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return NextResponse.json({ ok: false, error: "Bitte eine gültige E-Mail-Adresse angeben." }, { status: 400 });
  }
  const rooms = parseInt(data.rooms, 10);
  if (!Number.isFinite(rooms) || rooms < 1) {
    return NextResponse.json({ ok: false, error: "Bitte die Anzahl der Zimmer als Zahl angeben." }, { status: 400 });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("[roomdesk] BREVO_API_KEY fehlt");
    return NextResponse.json({ ok: false, error: "Server nicht konfiguriert." }, { status: 500 });
  }

  const headers = { "api-key": apiKey, "content-type": "application/json", accept: "application/json" };
  const sender = {
    email: process.env.BREVO_SENDER_EMAIL || "hallo@voltadigital.agency",
    name: process.env.BREVO_SENDER_NAME || "Volta Digital",
  };
  const notifyTo = process.env.ROOMDESK_NOTIFY_EMAIL || "hallo@voltadigital.agency";
  const listId = parseInt(process.env.BREVO_ROOMDESK_LIST_ID || "", 10);

  // 1) Kontakt in Brevo anlegen / aktualisieren
  const [firstName, ...rest] = data.contact_name.split(" ");
  const contactRes = await fetch(BREVO_CONTACTS, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: data.email,
      updateEnabled: true,
      ...(Number.isFinite(listId) ? { listIds: [listId] } : {}),
      attributes: {
        SOURCE: "roomdesk",
        FIRSTNAME: firstName || "",
        LASTNAME: rest.join(" "),
        SMS: data.whatsapp,
        WHATSAPP: data.whatsapp,
        HOTEL: data.hotel,
        HOTEL_LOCATION: data.location,
        HOTEL_ROOMS: rooms,
        BOOKING_PROCESS: data.booking_process,
      },
    }),
  });
  if (!contactRes.ok) {
    // Nicht abbrechen: die Benachrichtigung ist wichtiger als der Kontakt-Datensatz.
    console.error("[roomdesk] Brevo contact failed", contactRes.status, await contactRes.text());
  }

  // 2) Benachrichtigung an Volta Digital
  const lines: [string, string][] = [
    ["Hotel", data.hotel],
    ["Land und Stadt", data.location],
    ["Anzahl Zimmer", String(rooms)],
    ["Aktueller Buchungsprozess", data.booking_process || "– keine Angabe"],
    ["Ansprechpartner", data.contact_name],
    ["E-Mail", data.email],
    ["WhatsApp", data.whatsapp],
    ["Nachricht", data.message || "– keine Angabe"],
  ];
  const textContent = `ROOMDESK-ANFRAGE\n\n${lines.map(([k, v]) => `${k}: ${v}`).join("\n")}\n`;
  const htmlContent = `<h2 style="font-family:Georgia,serif;color:#B8962E;margin:0 0 4px">RoomDesk</h2>
<p style="margin:0 0 16px;color:#555">Neue Hotel-Anfrage über voltadigital.agency/roomdesk</p>
<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
${lines.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#777;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}
</table>`;

  const mailRes = await fetch(BREVO_SMTP, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sender,
      to: [{ email: notifyTo, name: "Volta Digital" }],
      replyTo: { email: data.email, name: data.contact_name },
      subject: `RoomDesk-Anfrage: ${data.hotel} (${data.location})`,
      textContent,
      htmlContent,
      tags: ["roomdesk"],
    }),
  });
  if (!mailRes.ok) {
    console.error("[roomdesk] Brevo notify failed", mailRes.status, await mailRes.text());
    return NextResponse.json({ ok: false, error: "Senden fehlgeschlagen. Bitte versuche es nochmal." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
