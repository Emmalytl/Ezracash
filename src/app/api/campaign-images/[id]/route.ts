import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { receiptBytes } from '@/lib/receipts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Campaign pictures are public marketing assets, unlike private expense receipts.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({error:'Picture not found.'},{status:404});
  }
  try {
    const sql = sqlClient();
    const rows = await sql`SELECT i.mime_type,i.file_data FROM campaign_images i JOIN campaigns c ON c.id=i.campaign_id WHERE i.id=${id} LIMIT 1`;
    if (!rows[0]) return NextResponse.json({error:'Picture not found.'},{status:404});
    const row = rows[0];
    if (!['image/jpeg','image/png','image/webp'].includes(row.mime_type)) return NextResponse.json({error:'Picture not found.'},{status:404});
    const bytes = receiptBytes(row.file_data);
    const body = bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
    return new NextResponse(body,{headers:{'Content-Type':row.mime_type,'Cache-Control':'public, max-age=86400, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  } catch (error: any) {
    if (error.code === '42P01') return NextResponse.json({error:'Picture not found.'},{status:404});
    return NextResponse.json({error:'Picture temporarily unavailable.'},{status:503});
  }
}
