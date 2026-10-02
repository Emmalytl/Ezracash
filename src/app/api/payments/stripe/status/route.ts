import { NextResponse } from 'next/server';
import { verifyReceiptToken } from '@/lib/payments/receipt-token';
import { sqlClient } from '@/lib/db';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
    const id = verifyReceiptToken(token);
    if (!id) return NextResponse.json({error:'This confirmation link has expired. Contact the ministry for your receipt.'},{status:401});
    const sql = sqlClient();
    const rows = await sql`SELECT id,status,amount,donation_type,payment_method,payment_provider,transaction_id,created_at,completed_at FROM donations WHERE id=${id} AND payment_provider='stripe' LIMIT 1`;
    if (!rows[0]) return NextResponse.json({error:'Donation not found.'},{status:404});
    return NextResponse.json(rows[0], {headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({error:'Confirmation is temporarily unavailable. Please check again.'},{status:503});
  }
}
