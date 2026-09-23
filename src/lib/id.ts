export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Crockford-style alphabet without look-alikes (0/O, 1/I/L).
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** A new apartment code, e.g. "HOME-7K3M-Q9XP-2B8D" (~79 bits of randomness). */
export function newHomeCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `HOME-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}-${chars.slice(12, 16)}`;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}
