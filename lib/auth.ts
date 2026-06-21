export function isEmailAuthorized(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.AUTHORIZED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true; // keine Whitelist gesetzt → alle eingeloggten erlauben
  return list.includes(email.toLowerCase());
}
