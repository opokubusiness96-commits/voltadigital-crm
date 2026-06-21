import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isEmailAuthorized } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { createLead } from "../actions";

export default async function NewLeadPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAuthorized(user.email)) redirect("/login");

  async function action(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim() || undefined;
    const source_manual = String(formData.get("source_manual") ?? "").trim() || undefined;
    const valueRaw = String(formData.get("value_estimate") ?? "").trim();
    const value_estimate = valueRaw ? Number(valueRaw) : undefined;
    const notes = String(formData.get("notes") ?? "").trim() || undefined;

    if (!name || !email) return;
    await createLead({
      name,
      email,
      phone,
      source: "manual",
      source_manual,
      value_estimate,
      notes,
    });
  }

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold mb-6">Neuer Lead</h1>
        <form action={action} className="space-y-4">
          <Field label="Name" name="name" required />
          <Field label="Email" name="email" type="email" required />
          <Field label="Telefon" name="phone" />
          <Field label="Quelle (z.B. Empfehlung, Instagram, Meta-Ad)" name="source_manual" />
          <Field label="Geschätzter Wert (EUR)" name="value_estimate" type="number" />
          <div>
            <label className="block text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
              Notizen
            </label>
            <textarea
              name="notes"
              rows={4}
              className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md px-3 py-2"
            />
          </div>
          <button
            type="submit"
            className="bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold rounded-md py-2.5 px-5"
          >
            Lead anlegen
          </button>
        </form>
      </main>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
        {label}
        {required && " *"}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md px-3 py-2"
      />
    </div>
  );
}
