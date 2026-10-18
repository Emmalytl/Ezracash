/** Decode BYTEA responses from Postgres without silently returning an empty receipt. */
export function receiptBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string' && /^\\x(?:[0-9a-f]{2})*$/i.test(value)) return Buffer.from(value.slice(2), 'hex');
  if (value && typeof value === 'object' && 'data' in value && Array.isArray(value.data)) return Uint8Array.from(value.data);
  throw new Error('Receipt data could not be decoded.');
}

/** Signature validation rejects MIME spoofing. This is not malware scanning. */
export async function validatedReceiptBytes(file: File): Promise<Buffer> {
 const bytes=Buffer.from(await file.arrayBuffer());
 const png=bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR';
 const jpg=bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=bytes.length>=20&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 const gif=bytes.length>=13&&['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6));
 const pdf=bytes.length>=12&&bytes.toString('ascii',0,5)==='%PDF-'&&bytes.subarray(Math.max(0,bytes.length-1024)).includes(Buffer.from('%%EOF'));
 if(!((file.type==='image/png'&&png)||(file.type==='image/jpeg'&&jpg)||(file.type==='image/webp'&&webp)||(file.type==='image/gif'&&gif)||(file.type==='application/pdf'&&pdf)))throw new Error('INVALID_RECEIPT_CONTENT');
 return bytes;
}
