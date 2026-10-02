import { NextResponse } from 'next/server';
import { receiptBytes } from '@/lib/receipts';
import { requireRole } from '@/lib/auth';
import { sqlClient } from '@/lib/db';

export const runtime = 'nodejs';

const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

function isAllowedReceipt(file: File) {
  return ['application/pdf','image/jpeg','image/png','image/webp','image/gif'].includes(file.type);
}

async function ensure() {
  const sql = sqlClient();
  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category TEXT NOT NULL DEFAULT 'Ministry',
      description TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL CHECK(amount>0),
      payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
      reference TEXT,
      approved_by TEXT,
      status TEXT NOT NULL DEFAULT 'recorded' CHECK(status IN ('recorded','pending','voided')),
      expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS expense_receipts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      expense_id UUID NOT NULL UNIQUE REFERENCES expenses(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS expense_receipts_expense_idx ON expense_receipts(expense_id)`;
}

export async function GET(req: Request) {
  try {
    await requireRole(['developer', 'administrator', 'staff']);
    await ensure();
    const url = new URL(req.url);
    const receiptId = url.searchParams.get('receipt');
    const sql = sqlClient();

    if (receiptId) {
      const receiptRows = await sql`
        SELECT filename, mime_type, file_data
        FROM expense_receipts
        WHERE expense_id=${receiptId}
        LIMIT 1
      `;
      if (!receiptRows.length) return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
      const row = receiptRows[0] as any;
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
    }

    const rows = await sql`
      SELECT e.*,
        EXISTS(SELECT 1 FROM expense_receipts r WHERE r.expense_id=e.id) AS has_receipt
      FROM expenses e
      ORDER BY e.expense_date DESC
      LIMIT 500
    `;
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message === 'UNAUTHORIZED' ? 'Unauthorized' : e.message },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const u = await requireRole(['developer', 'administrator', 'staff']);
    await ensure();

    const contentType = req.headers.get('content-type') || '';
    let b: Record<string, any> = {};
    let receiptFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const uploadedReceipt = form.get('receipt');
      if (uploadedReceipt instanceof File) receiptFile = uploadedReceipt;
      form.forEach((value, key) => {
        if (key !== 'receipt' && typeof value === 'string') b[key] = value;
      });
    } else {
      b = await req.json();
    }

    const amount = Number(b.amount);
    if (!String(b.description || '').trim() || !Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99 || Math.abs(amount*100-Math.round(amount*100))>0.000001) {
      return NextResponse.json({ error: 'Description and a valid amount are required.' }, { status: 400 });
    }

    if (!['recorded','pending','voided'].includes(b.status || 'recorded') || (b.expense_date && !Number.isFinite(new Date(b.expense_date).getTime()))) return NextResponse.json({error:'Invalid expense status or date.'},{status:400});

    if (receiptFile) {
      if (!isAllowedReceipt(receiptFile)) {
        return NextResponse.json({ error: 'Receipt must be a PDF or an image.' }, { status: 400 });
      }
      if (receiptFile.size > MAX_RECEIPT_BYTES) {
        return NextResponse.json({ error: 'Receipt must be 4 MB or smaller.' }, { status: 400 });
      }
    }

    const sql = sqlClient();
    const rows = await sql`
      INSERT INTO expenses(category,description,amount,payment_method,reference,approved_by,status,expense_date)
      VALUES(
        ${b.category || 'Ministry'},
        ${b.description},
        ${amount},
        ${b.payment_method || 'Bank Transfer'},
        ${b.reference || null},
        ${u.role === 'staff' ? null : (b.approved_by || u.email)},
        ${u.role === 'staff' ? 'pending' : (b.status || 'recorded')},
        ${b.expense_date ? new Date(b.expense_date) : new Date()}
      )
      RETURNING *
    `;

    const expense = rows[0];

    if (receiptFile) {
      const buffer = Buffer.from(await receiptFile.arrayBuffer());
      try {
        await sql`
          INSERT INTO expense_receipts(expense_id,filename,mime_type,file_size,file_data)
          VALUES(${expense.id},${receiptFile.name.slice(0,255)},${receiptFile.type},${receiptFile.size},${buffer})
        `;
      } catch (receiptError) {
        await sql`DELETE FROM expenses WHERE id=${expense.id}`;
        throw receiptError;
      }
    }

    await sql`
      INSERT INTO security_audit(action,admin_id,session_id,details)
      VALUES(
        'expense_recorded',
        ${u.id},
        ${u.sessionId},
        ${expense.id + ' · ' + amount + (receiptFile ? ' · receipt attached' : '')}
      )
    `;

    return NextResponse.json({ ...expense, has_receipt: Boolean(receiptFile) });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message === 'UNAUTHORIZED' ? 'Unauthorized' : (e.message || 'Could not save expense.') },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}
