import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { sqlClient } from '@/lib/db';
import { ensureCampaignSchema } from '@/lib/data';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(['developer','administrator','staff']);
    const { id } = await params;
    await ensureCampaignSchema();
    const b = await request.json();
    if (!String(b.title || '').trim() || !Number.isFinite(Number(b.goal)) || Number(b.goal)<=0 || !['active','paused','closed','archived'].includes(b.status || 'active')) return NextResponse.json({ error: 'Title and goal are required.' }, { status: 400 });
    const sql = sqlClient();
    const rows = await sql`
      UPDATE campaigns SET title=${b.title},category=${b.category || 'GENERAL'},description=${b.description || ''},goal=${Number(b.goal)},image=${b.image || ''},status=${b.status || 'active'},updated_at=NOW()
      WHERE id=${id} RETURNING id,title,category,description,goal,image,status
    `;
    if (!rows[0]) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    await sql`INSERT INTO security_audit(action,admin_id,session_id,details) VALUES('campaign_updated',${actor.id},${actor.sessionId},${id+' · '+b.title})`;
    return NextResponse.json(rows[0]);
  } catch (e: any) {
    return NextResponse.json({ error: e.message === 'UNAUTHORIZED' ? 'Unauthorized' : e.message || 'Could not update campaign.' }, { status: e.message === 'UNAUTHORIZED' ? 401 : 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(['developer','administrator','staff']);
    const { id } = await params;
    await ensureCampaignSchema();
    const sql = sqlClient();
    const rows = await sql`UPDATE campaigns SET status='archived',updated_at=NOW() WHERE id=${id} RETURNING id,title`;
    if (!rows[0]) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    await sql`INSERT INTO security_audit(action,admin_id,session_id,details) VALUES('campaign_archived',${actor.id},${actor.sessionId},${id+' · '+rows[0].title})`;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message === 'UNAUTHORIZED' ? 'Unauthorized' : e.message || 'Could not archive campaign.' }, { status: e.message === 'UNAUTHORIZED' ? 401 : 500 });
  }
}
