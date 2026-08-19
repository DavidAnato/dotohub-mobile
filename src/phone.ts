/** Indicatif Bénin - préfixe verrouillé côté UI. */
export const BJ_DIAL = "+229";
export const BJ_CC_DIGITS = "229";

export function digitsOnly(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

export function nationalDigits(raw: string): string {
  let d = digitsOnly(raw);
  if (d.startsWith(BJ_CC_DIGITS)) d = d.slice(BJ_CC_DIGITS.length);
  return d.slice(0, 10);
}

export function formatNational(raw: string): string {
  const d = nationalDigits(raw);
  if (!d) return "";
  if (d.length <= 2) return d;
  const parts: string[] = [];
  let i = 0;
  while (i < d.length) {
    parts.push(d.slice(i, i + 2));
    i += 2;
  }
  return parts.join(" ");
}

export function toE164Bj(raw: string): string {
  const nat = nationalDigits(raw);
  if (!nat) return "";
  return `${BJ_DIAL} ${formatNational(nat)}`.trim();
}

export function displayPhoneBj(raw: string, fallback = "-"): string {
  const nat = nationalDigits(raw);
  if (!nat) return fallback;
  return `${BJ_DIAL} ${formatNational(nat)}`;
}

export function isValidBjPhone(raw: string): boolean {
  const n = nationalDigits(raw).length;
  return n >= 8 && n <= 10;
}
