"use server";

import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { sendBrevoEmail } from "@/lib/brevo";
import { bankDetails } from "@/lib/checkout-bank";
import {
  CHECKOUT_OFFER,
  findPlan,
  formatPrice,
  makeOrderReference,
  validateCheckout,
  vatSplit,
  type CheckoutInput,
  type FieldErrors,
} from "@/lib/checkout";

export type CheckoutResult =
  | { ok: true; reference: string }
  | { ok: false; error: string; fields?: FieldErrors };

function isDevFake(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEV_FAKE_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

const trim = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * Bestellung der öffentlichen Checkout-Seite entgegennehmen.
 *
 * Läuft ohne Login — deshalb:
 *  - Betrag/Raten kommen NIE aus dem Formular, sondern aus lib/checkout.ts
 *  - geschrieben wird mit dem Service-Role-Key (RLS-Bypass, siehe Migration 0017);
 *    es gibt bewusst keine anonyme insert-Policy
 *  - alle Eingaben werden hier nochmal validiert und längenbegrenzt
 *
 * Es ist KEIN Payment-Provider angebunden: die Bestellung wird verbindlich
 * erfasst (Status "offen"), bezahlt wird per Überweisung mit der Bestellnummer
 * als Verwendungszweck. Der Status wird im CRM auf "bezahlt" gesetzt.
 */
export async function submitCheckout(raw: CheckoutInput): Promise<CheckoutResult> {
  const input: CheckoutInput = {
    firstName: trim(raw.firstName, 80),
    lastName: trim(raw.lastName, 80),
    email: trim(raw.email, 160).toLowerCase(),
    phone: trim(raw.phone, 40),
    company: trim(raw.company, 120),
    vatId: trim(raw.vatId, 40),
    street: trim(raw.street, 160),
    postalCode: trim(raw.postalCode, 16),
    city: trim(raw.city, 100),
    country: trim(raw.country, 80) || "Deutschland",
    planId: trim(raw.planId, 20),
    notes: trim(raw.notes, 1000),
    acceptTerms: raw.acceptTerms === true,
    acceptWithdrawal: raw.acceptWithdrawal === true,
    utmSource: trim(raw.utmSource, 120) || undefined,
    utmMedium: trim(raw.utmMedium, 120) || undefined,
    utmCampaign: trim(raw.utmCampaign, 120) || undefined,
    utmContent: trim(raw.utmContent, 120) || undefined,
  };

  const fields = validateCheckout(input);
  if (Object.keys(fields).length > 0) {
    return { ok: false, error: "Bitte die markierten Felder prüfen.", fields };
  }

  // Betrag serverseitig auflösen — das Formular liefert nur die plan-ID.
  const plan = findPlan(input.planId)!;
  const fullName = `${input.firstName} ${input.lastName}`.trim();

  // DEV-ONLY: ohne echtes Backend durchklickbar (analog getSupabaseServer).
  if (isDevFake()) {
    return { ok: true, reference: makeOrderReference(new Date()) };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("checkout: Supabase-Env fehlt (URL / SERVICE_ROLE_KEY)");
    return { ok: false, error: "Bestellung konnte nicht gespeichert werden. Bitte per E-Mail melden." };
  }

  const admin = getSupabaseServiceRole();

  // Ziel-Org auflösen (Angebot gehört zu genau einer Org).
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", CHECKOUT_OFFER.orgSlug)
    .maybeSingle();

  if (orgError || !org?.id) {
    console.error("checkout: Org nicht gefunden", CHECKOUT_OFFER.orgSlug, orgError?.message);
    return { ok: false, error: "Bestellung konnte nicht gespeichert werden. Bitte per E-Mail melden." };
  }
  const orgId = org.id as string;

  // 1. Lead in der Pipeline finden oder anlegen (Bestellung = gewonnener Deal).
  const leadId = await upsertLead(admin, orgId, input, fullName, plan.total);

  // 2. Bestellung schreiben. reference ist unique → bei Kollision neu würfeln.
  let reference = "";
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const candidate = makeOrderReference(new Date());
    const { error } = await admin.from("checkout_orders").insert({
      org_id: orgId,
      reference: candidate,
      offer_slug: CHECKOUT_OFFER.slug,
      offer_name: CHECKOUT_OFFER.name,
      plan_id: plan.id,
      installments: plan.installments,
      amount_gross: plan.total,
      vat_rate: CHECKOUT_OFFER.vatRate,
      currency: CHECKOUT_OFFER.currency,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone || null,
      company: input.company || null,
      vat_id: input.vatId || null,
      street: input.street,
      postal_code: input.postalCode,
      city: input.city,
      country: input.country,
      notes: input.notes || null,
      status: "offen",
      lead_id: leadId,
      utm_source: input.utmSource ?? null,
      utm_medium: input.utmMedium ?? null,
      utm_campaign: input.utmCampaign ?? null,
      utm_content: input.utmContent ?? null,
    });

    if (!error) {
      reference = candidate;
      break;
    }
    // 23505 = unique_violation auf reference → nächster Versuch
    if ((error as { code?: string }).code !== "23505") {
      lastError = error.message;
      break;
    }
  }

  if (!reference) {
    console.error("checkout: insert fehlgeschlagen", lastError);
    return { ok: false, error: "Bestellung konnte nicht gespeichert werden. Bitte per E-Mail melden." };
  }

  // 3. Activity am Lead (best-effort — die Bestellung selbst steht bereits).
  if (leadId) {
    const { error: activityError } = await admin.from("activities").insert({
      org_id: orgId,
      lead_id: leadId,
      type: "note",
      content: `Checkout-Bestellung ${reference} — ${CHECKOUT_OFFER.name}, ${plan.label} (${formatPrice(plan.total)} brutto)`,
      meta: { source: "checkout", reference, plan_id: plan.id, amount_gross: plan.total },
    });
    if (activityError) console.error("checkout: Activity-Log fehlgeschlagen", activityError.message);
  }

  // 4. Bestätigungs-Mail (nur wenn ein Brevo-Template hinterlegt ist).
  await sendConfirmation(input, fullName, reference, plan.label, plan.installmentAmount, plan.installments);

  return { ok: true, reference };
}

type AdminClient = ReturnType<typeof getSupabaseServiceRole>;

/**
 * Bestehenden Lead (gleiche Org + gleiche E-Mail) auf "won" heben oder einen
 * neuen anlegen. Fehler hier dürfen die Bestellung nicht kippen → null zurück,
 * die Bestellung wird dann ohne lead_id gespeichert.
 */
async function upsertLead(
  admin: AdminClient,
  orgId: string,
  input: CheckoutInput,
  fullName: string,
  amount: number,
): Promise<string | null> {
  try {
    // ilike statt eq: manuell angelegte Leads (/leads/new) speichern die E-Mail
    // ungeändert, können also gemischte Schreibweise haben. Dafür müssen %, _ und
    // \ escaped werden — sonst wäre "max_mustermann@…" ein Suchmuster und träfe
    // fremde Leads.
    const emailPattern = input.email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: existing } = await admin
      .from("leads")
      .select("id, name, first_name, last_name, phone")
      .eq("org_id", orgId)
      .ilike("email", emailPattern)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      // Vorhandene Felder nicht überschreiben — nur Lücken füllen.
      const { error } = await admin
        .from("leads")
        .update({
          stage: "won",
          value_estimate: amount,
          name: existing.name || fullName,
          first_name: existing.first_name || input.firstName,
          last_name: existing.last_name || input.lastName,
          phone: existing.phone || input.phone || null,
        })
        .eq("id", existing.id as string);
      if (error) throw new Error(error.message);
      return existing.id as string;
    }

    const { data: created, error } = await admin
      .from("leads")
      .insert({
        org_id: orgId,
        source: "manual",
        source_manual: `Checkout ${CHECKOUT_OFFER.name}`,
        stage: "won",
        name: fullName,
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone || null,
        value_estimate: amount,
        notes: input.notes || null,
        utm_source: input.utmSource ?? null,
        utm_medium: input.utmMedium ?? null,
        utm_campaign: input.utmCampaign ?? null,
        utm_content: input.utmContent ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return (created?.id as string) ?? null;
  } catch (err) {
    console.error("checkout: Lead-Verknüpfung fehlgeschlagen", err);
    return null;
  }
}

/**
 * Optionale Bestätigungs-Mail über Brevo. Ohne BREVO_TPL_CHECKOUT_CONFIRMATION
 * passiert nichts — die Bestellnummer steht dann nur auf der Danke-Seite.
 *
 * Die Zahlungsdaten reist die Mail als Parameter mit (aus lib/checkout-bank.ts,
 * gleiche Quelle wie die Danke-Seite) — die IBAN steht damit NICHT in der
 * Brevo-Vorlage und lässt sich ohne Template-Bearbeitung wechseln. Fehlt sie in
 * der Env, blendet die Vorlage den Bank-Block aus.
 */
async function sendConfirmation(
  input: CheckoutInput,
  fullName: string,
  reference: string,
  planLabel: string,
  installmentAmount: number,
  installments: number,
): Promise<void> {
  const templateId = Number(process.env.BREVO_TPL_CHECKOUT_CONFIRMATION);
  if (!Number.isFinite(templateId) || templateId <= 0) return;

  const { net, vat } = vatSplit(CHECKOUT_OFFER.price, CHECKOUT_OFFER.vatRate);
  const bank = bankDetails();
  try {
    const res = await sendBrevoEmail({
      to: { email: input.email, name: fullName },
      templateId,
      params: {
        firstName: input.firstName,
        fullName,
        reference,
        offerName: CHECKOUT_OFFER.name,
        planLabel,
        installments,
        installmentAmount: formatPrice(installmentAmount),
        amountGross: formatPrice(CHECKOUT_OFFER.price),
        amountNet: formatPrice(net),
        amountVat: formatPrice(vat),
        vatRate: Math.round(CHECKOUT_OFFER.vatRate * 100),
        // Bank-Block: die Vorlage rendert ihn nur, wenn eine IBAN ankommt.
        bankHolder: bank?.holder ?? "",
        bankIban: bank?.iban ?? "",
        bankBic: bank?.bic ?? "",
        bankName: bank?.bank ?? "",
      },
    });
    if (!res.ok) console.error("checkout: Bestätigungs-Mail fehlgeschlagen", res.error);
  } catch (err) {
    console.error("checkout: Bestätigungs-Mail fehlgeschlagen", err);
  }
}
