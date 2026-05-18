// Mirror of backend/src/helpers/email-validation.ts. We duplicate the
// blocklist so the frontend can reject free-provider addresses before the
// signup POST hits the API — the backend re-validates on submit, so this
// is purely a UX concern, not a security boundary.

const BLOCKED_DOMAINS = new Set([
  // Google
  'gmail.com', 'googlemail.com',
  // Yahoo
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.fr', 'yahoo.de', 'yahoo.it',
  'yahoo.es', 'yahoo.ca', 'yahoo.com.br', 'yahoo.com.au', 'ymail.com', 'rocketmail.com',
  // Microsoft
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.it',
  'outlook.com', 'outlook.co.uk', 'live.com', 'live.co.uk', 'msn.com',
  // AOL
  'aol.com', 'aol.co.uk',
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  // Proton
  'protonmail.com', 'protonmail.ch', 'proton.me', 'pm.me',
  // Zoho
  'zoho.com', 'zohomail.com',
  // Russian
  'yandex.com', 'yandex.ru', 'mail.ru',
  // Other personal / disposable providers
  'gmx.com', 'gmx.de', 'gmx.net', 'web.de', 'mail.com', 'email.com', 'usa.com',
  'inbox.com', 'fastmail.com', 'fastmail.fm', 'hushmail.com',
  'tutanota.com', 'tutanota.de', 'tuta.io',
  'guerrillamail.com', 'tempmail.com', 'throwaway.email', 'mailinator.com',
  'sharklasers.com', 'guerrillamailblock.com', 'pokemail.net',
  'dispostable.com', 'yopmail.com', 'trashmail.com', 'rediffmail.com',
  '163.com', '126.com', 'qq.com', 'sina.com', 'naver.com', 'daum.net', 'hanmail.net',
  'cox.net', 'sbcglobal.net', 'att.net', 'verizon.net', 'comcast.net', 'charter.net',
  'earthlink.net', 'optonline.net', 'frontier.com', 'aim.com',
]);

export function isFreeProviderEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const domain = trimmed.split('@')[1];
  if (!domain) return false;
  return BLOCKED_DOMAINS.has(domain);
}
