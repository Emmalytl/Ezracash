import { createHmac, timingSafeEqual } from 'node:crypto';

// A short-lived capability grants access to this donation only, never the donor directory.
function signature(payload: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET_MISSING');
  return createHmac('sha256', secret).update(`donation-receipt:${payload}`).digest('hex');
}
export function createReceiptToken(id: string) {
  const payload = `${id}.${Math.floor(Date.now() / 1000) + 86400}`;
  return `${payload}.${signature(payload)}`;
}
export function verifyReceiptToken(token: string): string | null {
  const [id, expires, digest, extra] = token.split('.');
  if (extra || !/^[0-9a-f-]{36}$/i.test(id || '') || !/^\d+$/.test(expires || '') || !/^[0-9a-f]{64}$/.test(digest || '')) return null;
  if (Number(expires) <= Math.floor(Date.now() / 1000)) return null;
  const expected = signature(`${id}.${expires}`);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(digest)) ? id : null;
}
