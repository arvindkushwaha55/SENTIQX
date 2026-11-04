export const HIDDEN = "[hidden]";

function luhn(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

const PATTERNS: RegExp[] = [
  /\b(?:otp|one[- ]time (?:code|password)|verification code|security code|pin|cvv)\b\D{0,15}\d{3,8}\b/gi,
  /\b(?:password|passwd|pwd|passcode|passphrase)\s*(?:is|:|=|hai)?\s*\S+/gi,
  /\bBearer\s+[A-Za-z0-9._\-+/=]{12,}/g,
  /\b(?:sk|pk|rk|api|key|token|secret)[-_][A-Za-z0-9_-]{12,}\b/gi,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g,
  /\b[A-Fa-f0-9]{40,}\b/g,
  /\b[A-Za-z0-9+/_-]{40,}={0,2}(?=\s|$)/g,
];

/**
 * Hides text that looks like a password, code, key or card number.
 * This is a best-effort filter, not a guarantee: the user reviews the result before analysis.
 */
export function redact(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const re of PATTERNS) {
    out = out.replace(re, () => {
      count++;
      return HIDDEN;
    });
  }
  out = out.replace(/\b(?:\d[ -]?){13,19}\b/g, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
      count++;
      return HIDDEN;
    }
    return m;
  });
  return { text: out, count };
}
