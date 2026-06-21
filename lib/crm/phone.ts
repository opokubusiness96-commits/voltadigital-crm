// E.164 normalization for tel:/whatsapp links
const COUNTRY_PREFIX: Record<string, string> = {
  DE: "49",
  AT: "43",
  CH: "41",
};

export function normalizePhoneToE164(raw: string, defaultCountry: keyof typeof COUNTRY_PREFIX = "DE"): string {
  const cleaned = raw.replace(/[\s()\-./]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith("0")) return `+${COUNTRY_PREFIX[defaultCountry]}${cleaned.slice(1)}`;
  return `+${cleaned}`;
}

export function whatsappLink(rawPhone: string): string {
  const e164 = normalizePhoneToE164(rawPhone);
  return `https://wa.me/${e164.replace(/^\+/, "")}`;
}
