/** Decode BYTEA responses from Postgres without silently returning an empty receipt. */
export function receiptBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string' && /^\\x(?:[0-9a-f]{2})*$/i.test(value)) return Buffer.from(value.slice(2), 'hex');
  if (value && typeof value === 'object' && 'data' in value && Array.isArray(value.data)) return Uint8Array.from(value.data);
  throw new Error('Receipt data could not be decoded.');
}
