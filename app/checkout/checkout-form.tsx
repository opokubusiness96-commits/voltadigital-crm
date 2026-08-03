"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import {
  CHECKOUT_OFFER,
  findPlan,
  formatPrice,
  validateCheckout,
  type CheckoutInput,
  type FieldErrors,
} from "@/lib/checkout";
import { submitCheckout } from "./actions";

const EMPTY: CheckoutInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  vatId: "",
  street: "",
  postalCode: "",
  city: "",
  country: "Deutschland",
  planId: CHECKOUT_OFFER.plans[0].id,
  notes: "",
  acceptTerms: false,
  acceptWithdrawal: false,
};

const INPUT_CLS =
  "w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md px-3 py-2.5 outline-none focus:border-[color:var(--color-accent)] disabled:opacity-60";

export function CheckoutForm() {
  const router = useRouter();
  const [values, setValues] = useState<CheckoutInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // UTMs aus der Landing-Page-URL mitnehmen (?utm_source=meta&…) — landen an der
  // Bestellung und am Lead, damit die Attribution im CRM stimmt.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const utm = {
      utmSource: q.get("utm_source") ?? undefined,
      utmMedium: q.get("utm_medium") ?? undefined,
      utmCampaign: q.get("utm_campaign") ?? undefined,
      utmContent: q.get("utm_content") ?? undefined,
    };
    if (Object.values(utm).some(Boolean)) setValues((v) => ({ ...v, ...utm }));
  }, []);

  function set<K extends keyof CheckoutInput>(key: K, value: CheckoutInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Erst clientseitig prüfen (sofortiges Feedback) — die Server Action
    // validiert dieselben Regeln nochmal, sie ist die Quelle der Wahrheit.
    const local = validateCheckout(values);
    if (Object.keys(local).length > 0) {
      setErrors(local);
      setFormError("Bitte die markierten Felder prüfen.");
      return;
    }

    setLoading(true);
    try {
      const res = await submitCheckout(values);
      if (!res.ok) {
        setErrors(res.fields ?? {});
        setFormError(res.error);
        setLoading(false);
        return;
      }
      router.push(`/checkout/danke?ref=${encodeURIComponent(res.reference)}`);
    } catch {
      setFormError("Verbindung fehlgeschlagen. Bitte nochmal versuchen.");
      setLoading(false);
    }
  }

  const plan = findPlan(values.planId) ?? CHECKOUT_OFFER.plans[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* ── Kontaktdaten ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionTitle step={1} title="Deine Daten" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Vorname" error={errors.firstName}>
            <input
              className={INPUT_CLS}
              autoComplete="given-name"
              disabled={loading}
              value={values.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </Field>
          <Field label="Nachname" error={errors.lastName}>
            <input
              className={INPUT_CLS}
              autoComplete="family-name"
              disabled={loading}
              value={values.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </Field>
          <Field label="E-Mail" error={errors.email}>
            <input
              type="email"
              className={INPUT_CLS}
              autoComplete="email"
              disabled={loading}
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Telefon" error={errors.phone}>
            <input
              type="tel"
              className={INPUT_CLS}
              autoComplete="tel"
              disabled={loading}
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* ── Rechnungsadresse ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionTitle step={2} title="Rechnungsadresse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Firma" optional>
            <input
              className={INPUT_CLS}
              autoComplete="organization"
              disabled={loading}
              value={values.company}
              onChange={(e) => set("company", e.target.value)}
            />
          </Field>
          <Field label="USt-IdNr." optional>
            <input
              className={INPUT_CLS}
              disabled={loading}
              placeholder="DE123456789"
              value={values.vatId}
              onChange={(e) => set("vatId", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Straße und Hausnummer" error={errors.street}>
              <input
                className={INPUT_CLS}
                autoComplete="street-address"
                disabled={loading}
                value={values.street}
                onChange={(e) => set("street", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-[7rem_1fr] gap-4 sm:col-span-2">
            <Field label="PLZ" error={errors.postalCode}>
              <input
                className={INPUT_CLS}
                autoComplete="postal-code"
                inputMode="numeric"
                disabled={loading}
                value={values.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
              />
            </Field>
            <Field label="Ort" error={errors.city}>
              <input
                className={INPUT_CLS}
                autoComplete="address-level2"
                disabled={loading}
                value={values.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Land" error={errors.country}>
              <select
                className={INPUT_CLS}
                disabled={loading}
                value={values.country}
                onChange={(e) => set("country", e.target.value)}
              >
                {["Deutschland", "Österreich", "Schweiz"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </section>

      {/* ── Zahlungsmodell ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionTitle step={3} title="Zahlung" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CHECKOUT_OFFER.plans.map((p) => {
            const active = values.planId === p.id;
            return (
              <label
                key={p.id}
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  active
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/[0.07]"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-white/25"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="plan"
                    className="mt-1 accent-[color:var(--color-accent)]"
                    disabled={loading}
                    checked={active}
                    onChange={() => set("planId", p.id)}
                  />
                  <div className="min-w-0">
                    <div className="font-medium">{p.label}</div>
                    <div className="text-lg font-bold font-display text-[color:var(--color-accent)] mt-0.5">
                      {p.installments > 1
                        ? `${p.installments} × ${formatPrice(p.installmentAmount)}`
                        : formatPrice(p.total)}
                    </div>
                    <p className="text-xs text-[color:var(--color-muted)] mt-1 leading-snug">{p.hint}</p>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
        {errors.planId && <p className="text-sm text-[color:var(--color-red)]">{errors.planId}</p>}

        <p className="text-xs text-[color:var(--color-muted)] leading-relaxed">
          Bezahlt wird per <strong className="text-[color:var(--color-text)]">Überweisung</strong>. Nach der
          Bestellung erhältst du deine Bestellnummer und die Rechnung mit allen Zahlungsdaten per E-Mail.
        </p>

        <Field label="Nachricht an Jerome" optional>
          <textarea
            rows={3}
            className={`${INPUT_CLS} resize-y`}
            disabled={loading}
            placeholder="Wo stehst du gerade? Woran willst du zuerst arbeiten?"
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </section>

      {/* ── Bestätigungen + Abschluss ────────────────────────────────────── */}
      <section className="space-y-4">
        <Checkbox
          checked={values.acceptTerms}
          disabled={loading}
          error={errors.acceptTerms}
          onChange={(v) => set("acceptTerms", v)}
        >
          Ich akzeptiere die AGB und habe die Datenschutzerklärung gelesen.
        </Checkbox>
        <Checkbox
          checked={values.acceptWithdrawal}
          disabled={loading}
          error={errors.acceptWithdrawal}
          onChange={(v) => set("acceptWithdrawal", v)}
        >
          Ich habe die Widerrufsbelehrung zur Kenntnis genommen. Mir ist bekannt, dass das Coaching auf meinen
          ausdrücklichen Wunsch schon vor Ablauf der Widerrufsfrist beginnen kann.
        </Checkbox>

        {formError && (
          <p className="rounded-md border border-[color:var(--color-red)]/40 bg-[color:var(--color-red)]/10 px-3 py-2 text-sm text-[color:var(--color-red)]">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold rounded-md py-3.5 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Bestellung wird gesendet…
            </>
          ) : (
            <>
              Zahlungspflichtig bestellen · {formatPrice(plan.total)}
            </>
          )}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-[color:var(--color-muted)]">
          <Lock className="w-3.5 h-3.5" /> Deine Daten werden verschlüsselt übertragen.
        </p>
      </section>
    </form>
  );
}

function SectionTitle({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-accent)]/50 text-xs font-semibold text-[color:var(--color-accent)]">
        {step}
      </span>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

function Field({
  label,
  error,
  optional,
  children,
}: {
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
        {label}
        {optional && <span className="normal-case tracking-normal"> (optional)</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-[color:var(--color-red)]">{error}</span>}
    </label>
  );
}

function Checkbox({
  checked,
  disabled,
  error,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  error?: string;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer text-sm leading-snug">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-accent)]"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-[color:var(--color-muted)]">{children}</span>
      </label>
      {error && <p className="ml-7 mt-1 text-xs text-[color:var(--color-red)]">{error}</p>}
    </div>
  );
}
