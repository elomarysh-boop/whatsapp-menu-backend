export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function normalizePhone(jid = '') {
  return jid.split(':')[0].replace(/\\D/g, '');
}

export function normalizeText(value = '') {
  return value.trim().replace(/\\s+/g, ' ');
}

export function money(value, currency = 'ر.س') {
  return `${Number(value).toFixed(2)} ${currency}`;
}

export function isValidJid(jid = '') {
  return /^\\d{5,20}(@s\\.whatsapp\\.net)?$/.test(jid);
}
