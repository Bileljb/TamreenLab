// Basic display-name moderation for the public leaderboard (PLAN Phase 4). Deliberately small:
// names are short, and a reviewer can extend the list without code changes elsewhere.
const BLOCKED = [
  // Impersonation of staff.
  'admin',
  'administrator',
  'moderator',
  'مشرف',
  'ادمن',
  'الإدارة',
  // Common insults and slurs (English and Arabic).
  'fuck',
  'shit',
  'bitch',
  'nazi',
  'كلب',
  'حمار',
  'حقير',
  'وسخ',
  'زبالة',
  'شرموط',
  'عاهرة',
];

/** Lower-case, drop harakat and tatweel, unify alif and ya forms, remove spaces and punctuation. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

const blocked = BLOCKED.map(normalizeName);

export function isAllowedDisplayName(name: string): boolean {
  const normalized = normalizeName(name);
  if (normalized.length === 0) return false;
  return !blocked.some((word) => normalized.includes(word));
}
