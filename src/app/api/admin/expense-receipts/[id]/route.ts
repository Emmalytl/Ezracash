import { NextResponse } from 'next/server';
import { receiptBytes } from '@/lib/receipts';
import { requireRole } from '@/lib/auth';
import { sqlClient } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['developer', 'administrator', 'staff']);
    const { id } = await params;
    const sql = sqlClient();
    const rows = await sql`
      SELECT filename, mime_type, file_data
      FROM expense_receipts
      WHERE expense_id=${id}
      LIMIT 1
    `;
    if (!rows.length) return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });

    const row = rows[0] as any;
    const bytes = receiptBytes(row.file_data);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const safeName = String(row.filename || 'receipt').replace(/[\\"\r\n]/g, '_');
    return new NextResponse(body, {
      headers: {
        'Content-Type': row.mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message === 'UNAUTHORIZED' ? 'Unauthorized' : e.message },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}
