import "server-only";
import crypto from "node:crypto";

// Stripe ohne SDK: das Repo hat die Abhängigkeit nicht, und der Checkout
// braucht genau vier Endpunkte (Customer, Checkout Session, Session lesen,
// Subscription updaten). Die Signaturprüfung steht direkt daneben — dieselbe
// Bauart wie beim Calendly-Webhook (app/api/webhooks/calendly/route.ts).

const API_BASE = "https://api.stripe.com/v1";

type StripeValue = string | number | boolean | null | undefined | StripeParams | StripeValue[];
export type StripeParams = { [key: string]: StripeValue };

/**
 * Stripe erwartet form-encoded mit eckigen Klammern für Verschachtelung:
 * `line_items[0][price]=price_123`. JSON akzeptiert die API nicht.
 */
function flatten(params: StripeParams, prefix = ""): [string, string][] {
  const out: [string, string][] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === "object") {
          out.push(...flatten(item as StripeParams, `${name}[${i}]`));
        } else if (item !== undefined && item !== null) {
          out.push([`${name}[${i}]`, String(item)]);
        }
      });
    } else if (typeof value === "object") {
      out.push(...flatten(value, name));
    } else {
      out.push([name, String(value)]);
    }
  }
  return out;
}

async function request(
  method: "GET" | "POST",
  path: string,
  params?: StripeParams,
  idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt");

  const encoded = params ? new URLSearchParams(flatten(params)).toString() : "";
  const url = method === "GET" && encoded ? `${API_BASE}${path}?${encoded}` : `${API_BASE}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Verhindert doppelte Sessions/Kunden, wenn der Käufer zweimal absendet
      // oder ein Retry läuft — Stripe gibt dann dasselbe Objekt zurück.
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" ? encoded : undefined,
    cache: "no-store",
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(err?.message || `Stripe ${res.status}`);
  }
  return data;
}

export const stripeGet = (path: string, params?: StripeParams) => request("GET", path, params);
export const stripePost = (path: string, params: StripeParams, idempotencyKey?: string) =>
  request("POST", path, params, idempotencyKey);

/**
 * Signatur des Stripe-Webhooks prüfen (Header `Stripe-Signature`).
 *
 * Format: `t=<unix>,v1=<hex>[,v1=<hex>…]`. Signiert wird `${t}.${rohes Body}` —
 * deshalb MUSS der Aufrufer den unveränderten Text übergeben, nicht das
 * geparste JSON. Der Zeitfenster-Check ist der Replay-Schutz.
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  if (!header) return false;

  let timestamp = 0;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2).map((s) => s?.trim());
    if (k === "t") timestamp = Number(v);
    // Stripe darf mehrere v1 mitschicken (Secret-Rotation) — eine muss passen.
    else if (k === "v1" && v) signatures.push(v);
  }
  if (!Number.isFinite(timestamp) || timestamp <= 0 || signatures.length === 0) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  return signatures.some((sig) => {
    let given: Buffer;
    try {
      given = Buffer.from(sig, "hex");
    } catch {
      return false;
    }
    if (given.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(given, expectedBuf);
  });
}
