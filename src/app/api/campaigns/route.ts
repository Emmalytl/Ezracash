import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { sqlClient } from '@/lib/db';
import { listCampaigns, ensureCampaignSchema } from '@/lib/data';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const adminView = url.searchParams.get('admin') === '1';
  try {
    if (!adminView) {
      try {
        const rows = await listCampaigns(false);
        return NextResponse.json(rows);
      } catch {
        return NextResponse.json({error:'Fundraising information is temporarily unavailable.'},{status:503});
      }
    }
    await requireRole(['developer','administrator','staff']);
    await ensureCampaignSchema();
    const sql = sqlClient();
    const rows = await sql`
      SELECT c.id,c.title,c.category,c.description,c.goal,c.image,c.status,c.created_at,c.updated_at,
        COALESCE(SUM(CASE WHEN d.status='completed' THEN d.amount ELSE 0 END),0) AS amount
      FROM campaigns c LEFT JOIN donations d ON d.campaign_id=c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
    return NextResponse.json(rows.map((r:any)=>({...r,id:String(r.id),goal:Number(r.goal),amount:Number(r.amount)})));
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message === 'UNAUTHORIZED' ? 'Unauthorized' : e.message || 'Could not load campaigns.' },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole(['developer','administrator','staff']);
    const b = await request.json();
    await ensureCampaignSchema();
    const sql = sqlClient();

    if (b.action === 'archive') {
      if (!b.id) return NextResponse.json({ error: 'Campaign id is required.' }, { status: 400 });
      const rows = await sql`
        UPDATE campaigns
        SET status='archived',updated_at=NOW()
        WHERE id=${b.id}
        RETURNING id,title,status
      `;
      if (!rows[0]) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
      await sql`INSERT INTO security_audit(action,admin_id,session_id,details) VALUES('campaign_archived',${actor.id},${actor.sessionId},${b.id+' · '+rows[0].title})`;
      return NextResponse.json(rows[0]);
    }

    if (b.action === 'update') {
      if (!b.id) return NextResponse.json({ error: 'Campaign id is required.' }, { status: 400 });
      if (!String(b.title || '').trim() || !Number.isFinite(Number(b.goal)) || Number(b.goal)<=0 || !['active','paused','closed','archived'].includes(b.status || 'active')) return NextResponse.json({ error: 'Title and goal are required.' }, { status: 400 });
      const rows = await sql`
        UPDATE campaigns
        SET title=${b.title},category=${b.category || 'GENERAL'},description=${b.description || ''},goal=${Number(b.goal)},image=${b.image || ''},status=${b.status || 'active'},updated_at=NOW()
        WHERE id=${b.id}
        RETURNING id,title,category,description,goal,image,status,created_at,updated_at
      `;
      if (!rows[0]) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
      await sql`INSERT INTO security_audit(action,admin_id,session_id,details) VALUES('campaign_updated',${actor.id},${actor.sessionId},${b.id+' · '+b.title})`;
      return NextResponse.json(rows[0]);
    }

    if (!String(b.title || '').trim() || !Number.isFinite(Number(b.goal)) || Number(b.goal)<=0 || !['active','paused','closed','archived'].includes(b.status || 'active')) return NextResponse.json({ error: 'Title and goal are required.' }, { status: 400 });
    const rows = await sql`
      INSERT INTO campaigns (title,category,description,goal,image,status,created_at,updated_at)
      VALUES (${b.title},${b.category || 'GENERAL'},${b.description || ''},${Number(b.goal)},${b.image || ''},${b.status || 'active'},NOW(),NOW())
      RETURNING id,title,category,description,goal,image,status,created_at,updated_at
    `;
    await sql`INSERT INTO security_audit(action,admin_id,session_id,details) VALUES('campaign_created',${actor.id},${actor.sessionId},${rows[0].id+' · '+rows[0].title})`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message === 'UNAUTHORIZED' ? 'Unauthorized' : e.message || 'Could not save campaign.' },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}
