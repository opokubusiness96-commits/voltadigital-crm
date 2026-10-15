"use client";

import { useState } from "react";

const BOOKING_OPTIONS = [
  "Telefon / WhatsApp",
  "Walk-ins",
  "Booking.com",
  "Eigene Website",
  "Sonstiges",
] as const;

const inputCls =
  "w-full rounded-md border border-[#D9D3C5] bg-white px-3.5 py-2.5 text-sm text-[#141311] outline-none transition placeholder:text-[#A39B8D] focus:border-[#B8962E] focus:ring-2 focus:ring-[#B8962E]/25";
const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#4A463F]";

export function RoomdeskForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch("/api/roomdesk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error || "Senden fehlgeschlagen. Bitte versuche es nochmal oder schreib uns per WhatsApp.");
        setStatus("error");
        return;
      }
      setStatus("done");
      form.reset();
    } catch {
      setError("Keine Verbindung. Bitte prüfe dein Internet und versuche es nochmal.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-[#D9D3C5] bg-white p-8" role="status">
        <p className="font-serif text-2xl font-semibold text-[#B8962E]">Danke!</p>
        <p className="mt-2 text-base font-semibold">Wir melden uns innerhalb von 24 Stunden mit einer Demo.</p>
        <p className="mt-2 text-sm text-[#4A463F]">
          Halte dein WhatsApp bereit. Wenn du es eilig hast, schreib uns direkt an hallo@voltadigital.agency.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-[#D9D3C5] bg-white p-6 md:p-8" noValidate={false}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="rd-hotel" className={labelCls}>Name des Hotels *</label>
          <input id="rd-hotel" name="hotel" required className={inputCls} placeholder="z. B. Lakeside Guest House" />
        </div>
        <div>
          <label htmlFor="rd-location" className={labelCls}>Land und Stadt *</label>
          <input id="rd-location" name="location" required className={inputCls} placeholder="Ghana, Accra" />
        </div>
        <div>
          <label htmlFor="rd-rooms" className={labelCls}>Anzahl Zimmer *</label>
          <input id="rd-rooms" name="rooms" type="number" min={1} max={999} required className={inputCls} placeholder="12" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="rd-booking" className={labelCls}>Wie läuft die Buchung aktuell?</label>
          <select id="rd-booking" name="booking_process" className={inputCls} defaultValue="">
            <option value="">Bitte wählen</option>
            {BOOKING_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="rd-contact" className={labelCls}>Ansprechpartner *</label>
          <input id="rd-contact" name="contact_name" required className={inputCls} placeholder="Name und Rolle, z. B. Ama Mensah, Managerin" />
        </div>
        <div>
          <label htmlFor="rd-email" className={labelCls}>E-Mail *</label>
          <input id="rd-email" name="email" type="email" required className={inputCls} placeholder="name@hotel.com" />
        </div>
        <div>
          <label htmlFor="rd-whatsapp" className={labelCls}>WhatsApp-Nummer *</label>
          <input id="rd-whatsapp" name="whatsapp" type="tel" required className={inputCls} placeholder="+233 24 000 0000" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="rd-message" className={labelCls}>Nachricht (optional)</label>
          <textarea id="rd-message" name="message" rows={4} className={inputCls} placeholder="Was ist dir bei der Buchung heute am wichtigsten?" />
        </div>
      </div>
      {error && (
        <p className="mt-4 rounded-md border border-[#C8322B]/40 bg-[#C8322B]/5 px-3 py-2 text-sm text-[#8F1F1A]" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-6 w-full rounded-md bg-[#141311] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2A2622] disabled:opacity-60"
      >
        {status === "sending" ? "Wird gesendet…" : "Hotel anfragen"}
      </button>
      <p className="mt-3 text-xs text-[#8A8275]">
        Mit dem Absenden stimmst du zu, dass wir dich per E-Mail oder WhatsApp zu RoomDesk kontaktieren.
      </p>
    </form>
  );
}
